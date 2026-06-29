import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectStateService } from '../../../core/services/project-state.service';
import {
  MOUNTINGS,
  Mounting,
  ORIENTATIONS,
  PV_MODULE_DB,
  PvArray,
  makePvArray
} from '../../../core/models/project.model';

// Step 3 — PV arrays. One or more PV module arrays: manufacturer/model selection,
// module count, with m² and kWp calculated automatically, tilt, orientation,
// azimuth plus N/E/S/W quick buttons, and mounting type.
// The total power of all arrays is shown at the top.
@Component({
  selector: 'app-pv-arrays',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './pv-arrays.component.html',
  styleUrl: './pv-arrays.component.scss'
})
export class PvArraysComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private state = inject(ProjectStateService);

  readonly moduleDb = PV_MODULE_DB;
  readonly mountings = MOUNTINGS;
  readonly orientations = ORIENTATIONS;

  arrays = signal<PvArray[]>([]);
  private idCounter = 0;

  // Total installed power of all arrays (kWp) — summary in the step header.
  totalKwp = computed(() =>
    this.arrays().reduce((s, a) => s + (a.moduleCount * a.modulePowerWp) / 1000, 0)
  );

  constructor() {
    const id = this.route.parent?.snapshot.paramMap.get('id') ?? '';
    if (!this.state.project()) this.state.initLocal(id, 'sc-local');

    const existing = this.state.pvArrays();
    if (existing?.length) {
      this.arrays.set(existing.map(a => ({ ...a })));
      this.idCounter = existing.length;
    }
  }

  // ---- Array management -----------------------------------------------------

  addArray(): void {
    this.arrays.update(list => [...list, makePvArray(`pv-${this.idCounter++}`)]);
  }

  removeArray(id: string): void {
    this.arrays.update(list => list.filter(a => a.id !== id));
  }

  update(id: string, partial: Partial<PvArray>): void {
    this.arrays.update(list => list.map(a => (a.id === id ? { ...a, ...partial } : a)));
  }

  // When the manufacturer changes, jump to its first model and apply its power/area values.
  onManufacturerChange(id: string, manufacturer: string): void {
    const brand = PV_MODULE_DB.find(b => b.manufacturer === manufacturer) ?? PV_MODULE_DB[0];
    const m = brand.models[0];
    this.update(id, { manufacturer, model: m.model, modulePowerWp: m.powerWp, moduleAreaM2: m.areaM2 });
  }

  onModelChange(id: string, manufacturer: string, model: string): void {
    const brand = PV_MODULE_DB.find(b => b.manufacturer === manufacturer);
    const m = brand?.models.find(x => x.model === model);
    this.update(id, m ? { model, modulePowerWp: m.powerWp, moduleAreaM2: m.areaM2 } : { model });
  }

  modelsFor(manufacturer: string): readonly { model: string }[] {
    return PV_MODULE_DB.find(b => b.manufacturer === manufacturer)?.models ?? [];
  }

  setMounting(id: string, mounting: Mounting): void {
    this.update(id, { mounting });
  }

  // ---- Automatically calculated values per array ----------------------------

  arrayKwp(a: PvArray): number {
    return (a.moduleCount * a.modulePowerWp) / 1000;
  }

  arrayArea(a: PvArray): number {
    return a.moduleCount * a.moduleAreaM2;
  }

  // ---- Navigation -----------------------------------------------------------

  back(): void {
    const id = this.route.parent?.snapshot.paramMap.get('id') ?? '';
    this.router.navigate(['/projects', id, 'consumption']);
  }

  saveAndNext(): void {
    this.state.savePvArrays(this.arrays());
    const id = this.route.parent?.snapshot.paramMap.get('id') ?? '';
    this.router.navigate(['/projects', id, 'inverter']);
  }
}