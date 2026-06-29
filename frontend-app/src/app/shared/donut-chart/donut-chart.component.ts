import { Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';

export interface DonutSegment {
  label: string;
  value: number;   // ratio/value — the component normalizes it itself
  color: string;
}

// Reusable donut chart for the 3 donut charts in Report.
// stroke-dasharray technique: each segment is an arc with a length proportional to its share of the circumference.
@Component({
  selector: 'app-donut-chart',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <div class="donut">
      <svg viewBox="0 0 120 120">
        <!-- background ring -->
        <circle cx="60" cy="60" [attr.r]="radius" fill="none" stroke="#eef1f4" [attr.stroke-width]="thickness" />
        <!-- segments: rotated -90° so they start from the top -->
        <g transform="rotate(-90 60 60)">
          @for (s of arcs(); track s.label) {
            <circle
              cx="60" cy="60" [attr.r]="radius" fill="none"
              [attr.stroke]="s.color" [attr.stroke-width]="thickness"
              [attr.stroke-dasharray]="s.dash + ' ' + (circumference - s.dash)"
              [attr.stroke-dashoffset]="-s.offset"
            />
          }
        </g>
        <!-- center text -->
        @if (centerValue()) {
          <text x="60" y="56" text-anchor="middle" class="center-val">{{ centerValue() }}</text>
          <text x="60" y="72" text-anchor="middle" class="center-label">{{ centerLabel() }}</text>
        }
      </svg>

      <ul class="legend">
        @for (s of segments(); track s.label) {
          <li>
            <span class="dot" [style.background]="s.color"></span>
            {{ s.label }}
            <strong>{{ pct(s.value) | number: '1.0-0' }}%</strong>
          </li>
        }
      </ul>
    </div>
  `,
  styleUrl: './donut-chart.component.scss'
})
export class DonutChartComponent {
  segments = input.required<DonutSegment[]>();
  centerValue = input<string>('');
  centerLabel = input<string>('');

  readonly radius = 50;
  readonly thickness = 16;
  readonly circumference = 2 * Math.PI * 50;

  private total = computed(() => this.segments().reduce((s, x) => s + Math.max(0, x.value), 0) || 1);

  // Arc length (dash) and start offset (cumulative) for each segment.
  arcs = computed(() => {
    let acc = 0;
    return this.segments().map(s => {
      const frac = Math.max(0, s.value) / this.total();
      const dash = frac * this.circumference;
      const offset = acc * this.circumference;
      acc += frac;
      return { label: s.label, color: s.color, dash, offset };
    });
  });

  pct(value: number): number {
    return (Math.max(0, value) / this.total()) * 100;
  }
}