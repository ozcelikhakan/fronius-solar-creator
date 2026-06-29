// Wizard data model — collects all data produced by the 8 steps into a single Project object.
// It is kept aligned with the Project type in the GraphQL schema (CLAUDE.md); fields are
// set gradually as the steps are completed, so step blocks are optional.

export interface Customer {
  firstName: string;
  lastName: string;
  phone: string;
  company: string;
  email: string;
}

export interface ProjectSettings {
  currency: string;          // EUR | USD ...
  measurement: 'Metric' | 'Imperial';
  temperature: 'Celsius' | 'Fahrenheit';
  cableStandard: 'ISO' | 'AWG';
}

// Step 1 — Location. Map/coordinates + PVGIS irradiation + grid parameters.
export interface LocationData {
  address: string;
  latitude: number;
  longitude: number;
  // Annual irradiation returned from PVGIS (kWh/m²). Filled automatically.
  solarIrradiance: number | null;
  // User-defined percentage for manually increasing/decreasing irradiation (%) — slider.
  irradianceAdjustment: number;
  grid: {
    inverterCountryApproval: boolean;
    feedInLimitEnabled: boolean;
    feedInLimitPercent: number;       // percentage used when the feed-in limit is enabled
    displacementPowerFactor: number;  // between 1.0 and 0.8
  };
}

// Step 2 — Consumption / Load profile.
// hourlyShares: consumption shares distributed across the 24 hours of the day; total is 1.0.
// It is multiplied by annual kWh and divided by 365 to draw the hourly kW curve. This allows
// profiles with different annual consumption values to be scaled using the same pattern.
export interface LoadProfile {
  id: string;
  name: string;
  annualKwh: number;
  hourlyShares: number[];   // length 24, total approximately 1.0
  color: string;            // used to distinguish overlapping profiles in the chart
}

// Step 2 — E-Mobility sub-step. One electric vehicle + weekly km + 7×24 charging grid.
export interface EvData {
  id: string;
  manufacturer: string;
  model: string;
  // Advanced settings — annual energy demand is calculated from these two values.
  batteryCapacityKwh: number;
  consumptionKwhPer100km: number;
  loadProfile: string;            // charging behavior profile, such as Partly home-office
  showChargingProfile: boolean;
  dailyKm: number[];              // length 7, separate value for each day from Mon to Sun
  chargingGrid: boolean[][];      // 7 days × 24 hours — true = charging, shown in green
}

export interface ConsumptionData {
  profiles: LoadProfile[];
  // "100% feed-in" — all generated energy is fed into the grid; self-consumption is not calculated.
  fullFeedIn: boolean;
  evs: EvData[];
}

// Step 3 — PV array. m² and kWp are calculated automatically from the module count.
export type Mounting = 'Roof' | 'Building integrated' | 'Free-standing';

export interface PvArray {
  id: string;
  manufacturer: string;
  model: string;
  moduleCount: number;
  // Technical values of the selected model — used for m²/kWp calculations.
  modulePowerWp: number;
  moduleAreaM2: number;
  tilt: number;          // module tilt in degrees
  orientation: number;   // azimuth: 0=North, 90=East, 180=South, 270=West
  mounting: Mounting;
}

// Step 4 — Inverter. Selected inverter + filter settings in the right panel.
export type PhaseFilter = 'all' | '1' | '3';

export interface InverterFilter {
  // Target power ratio: PV kWp / inverter AC kW × 100. Typical values: 90 / 110 / 130.
  ratioMin: number;
  ratioTarget: number;
  ratioMax: number;
  minModuleTemp: number;   // °C — used for voltage checks
  maxModuleTemp: number;   // °C
  phases: PhaseFilter;
  currentFactorEnabled: boolean;
  currentFactor: number;
}

export interface InverterData {
  selectedId: string | null;
  recommendation: boolean;   // prioritize / automatically select recommended options
  filter: InverterFilter;
}

