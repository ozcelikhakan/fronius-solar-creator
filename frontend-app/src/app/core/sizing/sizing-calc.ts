import {
  InverterSpec,
  PvArray,
  findModuleSpec
} from '../models/project.model';

// String configuration of a PV array, such as PV1/PV2.
export interface StringConfig {
  arrayLabel: string;       // 'PV1', 'PV2' ...
  strings: number;          // number of parallel strings
  modulesPerString: number; // number of modules in each string
  totalModules: number;
}

// Sizing Result detail table — exact counterpart of the fields in CLAUDE.md.
export interface SizingDetail {
  mppPowerAt25: number;        // W — total DC power at 25°C
  vocAt70: number;             // V — open-circuit voltage at 70°C, decreases in heat
  vocAtMinus10: number;        // V — open-circuit voltage at -10°C, increases in cold → REQUIRED check
  vmpAt70: number;             // V — MPP voltage at 70°C
  vmpAt0: number;              // V — MPP voltage at 0°C
  iscAt25: number;             // A — short-circuit current
  impAt25: number;             // A — MPP current
  stringFusesRequired: boolean;
  stringCombinerRequired: boolean;
  yieldLoss: boolean;          // efficiency loss caused by clipping if the power ratio is too high
}

export interface SizingResult {
  inverter: InverterSpec;
  powerRatio: number;          // PV kWp / inverter AC kW × 100
  recommended: boolean;        // whether the ratio is within the target range
  stringConfigs: StringConfig[];
  detail: SizingDetail;
  valid: boolean;              // whether Voc(-10°C) stays within the inverter limit
}

// Calculates the sizing result for a single inverter.
// modulesPerString limits come from temperature-compensated voltages:
//   min = MPP lower limit / Vmp(70°C), voltage decreases in heat
//   max = inverter upper voltage / Voc(-10°C), voltage increases in cold
export function computeSizing(
  inverter: InverterSpec,
  arrays: PvArray[],
  ratioTargetRange: { min: number; max: number }
): SizingResult | null {
  if (!arrays.length) return null;

  // Reference module for the detail table and string limits = the module of the first array.
  const refSpec = findModuleSpec(arrays[0].manufacturer, arrays[0].model);
  if (!refSpec) return null;

  const tc = refSpec.tempCoeffVoltage;
  // Temperature compensation: V(T) = V25 × (1 + tc × (T - 25))
  const vmpAt70 = refSpec.vmp25 * (1 + tc * (70 - 25));
  const vmpAt0 = refSpec.vmp25 * (1 + tc * (0 - 25));
  const vocAt70 = refSpec.voc25 * (1 + tc * (70 - 25));
  const vocAtMinus10 = refSpec.voc25 * (1 + tc * (-10 - 25));

  // Module limits per string, based on the reference module.
  const maxPerString = Math.max(1, Math.floor(inverter.mppVoltageMax / vocAtMinus10));
  const minPerString = Math.max(1, Math.ceil(inverter.mppVoltageMin / vmpAt70));

  // String distribution for each PV array — each array is connected to one MPPT input.
  const stringConfigs: StringConfig[] = arrays.map((a, i) => {
    const strings = Math.max(1, Math.ceil(a.moduleCount / maxPerString));
    const modulesPerString = Math.round(a.moduleCount / strings);
    return {
      arrayLabel: `PV${i + 1}`,
      strings,
      modulesPerString,
      totalModules: a.moduleCount
    };
  });

  // Total DC power and power ratio.
  const totalWp = arrays.reduce((s, a) => s + a.moduleCount * a.modulePowerWp, 0);
  const powerRatio = (totalWp * 100) / inverter.maxPowerAcW;

  // Cold Voc check: the total Voc(-10°C) of the longest string must not exceed the inverter upper voltage.
  const maxModulesInAnyString = Math.max(...stringConfigs.map(c => c.modulesPerString), 0);
  const valid = maxModulesInAnyString * vocAtMinus10 <= inverter.mppVoltageMax;

  // ≥3 parallel strings per string group → fuses required; array count > MPPT count → combiner required.
  const stringFusesRequired = stringConfigs.some(c => c.strings >= 3);
  const stringCombinerRequired = arrays.length > inverter.mpptCount;
  // If the power ratio exceeds the upper limit too much, the inverter clips → yield loss.
  const yieldLoss = powerRatio > ratioTargetRange.max + 10;

  return {
    inverter,
    powerRatio,
    recommended: powerRatio >= ratioTargetRange.min && powerRatio <= ratioTargetRange.max,
    stringConfigs,
    valid,
    detail: {
      mppPowerAt25: totalWp,
      vocAt70,
      vocAtMinus10,
      vmpAt70,
      vmpAt0,
      // Currents are summed by string count in parallel; reference module current is used as the base.
      iscAt25: refSpec.isc25 * Math.max(...stringConfigs.map(c => c.strings), 1),
      impAt25: refSpec.imp25 * Math.max(...stringConfigs.map(c => c.strings), 1),
      stringFusesRequired,
      stringCombinerRequired,
      yieldLoss
    }
  };
}