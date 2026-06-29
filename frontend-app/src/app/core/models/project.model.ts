// Wizard data model — collects all data produced by the 8 steps into a single Project object.
// Sset gradually as the steps are completed, so step blocks are optional.

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

// Data for the other steps will be detailed later — kept loosely typed for now.
export interface Project {
  id: string;
  name: string;
  customer?: Customer;
  settings?: ProjectSettings;
  location?: LocationData;
  consumption?: unknown;
  pvArrays?: unknown[];
  inverter?: unknown;
  sizing?: unknown;
  components?: unknown;
  profitability?: unknown;
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