import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectStateService } from '../../../core/services/project-state.service';
import {
  INVERTER_DB,
  InverterData,
  InverterFilter,
  InverterSpec,
  emptyInverterData
} from '../../../core/models/project.model';

// Inverter row with the calculated power ratio and whether it is recommended.
interface InverterRow {
  spec: InverterSpec;
  ratio: number;        // PV kWp / inverter AC kW × 100
  recommended: boolean; // whether the ratio is within the target range
}

// Step 4 — Inverter. Inverter list on the left: ratio + Hybrid label + datasheet,
// filter panel on the right: target ratio, module temperature, phase, current factor.
// When "Recommendation" is enabled, the inverter closest to the target ratio is selected automatically.
@Component({
  selector: 'app-inverter',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './inverter.component.html',
  styleUrl: './inverter.component.scss'
})
export class InverterComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private state = inject(ProjectStateService);

  data = signal<InverterData>(emptyInverterData());

  // Total PV power from the previous step (kWp) — numerator for the ratio calculation.
  totalPvKwp = computed(() =>
    (this.state.pvArrays() ?? []).reduce((s, a) => s + (a.moduleCount * a.modulePowerWp) / 1000, 0)
  );

  constructor() {
    const id = this.route.parent?.snapshot.paramMap.get('id') ?? '';
    if (!this.state.project()) this.state.initLocal(id, 'sc-local');

    const existing = this.state.inverter();
    if (existing) this.data.set({ ...existing, filter: { ...existing.filter } });
  }

  // Inverter list to be displayed, calculated using the phase filter and power ratio.
  rows = computed<InverterRow[]>(() => {
    const f = this.data().filter;
    const pvKwp = this.totalPvKwp();

    return INVERTER_DB
      .filter(spec => f.phases === 'all' || spec.phases === +f.phases)
      .map(spec => {
        const ratio = pvKwp > 0 ? (pvKwp * 1000 * 100) / spec.maxPowerAcW : 0;
        return {
          spec,
          ratio,
          recommended: ratio >= f.ratioMin && ratio <= f.ratioMax
        };
      });
  });

  // When "Recommendation" is enabled, find the recommended inverter closest to the target ratio.
  private bestRecommendedId(): string | null {
    const f = this.data().filter;
    const recommended = this.rows().filter(r => r.recommended);
    if (!recommended.length) return null;
    return recommended.reduce((best, r) =>
      Math.abs(r.ratio - f.ratioTarget) < Math.abs(best.ratio - f.ratioTarget) ? r : best
    ).spec.id;
  }

  // ---- Selection & filter ---------------------------------------------------

  select(id: string): void {
    this.data.update(d => ({ ...d, selectedId: id }));
  }

  toggleRecommendation(on: boolean): void {
    // When enabled, automatically select the best matching inverter; when disabled, keep the user's selection.
    this.data.update(d => ({
      ...d,
      recommendation: on,
      selectedId: on ? this.bestRecommendedId() ?? d.selectedId : d.selectedId
    }));
  }

  patchFilter(partial: Partial<InverterFilter>): void {
    this.data.update(d => ({ ...d, filter: { ...d.filter, ...partial } }));
  }

  // "Calculate module temperature" — applies simple default limits.
  // In reality, this is calculated from location/climate; CLAUDE.md voltage check uses -10°C / 70°C.
  calculateModuleTemp(): void {
    this.patchFilter({ minModuleTemp: -10, maxModuleTemp: 70 });
  }

  // ---- Navigation -----------------------------------------------------------

  back(): void {
    const id = this.route.parent?.snapshot.paramMap.get('id') ?? '';
    this.router.navigate(['/projects', id, 'pv-arrays']);
  }

  // Both "Manual sizing" and "Start calculation" go to the Sizing step;
  // Sizing contains its own manual/result sub-steps.
  manualSizing(): void {
    this.goToSizing();
  }

  startCalculation(): void {
    this.goToSizing();
  }

  private goToSizing(): void {
    this.state.saveInverter(this.data());
    const id = this.route.parent?.snapshot.paramMap.get('id') ?? '';
    this.router.navigate(['/projects', id, 'sizing']);
  }
}