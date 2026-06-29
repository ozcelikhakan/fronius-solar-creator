import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';

// Matches the ReportData expected by report-service exactly, based on backend ReportData.cs.
export interface ReportData {
  projectName: string;
  customerFirstName: string;
  customerLastName: string;
  customerCompany?: string | null;
  customerEmail?: string | null;
  projectDate: string;
  latitude: number;
  longitude: number;
  address?: string | null;
  irradianceKwhM2: number;
  peakPowerKwp: number;
  yearlyYieldKwh: number;
  selfConsumptionRate: number;
  selfSufficiencyRate: number;
  performanceRatio: number;
  savingsPerYear: number;
  feedInRevenue: number;
  returnOnInvestmentMonths: number;
  co2SavingsKgPerYear: number;
  totalSystemCostEur: number;
  monthlyData: { month: number; productionKwh: number; consumptionKwh: number }[];
  amortizationData: { year: number; cumulativeSavings: number; cumulativeCost: number }[];
}

// PDF report generation/download. report-service works in two steps: first generate,
// which creates the PDF, uploads it to MinIO, and returns objectName; then download streams the PDF.
@Injectable({ providedIn: 'root' })
export class ReportApiService {
  private http = inject(HttpClient);

  // Runs the generate → download chain in a single flow and returns the PDF as a Blob.
  generateAndDownload(data: ReportData) {
    return this.http
      .post<{ objectName: string }>(`${environment.reportApiBase}/generate`, data)
      .pipe(
        switchMap(res =>
          this.http.get(`${environment.reportApiBase}/download/${res.objectName}`, {
            responseType: 'blob'
          })
        )
      );
  }
}