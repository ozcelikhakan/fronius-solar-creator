import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectStateService } from '../../../core/services/project-state.service';
import {
  CustomCost,
  ElectricityUnit,
  ProfitabilityData,
  Subsidy,
  SubsidyType,
  SubsidyUnit,
  emptyProfitability
} from '../../../core/models/project.model';

// Step 7 — Profitability. Sub-steps: Revenues / Expenses.
@Component({
  selector: 'app-profitability',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './profitability.component.html',
  styleUrl: './profitability.component.scss'
})
export class ProfitabilityComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private state = inject(ProjectStateService);

  readonly subsidyUnits: SubsidyUnit[] = ['€', '€/kWp', '€/kWh'];
  readonly electricityUnits: ElectricityUnit[] = ['Month', 'Year', 'kWh'];

  data = signal<ProfitabilityData>(emptyProfitability());
  subStep = signal<'revenues' | 'expenses'>('revenues');
  private subsidyCounter = 0;
  private costCounter = 0;

  constructor() {
    const id = this.route.parent?.snapshot.paramMap.get('id') ?? '';
    if (!this.state.project()) this.state.initLocal(id, 'sc-local');

    const existing = this.state.profitability();
    if (existing) {
      // Deep copy — to avoid sharing inner arrays (subsidies/customCosts) by reference.
      this.data.set({
        revenues: { ...existing.revenues, subsidies: existing.revenues.subsidies.map(s => ({ ...s })) },
        expenses: { ...existing.expenses, customCosts: existing.expenses.customCosts.map(c => ({ ...c })) }
      });
      this.subsidyCounter = existing.revenues.subsidies.length;
      this.costCounter = existing.expenses.customCosts.length;
    }
  }

  // ---- Revenues -------------------------------------------------------------

  patchRevenues(partial: Partial<ProfitabilityData['revenues']>): void {
    this.data.update(d => ({ ...d, revenues: { ...d.revenues, ...partial } }));
  }

  addSubsidy(): void {
    const s: Subsidy = { id: `sub-${this.subsidyCounter++}`, type: 'one-time', unit: '€', amount: 0 };
    this.data.update(d => ({ ...d, revenues: { ...d.revenues, subsidies: [...d.revenues.subsidies, s] } }));
  }

  updateSubsidy(id: string, partial: Partial<Subsidy>): void {
    this.data.update(d => ({
      ...d,
      revenues: { ...d.revenues, subsidies: d.revenues.subsidies.map(s => (s.id === id ? { ...s, ...partial } : s)) }
    }));
  }

  removeSubsidy(id: string): void {
    this.data.update(d => ({
      ...d,
      revenues: { ...d.revenues, subsidies: d.revenues.subsidies.filter(s => s.id !== id) }
    }));
  }

  // ---- Expenses -------------------------------------------------------------

  patchExpenses(partial: Partial<ProfitabilityData['expenses']>): void {
    this.data.update(d => ({ ...d, expenses: { ...d.expenses, ...partial } }));
  }

  addCustomCost(): void {
    const c: CustomCost = { id: `cost-${this.costCounter++}`, label: 'Custom cost', amount: 0 };
    this.data.update(d => ({ ...d, expenses: { ...d.expenses, customCosts: [...d.expenses.customCosts, c] } }));
  }

  updateCustomCost(id: string, partial: Partial<CustomCost>): void {
    this.data.update(d => ({
      ...d,
      expenses: { ...d.expenses, customCosts: d.expenses.customCosts.map(c => (c.id === id ? { ...c, ...partial } : c)) }
    }));
  }

  removeCustomCost(id: string): void {
    this.data.update(d => ({
      ...d,
      expenses: { ...d.expenses, customCosts: d.expenses.customCosts.filter(c => c.id !== id) }
    }));
  }

  // Sets the subsidy type for the radio button in the template.
  setSubsidyType(id: string, type: SubsidyType): void {
    this.updateSubsidy(id, { type });
  }

  // ---- Navigation -----------------------------------------------------------

  back(): void {
    const id = this.route.parent?.snapshot.paramMap.get('id') ?? '';
    this.router.navigate(['/projects', id, 'components']);
  }

  saveAndNext(): void {
    this.state.saveProfitability(this.data());
    const id = this.route.parent?.snapshot.paramMap.get('id') ?? '';
    this.router.navigate(['/projects', id, 'report']);
  }
}