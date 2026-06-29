import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';


@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="project-layout">

      
      <aside class="sidebar">
        <div class="sidebar-header">
          <button class="back-btn" (click)="goBack()">← Projects</button>
          <h2 class="project-name">{{ projectName() }}</h2>
        </div>

        <nav class="steps-nav">
          
          @for (step of steps; track step.path) {
            <a
              [routerLink]="['/projects', projectId(), step.path]"
              routerLinkActive="active"
              class="step-item"
            >
              <span class="step-number">{{ step.number }}</span>
              <span class="step-label">{{ step.label }}</span>
            </a>
          }
        </nav>
      </aside>

      
      <main class="step-content">
        
        <router-outlet />
      </main>

    </div>
  `,
  styleUrl: './project-detail.component.scss'
})
export class ProjectDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  projectId = signal('');
  projectName = signal('');

  readonly steps = [
    { number: 1, label: 'Location',      path: 'location'      },
    { number: 2, label: 'Consumption',   path: 'consumption'   },
    { number: 3, label: 'PV arrays',     path: 'pv-arrays'     },
    { number: 4, label: 'Inverter',      path: 'inverter'      },
    { number: 5, label: 'Sizing',        path: 'sizing'        },
    { number: 6, label: 'Components',    path: 'components'    },
    { number: 7, label: 'Profitability', path: 'profitability' },
    { number: 8, label: 'Report',        path: 'report'        },
  ];

  ngOnInit(): void {
    
    this.projectId.set(this.route.snapshot.paramMap.get('id') ?? '');

    
    this.projectName.set('sc-2026-05-21-10:00');
  }

  goBack(): void {
    this.router.navigate(['/projects']);
  }
}