// Data for the other steps will be detailed later — kept loosely typed for now.
export interface Project {
  id: string;
  name: string;
  // Project types selected in Wizard 2/3: Residential | Commercial | Battery |
  // E-Mobility | Heating. The E-Mobility sub-step is shown only if E-Mobility exists in this list.
  projectTypes?: string[];
  customer?: Customer;
  settings?: ProjectSettings;
  location?: LocationData;
  consumption?: ConsumptionData;
  pvArrays?: PvArray[];
  inverter?: InverterData;
  sizing?: SizingData;
  components?: ComponentSelection;
  profitability?: ProfitabilityData;
}

// Normalizes the array sum to 1.0 — preserving the ratio of the shares.
function normalize(weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  return weights.map(w => w / sum);
}

// Predefined load profiles in Solar.creator. Raw hourly weights are normalized.
// Evening peak: low at night, small morning peak, high consumption in the evening (18–21).
export const PRESET_PROFILES = [
  {
    key: 'evening-all-week',
    name: 'Mon-Sun: Evening peak consumption',
    annualKwh: 4500,
    color: '#0073b1',
    hourlyShares: normalize([
      2, 2, 1, 1, 1, 2, 3, 5, 4, 3, 3, 3,
      3, 3, 3, 4, 6, 9, 11, 10, 8, 6, 4, 3
    ])
  },
  {
    key: 'evening-weekday-midday-weekend',
    name: 'Mon-Fri: Evening peaks; Sat-Sun: midday peaks',
    annualKwh: 5200,
    color: '#e8830c',
    // Weekday + weekend average: creates noticeable peaks at both midday and evening.
    hourlyShares: normalize([
      2, 2, 1, 1, 1, 2, 3, 4, 5, 6, 7, 8,
      8, 7, 5, 4, 5, 8, 10, 9, 7, 5, 3, 2
    ])
  }
] as const;

// Creates a LoadProfile with a unique id from a preset; the caller provides the id.
export function makePresetProfile(presetKey: string, id: string): LoadProfile {
  const p = PRESET_PROFILES.find(x => x.key === presetKey) ?? PRESET_PROFILES[0];
  return {
    id,
    name: p.name,
    annualKwh: p.annualKwh,
    hourlyShares: [...p.hourlyShares],
    color: p.color
  };
}

export function emptyConsumption(): ConsumptionData {
  return { profiles: [], fullFeedIn: false, evs: [] };
}

// ---- PV module database and helpers -----------------------------------------

export const MOUNTINGS: Mounting[] = ['Roof', 'Building integrated', 'Free-standing'];

// Quick orientation buttons — azimuth degrees; South is optimal in the northern hemisphere.
export const ORIENTATIONS = [
  { label: 'N', deg: 0 },
  { label: 'E', deg: 90 },
  { label: 'S', deg: 180 },
  { label: 'W', deg: 270 }
];

// Module electrical spec — required for temperature compensation in the Sizing step.
// voc/vmp: open-circuit / MPP voltage at 25°C (V); isc/imp: short-circuit / MPP current (A);
// tempCoeffVoltage: voltage temperature coefficient (1/°C, negative).
export interface PvModuleSpec {
  model: string;
  powerWp: number;
  areaM2: number;
  voc25: number;
  vmp25: number;
  isc25: number;
  imp25: number;
  tempCoeffVoltage: number;
}

