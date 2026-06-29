import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectStateService } from '../../../core/services/project-state.service';
import {
  BACKUP_DB,
  BATTERY_DB,
  ComponentSelection,
  SMART_METER_DB,
  WATTPILOT_DB,
  emptyComponents
} from '../../../core/models/project.model';

// Step 6 — Components. Sub-steps: Battery / Backup / Smart meter / Charging box.
// Charging box is shown only if E-Mobility is selected in the project type.
@Component({
  selector: 'app-components',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './component.component.html',
  styleUrl: './component.component.scss'
})
export class ComponentsComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private state = inject(ProjectStateService);

  readonly batteries = BATTERY_DB;
  readonly backups = BACKUP_DB;
  readonly smartMeters = SMART_METER_DB;
  readonly wattpilots = WATTPILOT_DB;

  data = signal<ComponentSelection>(emptyComponents());
  subStep = signal<'battery' | 'backup' | 'meter' | 'charging'>('battery');
  // Expanded battery detail row (chevron) — id of the currently open battery.
  expandedBattery = signal<string | null>(null);

  hasEmobility = computed(() =>
    (this.state.project()?.projectTypes ?? []).includes('E-Mobility')
  );

  // Total cascaded capacity: selected battery × number of units.
  totalCapacityWh = computed(() => {
    const b = BATTERY_DB.find(x => x.id === this.data().batteryModel);
    return b ? b.capacityWh * this.data().batteryUnits : 0;
  });

  // When Smart meter "Recommendation" is enabled, only the recommended model is shown.
  visibleMeters = computed(() =>
    this.data().smartMeterRecommendation ? SMART_METER_DB.filter(m => m.recommended) : SMART_METER_DB
  );

  constructor() {
    const id = this.route.parent?.snapshot.paramMap.get('id') ?? '';
    if (!this.state.project()) this.state.initLocal(id, 'sc-local');

    const existing = this.state.components();
    if (existing) this.data.set({ ...existing });
  }

  // ---- Selection ------------------------------------------------------------

  patch(partial: Partial<ComponentSelection>): void {
    this.data.update(d => ({ ...d, ...partial }));
  }

  selectBattery(id: string): void {
    // Clicking the same battery again clears the selection, allowing a system without a battery.
    this.patch({ batteryModel: this.data().batteryModel === id ? null : id });
  }

  toggleExpand(id: string): void {
    this.expandedBattery.set(this.expandedBattery() === id ? null : id);
  }

  // ---- Navigation -----------------------------------------------------------

  back(): void {
    const id = this.route.parent?.snapshot.paramMap.get('id') ?? '';
    this.router.navigate(['/projects', id, 'sizing']);
  }

  saveAndNext(): void {
    this.state.saveComponents(this.data());
    const id = this.route.parent?.snapshot.paramMap.get('id') ?? '';
    this.router.navigate(['/projects', id, 'profitability']);
  }
}