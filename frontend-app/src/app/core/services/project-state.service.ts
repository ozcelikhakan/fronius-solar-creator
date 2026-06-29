import { Injectable, computed, inject, signal } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { map } from 'rxjs';
import { ConsumptionData, LocationData, Project, PvArray } from '../models/project.model';

// Shared single source of truth between steps.
// Why a separate service: the 8 steps live in independent routes; instead of passing
// shared project data to each step as input, sharing it through a providedIn:'root'
// signal store means less boilerplate and preserves state when switching steps.
// The Apollo bridge is also here — steps access GraphQL through this service, not directly.
@Injectable({ providedIn: 'root' })
export class ProjectStateService {
  private apollo = inject(Apollo);

  // All active project data is kept in a single signal. Steps update it through patch* methods.
  private readonly _project = signal<Project | null>(null);

  // Read-only exposed views — components read the state through these, not directly.
  readonly project = this._project.asReadonly();
  readonly location = computed(() => this._project()?.location ?? null);
  readonly consumption = computed(() => this._project()?.consumption ?? null);
  readonly pvArrays = computed(() => this._project()?.pvArrays ?? null);

  // Fetches the project from the api-gateway in a single request. The schema is aligned with the Project type in CLAUDE.md.
  load(projectId: string) {
    return this.apollo
      .query<{ project: Project }>({
        query: gql`
          query GetProject($id: ID!) {
            project(id: $id) {
              id
              name
              customer { firstName lastName phone company email }
              settings { currency measurement temperature cableStandard }
              location {
                address latitude longitude
                solarIrradiance irradianceAdjustment
                grid {
                  inverterCountryApproval
                  feedInLimitEnabled
                  feedInLimitPercent
                  displacementPowerFactor
                }
              }
            }
          }
        `,
        variables: { id: projectId }
      })
      .pipe(
        map(res => res.data.project),
        // Writes the incoming data to the local store so steps can read it immediately.
        map(project => {
          this._project.set(project);
          return project;
        })
      );
  }

  // Saves the Location step. To keep the UI working without the backend on Windows,
  // local state is updated first, then the mutation is sent — optimistic behavior.
  saveLocation(location: LocationData) {
    this.patchLocation(location);
    const id = this._project()?.id;
    if (!id) return;

    return this.apollo.mutate({
      mutation: gql`
        mutation UpdateLocation($id: ID!, $location: LocationInput!) {
          updateProjectLocation(id: $id, location: $location) {
            id
          }
        }
      `,
      variables: { id, location }
    });
  }

  // Partially updates the local state — for instant UI updates without going to GraphQL.
  patchLocation(location: Partial<LocationData>): void {
    this._project.update(p =>
      p ? { ...p, location: { ...(p.location as LocationData), ...location } } : p
    );
  }

  // Saves the Consumption step — same optimistic pattern as Location.
  saveConsumption(consumption: ConsumptionData) {
    this.patchConsumption(consumption);
    const id = this._project()?.id;
    if (!id) return;

    return this.apollo.mutate({
      mutation: gql`
        mutation UpdateConsumption($id: ID!, $consumption: ConsumptionInput!) {
          updateProjectConsumption(id: $id, consumption: $consumption) {
            id
          }
        }
      `,
      variables: { id, consumption }
    });
  }

  patchConsumption(consumption: Partial<ConsumptionData>): void {
    this._project.update(p =>
      p ? { ...p, consumption: { ...(p.consumption as ConsumptionData), ...consumption } } : p
    );
  }

  // Saves the PV arrays step — same optimistic pattern as the other steps.
  savePvArrays(pvArrays: PvArray[]) {
    this._project.update(p => (p ? { ...p, pvArrays } : p));
    const id = this._project()?.id;
    if (!id) return;

    return this.apollo.mutate({
      mutation: gql`
        mutation UpdatePvArrays($id: ID!, $pvArrays: [PvArrayInput!]!) {
          updateProjectPvArrays(id: $id, pvArrays: $pvArrays) {
            id
          }
        }
      `,
      variables: { id, pvArrays }
    });
  }

  // For development/preview: loads an empty project skeleton without the backend.
  // E-Mobility was added to projectTypes so the related sub-step can be tested locally;
  // in the real flow, this list comes from new-project-wizard. Once GraphQL is connected, load() takes over.
  initLocal(id: string, name: string): void {
    this._project.set({ id, name, projectTypes: ['Residential', 'E-Mobility'] });
  }
}