// Small module database: manufacturer → models, with power + area + electrical spec.
export const PV_MODULE_DB: { manufacturer: string; models: PvModuleSpec[] }[] = [
  {
    manufacturer: 'Meyer Burger',
    models: [
      { model: 'White 400', powerWp: 400, areaM2: 1.85, voc25: 39.3, vmp25: 32.9, isc25: 12.9, imp25: 12.16, tempCoeffVoltage: -0.0024 },
      { model: 'Black 390', powerWp: 390, areaM2: 1.85, voc25: 38.9, vmp25: 32.5, isc25: 12.7, imp25: 12.0, tempCoeffVoltage: -0.0024 }
    ]
  },
  {
    manufacturer: 'LONGi',
    models: [
      { model: 'Hi-MO 6 410', powerWp: 410, areaM2: 1.94, voc25: 37.4, vmp25: 31.3, isc25: 13.9, imp25: 13.1, tempCoeffVoltage: -0.0025 },
      { model: 'Hi-MO 6 430', powerWp: 430, areaM2: 1.94, voc25: 38.0, vmp25: 31.8, isc25: 14.2, imp25: 13.5, tempCoeffVoltage: -0.0025 }
    ]
  },
  {
    manufacturer: 'JA Solar',
    models: [{ model: 'DeepBlue 4.0 420', powerWp: 420, areaM2: 1.95, voc25: 37.6, vmp25: 31.4, isc25: 14.1, imp25: 13.4, tempCoeffVoltage: -0.0026 }]
  },
  {
    manufacturer: 'Q CELLS',
    models: [{ model: 'Q.PEAK DUO ML-G11 400', powerWp: 400, areaM2: 1.88, voc25: 37.0, vmp25: 31.0, isc25: 13.8, imp25: 12.9, tempCoeffVoltage: -0.0027 }]
  }
];

// Finds the electrical spec of the selected module in a PV array, used for the Sizing calculation.
export function findModuleSpec(manufacturer: string, model: string): PvModuleSpec | null {
  return PV_MODULE_DB.find(b => b.manufacturer === manufacturer)?.models.find(m => m.model === model) ?? null;
}

// ---- Inverter database: Fronius GEN24 family + commercial -------------------

export interface InverterSpec {
  id: string;
  model: string;
  mppVoltageMin: number;   // V
  mppVoltageMax: number;   // V
  maxPowerAcW: number;     // nominal AC output power (W)
  pvInputPowerWp: number;  // allowed maximum DC input power (Wp)
  mpptCount: number;       // number of MPP trackers
  phases: 1 | 3;
  hybrid: boolean;         // battery supported
  datasheetUrl: string;
}

// Realistic specs derived from the model list in CLAUDE.md.
// The wide AC power range is intentional so the power-ratio filter works meaningfully.
export const INVERTER_DB: InverterSpec[] = [
  { id: 'primo-gen24-3.0-plus', model: 'Primo GEN24 3.0 Plus', mppVoltageMin: 80, mppVoltageMax: 800, maxPowerAcW: 3000, pvInputPowerWp: 4500, mpptCount: 2, phases: 1, hybrid: true, datasheetUrl: 'https://www.fronius.com' },
  { id: 'symo-gen24-3.0', model: 'Symo GEN24 3.0', mppVoltageMin: 80, mppVoltageMax: 800, maxPowerAcW: 3000, pvInputPowerWp: 4500, mpptCount: 2, phases: 3, hybrid: false, datasheetUrl: 'https://www.fronius.com' },
  { id: 'symo-gen24-3.0-plus', model: 'Symo GEN24 3.0 Plus', mppVoltageMin: 80, mppVoltageMax: 800, maxPowerAcW: 3000, pvInputPowerWp: 4500, mpptCount: 2, phases: 3, hybrid: true, datasheetUrl: 'https://www.fronius.com' },
  { id: 'symo-gen24-5.0-plus', model: 'Symo GEN24 5.0 Plus', mppVoltageMin: 80, mppVoltageMax: 800, maxPowerAcW: 5000, pvInputPowerWp: 7500, mpptCount: 2, phases: 3, hybrid: true, datasheetUrl: 'https://www.fronius.com' },
  { id: 'symo-gen24-6.0-plus', model: 'Symo GEN24 6.0 Plus', mppVoltageMin: 80, mppVoltageMax: 800, maxPowerAcW: 6000, pvInputPowerWp: 9000, mpptCount: 2, phases: 3, hybrid: true, datasheetUrl: 'https://www.fronius.com' },
  { id: 'symo-gen24-8.0-plus', model: 'Symo GEN24 8.0 Plus', mppVoltageMin: 80, mppVoltageMax: 800, maxPowerAcW: 8000, pvInputPowerWp: 12000, mpptCount: 2, phases: 3, hybrid: true, datasheetUrl: 'https://www.fronius.com' },
  { id: 'symo-gen24-10.0-plus', model: 'Symo GEN24 10.0 Plus', mppVoltageMin: 80, mppVoltageMax: 800, maxPowerAcW: 10000, pvInputPowerWp: 15000, mpptCount: 2, phases: 3, hybrid: true, datasheetUrl: 'https://www.fronius.com' },
  { id: 'tauro-50-3-d', model: 'Fronius Tauro 50-3-D', mppVoltageMin: 200, mppVoltageMax: 1000, maxPowerAcW: 50000, pvInputPowerWp: 75000, mpptCount: 3, phases: 3, hybrid: false, datasheetUrl: 'https://www.fronius.com' },
  { id: 'genevo-l-3p-15-h', model: 'GENEVO L-3P-15-H', mppVoltageMin: 200, mppVoltageMax: 1000, maxPowerAcW: 15000, pvInputPowerWp: 22500, mpptCount: 2, phases: 3, hybrid: true, datasheetUrl: 'https://www.fronius.com' }
];

