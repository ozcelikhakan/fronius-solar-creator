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
  inverter?: unknown;
  sizing?: unknown;
  components?: unknown;
  profitability?: unknown;
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

// Small module database: manufacturer → models, with power Wp + module area m².
export const PV_MODULE_DB = [
  {
    manufacturer: 'Meyer Burger',
    models: [
      { model: 'White 400', powerWp: 400, areaM2: 1.85 },
      { model: 'Black 390', powerWp: 390, areaM2: 1.85 }
    ]
  },
  {
    manufacturer: 'LONGi',
    models: [
      { model: 'Hi-MO 6 410', powerWp: 410, areaM2: 1.94 },
      { model: 'Hi-MO 6 430', powerWp: 430, areaM2: 1.94 }
    ]
  },
  {
    manufacturer: 'JA Solar',
    models: [{ model: 'DeepBlue 4.0 420', powerWp: 420, areaM2: 1.95 }]
  },
  {
    manufacturer: 'Q CELLS',
    models: [{ model: 'Q.PEAK DUO ML-G11 400', powerWp: 400, areaM2: 1.88 }]
  }
] as const;

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

export const DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

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