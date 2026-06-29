import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

// Irradiance response returned by weather-service, matching the backend IrradianceResult exactly.
// Why a separate service: the irradiance query uses REST, not GraphQL — therefore it is
// kept separate from the Apollo-based ProjectStateService; its only responsibility is
// to call the PVGIS proxy.
export interface IrradianceResponse {
  latitude: number;
  longitude: number;
  address: string | null;
  irradianceKwhM2: number;          // PVGIS annual global horizontal irradiation (kWh/m²)
  increaseDecreaseRate: number | null;
  inverterCountryApproval: boolean;
  feedInLimitPercent: number | null;
  displacementPowerFactor: number;
}

@Injectable({ providedIn: 'root' })
export class WeatherService {
  private http = inject(HttpClient);

  // Fetches PVGIS irradiation for the selected coordinates. If the backend is not running (Windows),
  // the error flows into the RxJS stream; the component catches it and informs the user.
  getIrradiance(lat: number, lon: number) {
    return this.http.get<IrradianceResponse>(environment.irradianceUri, {
      params: { lat: lat.toString(), lon: lon.toString() }
    });
  }
}