// Step 5 — Sizing. The result table is calculated from inverter + PV data and is derived, not stored;
// the only stored data here is the Cable loss sub-step settings.
export interface SizingData {
  cableLossPercent: number;   // total cable loss percentage, default 2
  useCableLoss: boolean;      // "Use total power loss through wiring" toggle
}

export function emptySizing(): SizingData {
  return { cableLossPercent: 2, useCableLoss: true };
}

// Step 7 — Profitability.
export type SubsidyType = 'one-time' | 'ongoing';
export type SubsidyUnit = '€' | '€/kWp' | '€/kWh';

export interface Subsidy {
  id: string;
  type: SubsidyType;
  unit: SubsidyUnit;
  amount: number;
}

export type ElectricityUnit = 'Month' | 'Year' | 'kWh';

export interface CustomCost {
  id: string;
  label: string;
  amount: number;
}

export interface ProfitabilityData {
  revenues: {
    feedInTariff: number;        // €/kWh
    feedInDurationYears: number;
    feedInTariffAfter: number;   // €/kWh after the duration ends
    subsidies: Subsidy[];
  };
  expenses: {
    electricityCost: number;
    electricityUnit: ElectricityUnit;
    totalSystemCost: number;     // €
    calculationPeriodYears: number;
    opexAnnual: number;          // fixed annual expense (€)
    customCosts: CustomCost[];
  };
}

// Realistic defaults suitable for the Austria context.
export function emptyProfitability(): ProfitabilityData {
  return {
    revenues: {
      feedInTariff: 0.08,
      feedInDurationYears: 20,
      feedInTariffAfter: 0.05,
      subsidies: []
    },
    expenses: {
      electricityCost: 0.25,
      electricityUnit: 'kWh',
      totalSystemCost: 12000,
      calculationPeriodYears: 20,
      opexAnnual: 100,
      customCosts: []
    }
  };
}

// Step 6 — Components. The component selected from each sub-step.
export interface ComponentSelection {
  batteryModel: string | null;
  batteryUnits: number;            // number of cascaded units
  backupModel: string | null;
  smartMeterModel: string | null;
  smartMeterRecommendation: boolean;
  chargingBoxModel: string | null; // only for E-Mobility projects
}

export function emptyComponents(): ComponentSelection {
  return {
    batteryModel: null,
    batteryUnits: 1,
    backupModel: null,
    smartMeterModel: 'sm-ip',     // recommended Smart Meter IP preselected
    smartMeterRecommendation: true,
    chargingBoxModel: null
  };
}

export function emptyInverterData(): InverterData {
  return {
    selectedId: null,
    recommendation: true,
    filter: {
      ratioMin: 90,
      ratioTarget: 110,
      ratioMax: 130,
      minModuleTemp: -10,
      maxModuleTemp: 70,
      phases: 'all',
      currentFactorEnabled: false,
      currentFactor: 1.0
    }
  };
}

