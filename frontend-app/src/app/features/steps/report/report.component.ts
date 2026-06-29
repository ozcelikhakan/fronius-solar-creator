import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectStateService } from '../../../core/services/project-state.service';
import { computeSimulation, SimulationResult } from '../../../core/simulation/simulation-calc';
import { computeSizing, SizingResult } from '../../../core/sizing/sizing-calc';
import { ReportApiService } from '../../../core/services/report-api.service';
import { DonutChartComponent, DonutSegment } from '../../../shared/donut-chart/donut-chart.component';
import {
  BACKUP_DB,
  BATTERY_DB,
  INVERTER_DB,
  SMART_METER_DB,
  WATTPILOT_DB
} from '../../../core/models/project.model';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

// Geometry of a single bar in the chart, as height percentage.
interface MonthBar {
  label: string;
  productionPct: number;
  consumptionPct: number;
}

interface AmortBar {
  year: number;
  // Upward/downward height relative to the zero line, as percentage — negative values are below.
  abovePct: number;
  belowPct: number;
  positive: boolean;
}

// Step 8 — Report output page. Collects data from all steps, calculates the simulation,
// and displays it as a single-scroll report. Persistent header stays fixed at the top.
// NOTE: Charts such as energy flow, donut, bar, and amortization will be added in Part 9b.
@Component({
  selector: 'app-report',
  standalone: true,
  imports: [FormsModule, DecimalPipe, DonutChartComponent],
  templateUrl: './report.component.html',
  styleUrl: './report.component.scss'
})
export class ReportComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private state = inject(ProjectStateService);
  private reportApi = inject(ReportApiService);

  // Internal installer note — not shown in the customer report; kept for informational purposes.
  note = signal('');
  // PDF generation status/warning message, used for feedback when the backend is offline.
  reportMsg = signal<string | null>(null);
  downloading = signal(false);

  project = this.state.project;

  // Simulation result derived from all steps.
  result = computed<SimulationResult | null>(() => {
    const p = this.state.project();
    return p ? computeSimulation(p) : null;
  });

  constructor() {
    const id = this.route.parent?.snapshot.paramMap.get('id') ?? '';
    if (!this.state.project()) this.state.initLocal(id, 'sc-local');
  }

  // ---- Chart data -----------------------------------------------------------

  // Production donut, where generated energy goes — center: self-consumption percentage.
  productionSegments = computed<DonutSegment[]>(() => {
    const f = this.result()?.energyFlow;
    if (!f) return [];
    return [
      { label: 'Direct use', value: f.directUse, color: '#0073b1' },
      { label: 'Storage', value: f.storage, color: '#16a34a' },
      { label: 'E-Mobility', value: f.eMobility, color: '#7c3aed' },
      { label: 'Power to grid', value: f.toGrid, color: '#e8830c' }
    ];
  });

  // Self-sufficiency donut, how consumption is covered — consumption shares.
  selfSufficiencySegments = computed<DonutSegment[]>(() => {
    const r = this.result();
    if (!r || r.totalConsumptionKwh <= 0) return [];
    const prod = r.yearlyYieldKwh;
    const cons = r.totalConsumptionKwh;
    const directOfCons = (r.energyFlow.directUse * prod + r.energyFlow.eMobility * prod) / cons;
    const storageOfCons = (r.energyFlow.storage * prod) / cons;
    return [
      { label: 'Direct use', value: directOfCons, color: '#0073b1' },
      { label: 'Storage', value: storageOfCons, color: '#16a34a' },
      { label: 'Power from grid', value: r.energyFlow.fromGrid, color: '#9ca3af' }
    ];
  });

  // Consumption Overview donut — Household vs E-Mobility.
  consumptionSegments = computed<DonutSegment[]>(() => {
    const r = this.result();
    if (!r || r.totalConsumptionKwh <= 0) return [];
    const ev = r.eMobilityKwh;
    return [
      { label: 'Household', value: r.totalConsumptionKwh - ev, color: '#0073b1' },
      { label: 'E-Mobility', value: ev, color: '#7c3aed' }
    ];
  });

  // Monthly production/consumption bar chart, using a shared scale.
  monthlyBars = computed<MonthBar[]>(() => {
    const m = this.result()?.monthly;
    if (!m) return [];
    const max = Math.max(...m.flatMap(x => [x.production, x.consumption]), 1);
    return m.map((x, i) => ({
      label: MONTHS[i],
      productionPct: (x.production / max) * 100,
      consumptionPct: (x.consumption / max) * 100
    }));
  });

  // Amortization bar chart — above zero for positive values, below zero for negative values.
  amortBars = computed<AmortBar[]>(() => {
    const a = this.result()?.amortization;
    if (!a) return [];
    const max = Math.max(...a.map(p => p.cumulativeCashflow), 0);
    const min = Math.min(...a.map(p => p.cumulativeCashflow), 0);
    const span = max - min || 1;
    return a.map(p => ({
      year: p.year,
      abovePct: p.cumulativeCashflow > 0 ? (p.cumulativeCashflow / span) * 100 : 0,
      belowPct: p.cumulativeCashflow < 0 ? (-p.cumulativeCashflow / span) * 100 : 0,
      positive: p.cumulativeCashflow >= 0
    }));
  });

  // Vertical position of the zero line inside the chart, as percentage — ratio of the positive area.
  amortZeroLine = computed(() => {
    const a = this.result()?.amortization;
    if (!a) return 50;
    const max = Math.max(...a.map(p => p.cumulativeCashflow), 0);
    const min = Math.min(...a.map(p => p.cumulativeCashflow), 0);
    const span = max - min || 1;
    return (max / span) * 100;
  });

  // ---- PV arrays / Sizing / Components summaries ----------------------------

  pvArrays = computed(() => this.state.pvArrays() ?? []);

  // Sizing result for the selected inverter, used in the Report for string×module and detail table.
  sizingResult = computed<SizingResult | null>(() => {
    const inv = this.state.inverter();
    const inverter = INVERTER_DB.find(i => i.id === inv?.selectedId);
    if (!inverter) return null;
    const f = inv?.filter;
    return computeSizing(inverter, this.pvArrays(), {
      min: f?.ratioMin ?? 90,
      max: f?.ratioMax ?? 130
    });
  });

  // Full records of selected components, used for product cards.
  battery = computed(() => BATTERY_DB.find(b => b.id === this.state.components()?.batteryModel) ?? null);
  batteryUnits = computed(() => this.state.components()?.batteryUnits ?? 1);
  smartMeter = computed(() => SMART_METER_DB.find(m => m.id === this.state.components()?.smartMeterModel) ?? null);
  wattpilot = computed(() => WATTPILOT_DB.find(w => w.id === this.state.components()?.chargingBoxModel) ?? null);
  backup = computed(() => BACKUP_DB.find(b => b.id === this.state.components()?.backupModel) ?? null);

  // Orientation label per module, shown as N/E/S/W on the PV array card.
  orientationLabel(deg: number): string {
    const map: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
    return map[deg] ?? `${deg}°`;
  }

  // ---- Navigation & PDF -----------------------------------------------------

  back(): void {
    const id = this.route.parent?.snapshot.paramMap.get('id') ?? '';
    this.router.navigate(['/projects', id, 'profitability']);
  }

  // Download → sends ReportData to report-service and downloads the returned PDF in the browser.
  download(): void {
    const r = this.result();
    const p = this.state.project();
    if (!r || !p) return;

    this.downloading.set(true);
    this.reportMsg.set(null);

    this.reportApi.generateAndDownload({
      projectName: p.name,
      customerFirstName: p.customer?.firstName ?? '',
      customerLastName: p.customer?.lastName ?? '',
      customerCompany: p.customer?.company ?? null,
      customerEmail: p.customer?.email ?? null,
      projectDate: '', // stamped on the backend side; Date.now() cannot be used here
      latitude: p.location?.latitude ?? 0,
      longitude: p.location?.longitude ?? 0,
      address: p.location?.address ?? null,
      irradianceKwhM2: p.location?.solarIrradiance ?? 0,
      peakPowerKwp: r.pvGeneratorKwp,
      yearlyYieldKwh: r.yearlyYieldKwh,
      selfConsumptionRate: r.selfConsumptionRate,
      selfSufficiencyRate: r.selfSufficiencyRate,
      performanceRatio: r.performanceRatio,
      savingsPerYear: r.savingsPerYear,
      feedInRevenue: r.feedInRevenuePerYear,
      returnOnInvestmentMonths: r.returnOnInvestmentYears * 12,
      co2SavingsKgPerYear: r.co2SavingsKgPerYear,
      totalSystemCostEur: p.profitability?.expenses?.totalSystemCost ?? 0,
      monthlyData: r.monthly.map((m, i) => ({ month: i + 1, productionKwh: m.production, consumptionKwh: m.consumption })),
      amortizationData: r.amortization.map(a => ({ year: a.year, cumulativeSavings: a.cumulativeCashflow, cumulativeCost: 0 }))
    }).subscribe({
      next: blob => {
        this.triggerDownload(blob, `${p.name || 'fronius-report'}.pdf`);
        this.downloading.set(false);
      },
      error: () => {
        this.reportMsg.set('PDF could not be generated. report-service may not be running.');
        this.downloading.set(false);
      }
    });
  }

  // Triggers browser download for the Blob, using a temporary <a> element and object URL.
  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  sendReport(): void {
    // Email sending will be handled through notification-service on the backend side.
    this.reportMsg.set('Report sending is handled through notification-service on the backend.');
  }
}