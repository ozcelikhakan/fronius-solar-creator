import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectStateService } from '../../../core/services/project-state.service';
import {
  ConsumptionData,
  DAY_LABELS,
  EV_DB,
  EV_LOAD_PROFILES,
  EvData,
  LoadProfile,
  PRESET_PROFILES,
  emptyConsumption,
  makeEv,
  makePresetProfile,
  rewriteChargingGrid
} from '../../../core/models/project.model';

// Monthly consumption weights for the year view — higher in the Austrian climate
// due to winter heating. Sum is approximately 1.0; annual kWh is distributed to months with this.
const SEASONAL = [0.108, 0.099, 0.088, 0.075, 0.066, 0.06, 0.06, 0.063, 0.072, 0.084, 0.097, 0.108];
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

// Chart viewBox dimensions — SVG internal coordinate system, scaled responsively.
const W = 600;
const H = 240;
const PAD = 28;

// Rendered version of a single profile in the chart: area and line paths.
interface Series {
  name: string;
  color: string;
  area: string;
  line: string;
}

@Component({
  selector: 'app-consumption',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './consumption.component.html',
  styleUrl: './consumption.component.scss'
})
export class ConsumptionComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private state = inject(ProjectStateService);

  // Exposed so the template can render preset profile / EV data.
  readonly presets = PRESET_PROFILES;
  readonly evDb = EV_DB;
  readonly evLoadProfiles = EV_LOAD_PROFILES;
  readonly dayLabels = DAY_LABELS;
  readonly hours = Array.from({ length: 24 }, (_, h) => h); // 0..23 — grid columns

  // Local working copy + UI states
  data = signal<ConsumptionData>(emptyConsumption());
  view = signal<'week' | 'year'>('week');
  // Sub-step: whether the load profile or E-Mobility view is shown.
  subStep = signal<'load' | 'emobility'>('load');
  private idCounter = 0;
  private evCounter = 0;

  // The E-Mobility sub-step is accessible only if E-Mobility is selected as a project type.
  hasEmobility = computed(() =>
    (this.state.project()?.projectTypes ?? []).includes('E-Mobility')
  );

  // X-axis labels change depending on the selected view: hours / months.
  xLabels = computed(() => (this.view() === 'week' ? ['0', '6', '12', '18', '24'] : MONTHS));

  // Total annual consumption of all profiles (kWh/Year).
  totalAnnual = computed(() => this.data().profiles.reduce((s, p) => s + (p.annualKwh || 0), 0));

  constructor() {
    // Ensure the project skeleton exists if the backend is offline; the user may not have come from Location.
    const id = this.route.parent?.snapshot.paramMap.get('id') ?? '';
    if (!this.state.project()) this.state.initLocal(id, 'sc-local');

    const existing = this.state.consumption();
    if (existing) {
      this.data.set({
        ...existing,
        profiles: existing.profiles.map(p => ({ ...p })),
        evs: (existing.evs ?? []).map(e => ({ ...e })) // older records may not include evs
      });
      this.idCounter = existing.profiles.length;
      this.evCounter = (existing.evs ?? []).length;
    }
  }

  // ---- Profile management ---------------------------------------------------

  addPreset(key: string): void {
    const profile = makePresetProfile(key, `load-${this.idCounter++}`);
    this.data.update(d => ({ ...d, profiles: [...d.profiles, profile] }));
  }

  // "+ Add load" — adds an empty custom profile with a flat hourly distribution.
  addCustomLoad(): void {
    const flat = new Array(24).fill(1 / 24);
    const profile: LoadProfile = {
      id: `load-${this.idCounter++}`,
      name: 'Custom load',
      annualKwh: 3000,
      hourlyShares: flat,
      color: '#16a34a'
    };
    this.data.update(d => ({ ...d, profiles: [...d.profiles, profile] }));
  }

  removeProfile(id: string): void {
    this.data.update(d => ({ ...d, profiles: d.profiles.filter(p => p.id !== id) }));
  }

  // Inline editing for profile name / annual kWh.
  updateProfile(id: string, partial: Partial<LoadProfile>): void {
    this.data.update(d => ({
      ...d,
      profiles: d.profiles.map(p => (p.id === id ? { ...p, ...partial } : p))
    }));
  }

  setFullFeedIn(value: boolean): void {
    this.data.update(d => ({ ...d, fullFeedIn: value }));
  }

  // ---- E-Mobility -----------------------------------------------------------

  createEv(): void {
    const ev = makeEv(`ev-${this.evCounter++}`);
    this.data.update(d => ({ ...d, evs: [...d.evs, ev] }));
  }

  removeEv(id: string): void {
    this.data.update(d => ({ ...d, evs: d.evs.filter(e => e.id !== id) }));
  }

  updateEv(id: string, partial: Partial<EvData>): void {
    this.data.update(d => ({
      ...d,
      evs: d.evs.map(e => (e.id === id ? { ...e, ...partial } : e))
    }));
  }

  // When the manufacturer changes, jump to its first model and apply its battery/consumption values.
  onManufacturerChange(id: string, manufacturer: string): void {
    const brand = EV_DB.find(b => b.manufacturer === manufacturer) ?? EV_DB[0];
    const m = brand.models[0];
    this.updateEv(id, {
      manufacturer,
      model: m.model,
      batteryCapacityKwh: m.batteryCapacityKwh,
      consumptionKwhPer100km: m.consumptionKwhPer100km
    });
  }

  // When the model changes, also apply that model's battery/consumption values.
  onModelChange(id: string, manufacturer: string, model: string): void {
    const brand = EV_DB.find(b => b.manufacturer === manufacturer);
    const m = brand?.models.find(x => x.model === model);
    this.updateEv(id, m ? { model, batteryCapacityKwh: m.batteryCapacityKwh, consumptionKwhPer100km: m.consumptionKwhPer100km } : { model });
  }

  // Provides the selected manufacturer's model list to the template for the model dropdown.
  modelsFor(manufacturer: string): readonly { model: string }[] {
    return EV_DB.find(b => b.manufacturer === manufacturer)?.models ?? [];
  }

  // Updates daily km for a specific day using an immutable array copy.
  updateDailyKm(id: string, dayIndex: number, km: number): void {
    this.data.update(d => ({
      ...d,
      evs: d.evs.map(e => {
        if (e.id !== id) return e;
        const dailyKm = [...e.dailyKm];
        dailyKm[dayIndex] = km;
        return { ...e, dailyKm };
      })
    }));
  }

  // "Rewrite →" — recalculates the charging grid based on daily km.
  rewriteGrid(id: string): void {
    this.data.update(d => ({
      ...d,
      evs: d.evs.map(e => (e.id === id ? { ...e, chargingGrid: rewriteChargingGrid(e) } : e))
    }));
  }

  // Grid cell click — manually toggles a charging hour on/off.
  toggleCell(id: string, day: number, hour: number): void {
    this.data.update(d => ({
      ...d,
      evs: d.evs.map(e => {
        if (e.id !== id) return e;
        const grid = e.chargingGrid.map(r => [...r]);
        grid[day][hour] = !grid[day][hour];
        return { ...e, chargingGrid: grid };
      })
    }));
  }

  // Header values: annual mileage (weekly × 52.14) and annual energy demand (kWh).
  yearlyMileage(ev: EvData): number {
    return Math.round(ev.dailyKm.reduce((a, b) => a + b, 0) * 52.14);
  }

  neededEnergy(ev: EvData): number {
    return Math.round((this.yearlyMileage(ev) / 100) * ev.consumptionKwhPer100km);
  }

  // ---- SVG area chart -------------------------------------------------------

  // For each profile, creates the point array for the selected view and converts it into area/line paths.
  series = computed<Series[]>(() => {
    const profiles = this.data().profiles;
    if (!profiles.length) return [];

    const week = this.view() === 'week';
    // Find the peak value across all points of all profiles → shared Y scale.
    const valuesOf = (p: LoadProfile): number[] =>
      week
        ? p.hourlyShares.map(s => (p.annualKwh * s) / 365) // average hourly kWh
        : SEASONAL.map(m => p.annualKwh * m);              // monthly kWh

    const max = Math.max(...profiles.flatMap(valuesOf), 1);

    const innerW = W - PAD * 2;
    const innerH = H - PAD * 2;

    return profiles.map(p => {
      const vals = valuesOf(p);
      const n = vals.length;
      const pts = vals.map((v, i) => {
        const x = PAD + (innerW * i) / (n - 1);
        const y = PAD + innerH - (innerH * v) / max;
        return [x, y] as const;
      });

      const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
      // Close the area by going from the last point to the baseline, then back to the start.
      const baseY = PAD + innerH;
      const area =
        `${line} L${pts[n - 1][0].toFixed(1)},${baseY} L${pts[0][0].toFixed(1)},${baseY} Z`;

      return { name: p.name, color: p.color, area, line };
    });
  });

  // Expose constants for the template's SVG viewBox / axis lines.
  readonly chart = { W, H, PAD };

  // ---- Navigation -----------------------------------------------------------

  back(): void {
    const id = this.route.parent?.snapshot.paramMap.get('id') ?? '';
    this.router.navigate(['/projects', id, 'location']);
  }

  saveAndNext(): void {
    this.state.saveConsumption(this.data());
    const id = this.route.parent?.snapshot.paramMap.get('id') ?? '';
    this.router.navigate(['/projects', id, 'pv-arrays']);
  }
}