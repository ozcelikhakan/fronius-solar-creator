import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectStateService } from '../../../core/services/project-state.service';
import { INVERTER_DB, SizingData, emptySizing } from '../../../core/models/project.model';
import { SizingResult, computeSizing } from '../../../core/sizing/sizing-calc';

// Step 5 — Sizing, the most critical step. Three sub-steps:
//  • Result: string × module table and temperature-compensated voltage table for the selected inverter
//  • Manual sizing: manually change the inverter and recalculate the result
//  • Cable loss: total cable loss percentage
@Component({
  selector: 'app-sizing',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './sizing.component.html',
  styleUrl: './sizing.component.scss'
})
export class SizingComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private state = inject(ProjectStateService);

  subStep = signal<'result' | 'manual' | 'cable'>('result');
  showMore = signal(false);

  // Inverter selection, coming from step 4; it can be overridden in Manual sizing.
  selectedInverterId = signal<string | null>(null);
  sizingData = signal<SizingData>(emptySizing());

  readonly inverterList = INVERTER_DB;

  private arrays = computed(() => this.state.pvArrays() ?? []);
  arraysExist = computed(() => this.arrays().length > 0);

  // Target ratio range — from the inverter filter, or default 90–130 if missing.
  private ratioRange = computed(() => {
    const f = this.state.inverter()?.filter;
    return { min: f?.ratioMin ?? 90, max: f?.ratioMax ?? 130, target: f?.ratioTarget ?? 110 };
  });

  constructor() {
    const id = this.route.parent?.snapshot.paramMap.get('id') ?? '';
    if (!this.state.project()) this.state.initLocal(id, 'sc-local');

    // Take the inverter selection from step 4; if missing, select the one closest to the target ratio.
    const inv = this.state.inverter();
    this.selectedInverterId.set(inv?.selectedId ?? this.bestByRatio());

    const existing = this.state.sizing();
    if (existing) this.sizingData.set({ ...existing });
  }

  // Main calculated result for the selected inverter.
  result = computed<SizingResult | null>(() => {
    const inverter = INVERTER_DB.find(i => i.id === this.selectedInverterId());
    if (!inverter) return null;
    return computeSizing(inverter, this.arrays(), this.ratioRange());
  });

  // Up to 10 alternative inverters, sorted by closeness to the target ratio.
  alternatives = computed<SizingResult[]>(() => {
    const range = this.ratioRange();
    return INVERTER_DB
      .map(i => computeSizing(i, this.arrays(), range))
      .filter((r): r is SizingResult => r !== null)
      .sort((a, b) => Math.abs(a.powerRatio - range.target) - Math.abs(b.powerRatio - range.target))
      .slice(0, 10);
  });

  private bestByRatio(): string | null {
    const alts = this.alternatives();
    return alts.length ? alts[0].inverter.id : null;
  }

  // ---- Interaction ----------------------------------------------------------

  selectInverter(id: string): void {
    this.selectedInverterId.set(id);
  }

  patchSizing(partial: Partial<SizingData>): void {
    this.sizingData.update(s => ({ ...s, ...partial }));
  }

  // ---- Navigation -----------------------------------------------------------

  back(): void {
    const id = this.route.parent?.snapshot.paramMap.get('id') ?? '';
    this.router.navigate(['/projects', id, 'inverter']);
  }

  saveAndNext(): void {
    this.state.saveSizing(this.sizingData());
    const id = this.route.parent?.snapshot.paramMap.get('id') ?? '';
    this.router.navigate(['/projects', id, 'components']);
  }
}