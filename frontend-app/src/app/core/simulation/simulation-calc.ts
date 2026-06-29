import { BATTERY_DB, Project } from '../models/project.model';

const SHADING = 0.03;
const SOILING = 0.02;
const WIRING = 0.02;
const MISMATCH = 0.01;
const CO2_FACTOR = 0.132;          // kg CO₂/kWh, Austrian grid factor, 2024
const BATTERY_CYCLES_PER_YEAR = 250;
const DIRECT_USE_FRACTION = 0.30;  // typical instant self-consumption share without a battery

// Monthly distribution of solar irradiation, higher in summer — used for Annual Overview and monthly production.
const SOLAR_SEASONAL = [0.035, 0.05, 0.08, 0.105, 0.125, 0.13, 0.135, 0.115, 0.09, 0.06, 0.04, 0.035];
// Monthly distribution of consumption, higher in winter — consistent with the Consumption step.
const CONS_SEASONAL = [0.108, 0.099, 0.088, 0.075, 0.066, 0.06, 0.06, 0.063, 0.072, 0.084, 0.097, 0.108];

export interface EnergyFlow {
  // Production distribution, as % of production.
  directUse: number;
  storage: number;
  eMobility: number;
  toGrid: number;
  // Consumption coverage, as % of consumption.
  fromGrid: number;
}

export interface AmortizationPoint {
  year: number;
  cumulativeCashflow: number; // cumulative cash flow in €, negative at year 0
}

export interface MonthlyPoint {
  production: number;   // kWh
  consumption: number;  // kWh
}

export interface SimulationResult {
  pvGeneratorKwp: number;
  yearlyYieldKwh: number;
  performanceRatio: number;
  selfConsumptionRate: number;  // 0..1
  selfSufficiencyRate: number;  // 0..1
  totalConsumptionKwh: number;
  eMobilityKwh: number;

  savingsPerYear: number;       // self-consumption savings in €
  feedInRevenuePerYear: number; // grid feed-in revenue in €
  returnOnInvestmentYears: number;
  co2SavingsKgPerYear: number;

  energyFlow: EnergyFlow;
  monthly: MonthlyPoint[];      // 12 months
  amortization: AmortizationPoint[];
}

