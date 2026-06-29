import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'projects',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component')
        .then(m => m.LoginComponent)
  },
  {
    path: 'projects',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/projects/project-list/project-list.component')
        .then(m => m.ProjectListComponent)
  },
  {
    path: 'projects/new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/projects/new-project-wizards/new-project-wizard.component')
        .then(m => m.NewProjectWizardComponent)
  },
  {
    path: 'projects/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/projects/project-details/project-detail.component')
        .then(m => m.ProjectDetailComponent),
    children: [
      {
        path: '',
        redirectTo: 'location',
        pathMatch: 'full'
      },
      {
        path: 'location',
        loadComponent: () =>
          import('./features/steps/location/location.component')
            .then(m => m.LocationComponent)
      },
      {
        path: 'consumption',
        loadComponent: () =>
          import('./features/steps/consumption/consumption.component')
            .then(m => m.ConsumptionComponent)
      },
      {
        path: 'pv-arrays',
        loadComponent: () =>
          import('./features/steps/pv-arrays/pv-arrays.component')
            .then(m => m.PvArraysComponent)
      },
      {
        path: 'inverter',
        loadComponent: () =>
          import('./features/steps/inverter/inverter.component')
            .then(m => m.InverterComponent)
      },
      {
        path: 'sizing',
        loadComponent: () =>
          import('./features/steps/sizing/sizing.component')
            .then(m => m.SizingComponent)
      },
      {
        path: 'components',
        loadComponent: () =>
          import('./features/steps/components/components.component')
            .then(m => m.ComponentsComponent)
      },
      {
        path: 'profitability',
        loadComponent: () =>
          import('./features/steps/profitability/profitability.component')
            .then(m => m.ProfitabilityComponent)
      },
      {
        path: 'report',
        loadComponent: () =>
          import('./features/steps/report/report.component')
            .then(m => m.ReportComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'projects'
  }
];