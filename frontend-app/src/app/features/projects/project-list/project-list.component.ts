import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <div class="page-container">

     
      <div class="page-header">
        <h1>Projects</h1>
        <div class="header-actions">
         
          <a routerLink="/projects/new" class="btn-primary">+ New project</a>
          <button class="btn-logout" (click)="logout()">Sign out</button>
        </div>
      </div>

    
      @if (loading()) {
        <div class="loading">Loading projects...</div>
      }

    
      @else if (projects().length === 0) {
        <div class="empty-state">
          <p>No projects yet.</p>
          <a routerLink="/projects/new" class="btn-primary">Create your first project</a>
        </div>
      }

     
      @else {
        <div class="projects-grid">
          @for (project of projects(); track project.id) {
            <!-- track project.id — Angular'ın DOM diff algoritması için.
                 id ile takip edince liste güncellenince tüm DOM yeniden çizilmez. -->
            <div class="project-card">
              <div class="project-card-header">
                <h3>{{ project.name }}</h3>
                <span class="project-types">
                  @for (type of project.projectTypes; track type) {
                    <span class="tag">{{ type }}</span>
                  }
                </span>
              </div>
              <div class="project-card-body">
                @if (project.customerFirstName) {
                  <p class="customer">
                    {{ project.customerFirstName }} {{ project.customerLastName }}
                  </p>
                }
                @if (project.customerCompany) {
                  <p class="company">{{ project.customerCompany }}</p>
                }
                <p class="date">{{ project.updatedAt | date:'dd MMM yyyy' }}</p>
              </div>
              <div class="project-card-footer">
                <a [routerLink]="['/projects', project.id]" class="btn-open">
                  Open →
                </a>
              </div>
            </div>
          }
        </div>
      }

    </div>
  `,
  styleUrl: './project-list.component.scss'
})
export class ProjectListComponent implements OnInit {
  private authService = inject(AuthService);

 
  loading = signal(true);
  projects = signal<Project[]>([]);

  ngOnInit(): void {

    setTimeout(() => {
      this.projects.set([
        {
          id: '1',
          name: 'sc-2026-05-21-10:00',
          customerFirstName: 'Max',
          customerLastName: 'Mustermann',
          customerCompany: 'Solar GmbH',
          projectTypes: ['Residential', 'Battery'],
          updatedAt: new Date()
        }
      ]);
      this.loading.set(false);
    }, 500);
  }

  logout(): void {
    this.authService.logout();
  }
}

interface Project {
  id: string;
  name: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerCompany?: string;
  projectTypes: string[];
  updatedAt: Date;
}