// Calculates the simulation result from all project data.
// Returns null when required data is missing, such as PV/location data — Report shows this as "no calculation".
export function computeSimulation(project: Project): SimulationResult | null {
  const arrays = project.pvArrays ?? [];
  const kwp = arrays.reduce((s, a) => s + (a.moduleCount * a.modulePowerWp) / 1000, 0);
  const irradiance = project.location?.solarIrradiance;
  if (kwp <= 0 || !irradiance) return null;

  // Irradiation slider adjustment + system losses + cable loss, if enabled.
  const adjustedIrr = irradiance * (1 + (project.location?.irradianceAdjustment ?? 0) / 100);
  let pr = 1 - (SHADING + SOILING + WIRING + MISMATCH);
  if (project.sizing?.useCableLoss) pr *= 1 - (project.sizing.cableLossPercent ?? 0) / 100;

  const yearlyYield = kwp * adjustedIrr * pr;

  // Consumption: load profiles + E-Mobility energy.
  const profilesKwh = (project.consumption?.profiles ?? []).reduce((s, p) => s + (p.annualKwh || 0), 0);
  const eMobilityKwh = (project.consumption?.evs ?? []).reduce((s, ev) => {
    const yearlyKm = ev.dailyKm.reduce((a, b) => a + b, 0) * 52.14;
    return s + (yearlyKm / 100) * ev.consumptionKwhPer100km;
  }, 0);
  const consumption = profilesKwh + eMobilityKwh;

  // Usable battery capacity in kWh × units.
  const battery = BATTERY_DB.find(b => b.id === project.components?.batteryModel);
  const batteryUsableKwh = battery ? (battery.capacityWh / 1000) * (project.components?.batteryUnits ?? 1) : 0;

  // Self-consumption: instant direct use + annual battery contribution.
  const overlap = Math.min(yearlyYield, consumption);
  const directUseEnergy = overlap * DIRECT_USE_FRACTION;
  const batteryEnergy = Math.min(
    batteryUsableKwh * BATTERY_CYCLES_PER_YEAR,
    Math.max(0, overlap - directUseEnergy)
  );
  // If 100% feed-in is enabled, there is no self-consumption.
  const fullFeedIn = project.consumption?.fullFeedIn ?? false;
  const selfConsumed = fullFeedIn ? 0 : directUseEnergy + batteryEnergy;

  const selfConsumptionRate = yearlyYield > 0 ? selfConsumed / yearlyYield : 0;
  const selfSufficiencyRate = consumption > 0 ? selfConsumed / consumption : 0;
  const feedInEnergy = yearlyYield - selfConsumed;
  const gridImport = Math.max(0, consumption - selfConsumed);

  // Normalize electricity cost to €/kWh from Month/Year/kWh.
  const exp = project.profitability?.expenses;
  const rev = project.profitability?.revenues;
  let costPerKwh = 0.25;
  if (exp) {
    if (exp.electricityUnit === 'kWh') costPerKwh = exp.electricityCost;
    else if (exp.electricityUnit === 'Year') costPerKwh = consumption > 0 ? exp.electricityCost / consumption : 0;
    else costPerKwh = consumption > 0 ? (exp.electricityCost * 12) / consumption : 0;
  }

  const feedInTariff = rev?.feedInTariff ?? 0.08;
  const savingsPerYear = selfConsumed * costPerKwh;
  const feedInRevenuePerYear = feedInEnergy * feedInTariff;

  // E-Mobility share within self-consumed energy, used for the energy flow donut.
  const eMobilityShareOfSelf = consumption > 0 ? (eMobilityKwh / consumption) * selfConsumed : 0;

  const energyFlow: EnergyFlow = {
    directUse: yearlyYield > 0 ? (directUseEnergy - eMobilityShareOfSelf) / yearlyYield : 0,
    storage: yearlyYield > 0 ? batteryEnergy / yearlyYield : 0,
    eMobility: yearlyYield > 0 ? eMobilityShareOfSelf / yearlyYield : 0,
    toGrid: yearlyYield > 0 ? feedInEnergy / yearlyYield : 0,
    fromGrid: consumption > 0 ? gridImport / consumption : 0
  };

  // Monthly production/consumption distribution.
  const monthly: MonthlyPoint[] = SOLAR_SEASONAL.map((solar, i) => ({
    production: yearlyYield * solar,
    consumption: consumption * CONS_SEASONAL[i]
  }));

  // Amortization: year 0 = -(system cost - one-time subsidies), then annual benefit.
  const period = exp?.calculationPeriodYears ?? 20;
  const oneTime = (rev?.subsidies ?? []).filter(s => s.type === 'one-time')
    .reduce((s, x) => s + subsidyValue(x, kwp, batteryUsableKwh), 0);
  const ongoing = (rev?.subsidies ?? []).filter(s => s.type === 'ongoing')
    .reduce((s, x) => s + subsidyValue(x, kwp, batteryUsableKwh), 0);
  const opex = exp?.opexAnnual ?? 0;
  const feedInDuration = rev?.feedInDurationYears ?? 20;
  const tariffAfter = rev?.feedInTariffAfter ?? feedInTariff;

  const amortization: AmortizationPoint[] = [];
  let cumulative = -((exp?.totalSystemCost ?? 0) - oneTime);
  amortization.push({ year: 0, cumulativeCashflow: Math.round(cumulative) });
  for (let y = 1; y <= period; y++) {
    const tariff = y <= feedInDuration ? feedInTariff : tariffAfter;
    const yearBenefit = savingsPerYear + feedInEnergy * tariff + ongoing - opex;
    cumulative += yearBenefit;
    amortization.push({ year: y, cumulativeCashflow: Math.round(cumulative) });
  }

  const annualBenefit = savingsPerYear + feedInRevenuePerYear + ongoing - opex;
  const netCost = (exp?.totalSystemCost ?? 0) - oneTime;
  const roiYears = annualBenefit > 0 ? netCost / annualBenefit : 0;

  return {
    pvGeneratorKwp: kwp,
    yearlyYieldKwh: yearlyYield,
    performanceRatio: pr,
    selfConsumptionRate,
    selfSufficiencyRate,
    totalConsumptionKwh: consumption,
    eMobilityKwh,
    savingsPerYear,
    feedInRevenuePerYear,
    returnOnInvestmentYears: roiYears,
    co2SavingsKgPerYear: yearlyYield * CO2_FACTOR,
    energyFlow,
    monthly,
    amortization
  };
}

// Converts the subsidy unit to absolute €: € / €/kWp / €/kWh capacity.
function subsidyValue(s: { unit: string; amount: number }, kwp: number, batteryKwh: number): number {
  if (s.unit === '€/kWp') return s.amount * kwp;
  if (s.unit === '€/kWh') return s.amount * batteryKwh;
  return s.amount;
}