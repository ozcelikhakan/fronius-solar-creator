import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectStateService } from '../../../core/services/project-state.service';
import {
  ConsumptionData,
  LoadProfile,
  PRESET_PROFILES,
  emptyConsumption,
  makePresetProfile
} from '../../../core/models/project.model';

// Monthly consumption weights for the year view — higher in the Austrian climate
// due to winter heating. Sum is approximately 1.0 (annual kWh is distributed to months with this).
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

  // Exposed so the template can render preset profile buttons.
  readonly presets = PRESET_PROFILES;

  // Local working copy + UI states
  data = signal<ConsumptionData>(emptyConsumption());
  view = signal<'week' | 'year'>('week');
  private idCounter = 0;

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
      this.data.set({ ...existing, profiles: existing.profiles.map(p => ({ ...p })) });
      this.idCounter = existing.profiles.length;
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