// New PV array — default first manufacturer/model, south-facing, 30° tilt, roof-mounted.
export function makePvArray(id: string): PvArray {
  const first = PV_MODULE_DB[0];
  const m = first.models[0];
  return {
    id,
    manufacturer: first.manufacturer,
    model: m.model,
    moduleCount: 10,
    modulePowerWp: m.powerWp,
    moduleAreaM2: m.areaM2,
    tilt: 30,
    orientation: 180, // South
    mounting: 'Roof'
  };
}

// ---- E-Mobility database and helpers ----------------------------------------

// Wattpilot reference charging power (kW) — the "Rewrite" grid is filled based on this power.
export const EV_CHARGING_POWER_KW = 11;

export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Charging behavior profiles — matching the predefined options in Solar.creator.
export const EV_LOAD_PROFILES = [
  'Partly home-office',
  'Commuter (evening charging)',
  'Home all day',
  'Night charging'
];

// Small EV database: manufacturer → models, with battery kWh + consumption kWh/100km.
export const EV_DB = [
  {
    manufacturer: 'Tesla',
    models: [
      { model: 'Model 3', batteryCapacityKwh: 60, consumptionKwhPer100km: 15 },
      { model: 'Model Y', batteryCapacityKwh: 75, consumptionKwhPer100km: 16.5 }
    ]
  },
  {
    manufacturer: 'Volkswagen',
    models: [
      { model: 'ID.3', batteryCapacityKwh: 58, consumptionKwhPer100km: 15.5 },
      { model: 'ID.4', batteryCapacityKwh: 77, consumptionKwhPer100km: 17 }
    ]
  },
  {
    manufacturer: 'BMW',
    models: [
      { model: 'i4', batteryCapacityKwh: 80, consumptionKwhPer100km: 16 },
      { model: 'iX3', batteryCapacityKwh: 74, consumptionKwhPer100km: 18.5 }
    ]
  },
  {
    manufacturer: 'Hyundai',
    models: [{ model: 'IONIQ 5', batteryCapacityKwh: 72, consumptionKwhPer100km: 17 }]
  }
] as const;

// New EV — default first manufacturer/model + empty charging grid, all false.
export function makeEv(id: string): EvData {
  const first = EV_DB[0];
  const firstModel = first.models[0];
  return {
    id,
    manufacturer: first.manufacturer,
    model: firstModel.model,
    batteryCapacityKwh: firstModel.batteryCapacityKwh,
    consumptionKwhPer100km: firstModel.consumptionKwhPer100km,
    loadProfile: EV_LOAD_PROFILES[0],
    showChargingProfile: false,
    dailyKm: [40, 40, 40, 40, 40, 20, 10], // typical weekday/weekend default
    chargingGrid: Array.from({ length: 7 }, () => new Array(24).fill(false))
  };
}

// "Rewrite →" — recalculates the required charging hours from daily km and rewrites the grid.
// Required kWh = km/100 × consumption; hours = kWh / charging power. Starting from 18:00,
// it marks hours forward through the night, wrapping past midnight if needed.
export function rewriteChargingGrid(ev: EvData): boolean[][] {
  return ev.dailyKm.map(km => {
    const row = new Array(24).fill(false);
    const dailyKwh = (km / 100) * ev.consumptionKwhPer100km;
    const hours = Math.min(24, Math.ceil(dailyKwh / EV_CHARGING_POWER_KW));
    for (let h = 0; h < hours; h++) {
      row[(18 + h) % 24] = true;
    }
    return row;
  });
}

// ---- Component databases, Step 6 --------------------------------------------

export interface BatterySpec {
  id: string;
  model: string;
  series: 'Reserva' | 'Reserva Pro' | 'BYD';
  capacityWh: number;
  dischargingPowerKw: number;
}

