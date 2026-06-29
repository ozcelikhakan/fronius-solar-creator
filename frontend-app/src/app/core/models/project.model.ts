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

export interface ConsumptionData {
  profiles: LoadProfile[];
  // "100% feed-in" — all generated energy is fed into the grid; self-consumption is not calculated.
  fullFeedIn: boolean;
}

// Data for the other steps will be detailed later — kept loosely typed for now.
export interface Project {
  id: string;
  name: string;
  customer?: Customer;
  settings?: ProjectSettings;
  location?: LocationData;
  consumption?: ConsumptionData;
  pvArrays?: unknown[];
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
  return { profiles: [], fullFeedIn: false };
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