// Fronius Reserva / Reserva Pro series + BYD — CLAUDE.md product list.
export const BATTERY_DB: BatterySpec[] = [
  { id: 'reserva-6.3', model: 'Reserva 6.3', series: 'Reserva', capacityWh: 6310, dischargingPowerKw: 2.87 },
  { id: 'reserva-9.5', model: 'Reserva 9.5', series: 'Reserva', capacityWh: 9470, dischargingPowerKw: 3.0 },
  { id: 'reserva-12.6', model: 'Reserva 12.6', series: 'Reserva', capacityWh: 12630, dischargingPowerKw: 3.0 },
  { id: 'reserva-15.8', model: 'Reserva 15.8', series: 'Reserva', capacityWh: 15790, dischargingPowerKw: 3.0 },
  { id: 'reserva-pro-12', model: 'Reserva Pro 12', series: 'Reserva Pro', capacityWh: 11960, dischargingPowerKw: 2.98 },
  { id: 'reserva-pro-16', model: 'Reserva Pro 16', series: 'Reserva Pro', capacityWh: 15950, dischargingPowerKw: 3.0 },
  { id: 'reserva-pro-20', model: 'Reserva Pro 20', series: 'Reserva Pro', capacityWh: 19940, dischargingPowerKw: 3.0 },
  { id: 'reserva-pro-24', model: 'Reserva Pro 24', series: 'Reserva Pro', capacityWh: 23930, dischargingPowerKw: 3.0 },
  { id: 'reserva-pro-28', model: 'Reserva Pro 28', series: 'Reserva Pro', capacityWh: 27920, dischargingPowerKw: 3.0 },
  { id: 'reserva-pro-32', model: 'Reserva Pro 32', series: 'Reserva Pro', capacityWh: 31900, dischargingPowerKw: 3.0 },
  { id: 'byd-hvs-12.8', model: 'BYD Battery Box HVS+ 12.8', series: 'BYD', capacityWh: 12800, dischargingPowerKw: 3.0 }
];

// Backup components — in reality, filtered by location.
export const BACKUP_DB = [
  { id: 'pv-point', model: 'PV Point', description: 'Single-phase emergency output during grid outages' },
  { id: 'pv-point-comfort', model: 'PV Point Comfort', description: 'Backup supply with automatic switching' },
  { id: 'full-backup', model: 'Full Backup', description: 'Whole-home panel backup' }
];

// Smart Meter models.
export interface SmartMeterSpec {
  id: string;
  model: string;
  phases: number;
  maxCurrentA: number;
  currentTransformer: boolean;
  recommended: boolean;
}

export const SMART_METER_DB: SmartMeterSpec[] = [
  { id: 'sm-ip', model: 'Smart Meter IP', phases: 3, maxCurrentA: 5000, currentTransformer: true, recommended: true },
  { id: 'sm-ts-100a-1', model: 'Smart Meter TS 100A-1', phases: 1, maxCurrentA: 100, currentTransformer: false, recommended: false },
  { id: 'sm-ts-65a-3', model: 'Smart Meter TS 65A-3', phases: 3, maxCurrentA: 65, currentTransformer: false, recommended: false },
  { id: 'sm-wr-100-600v-3', model: 'Smart Meter WR 100-600V-3', phases: 3, maxCurrentA: 6000, currentTransformer: true, recommended: false }
];

// Fronius Wattpilot charging boxes, only for E-Mobility projects.
export const WATTPILOT_DB = [
  { id: 'wattpilot-go-11', model: 'Wattpilot Go 11kW-3ph', phases: 3, powerKw: 11, type: 'Mobile' },
  { id: 'wattpilot-home-11', model: 'Wattpilot Home 11kW', phases: 3, powerKw: 11, type: 'Fixed installation' }
];

// Empty initial value for the Location step — Austria (Fronius headquarters) is the default.
export function emptyLocation(): LocationData {
  return {
    address: '',
    latitude: 48.2082,   // default around Wels/Vienna
    longitude: 14.0249,
    solarIrradiance: null,
    irradianceAdjustment: 0,
    grid: {
      inverterCountryApproval: true,
      feedInLimitEnabled: false,
      feedInLimitPercent: 70,
      displacementPowerFactor: 1.0
    }
  };
}