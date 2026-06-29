import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import * as L from 'leaflet';
import { ProjectStateService } from '../../../core/services/project-state.service';
import { WeatherService } from '../../../core/services/weather.service';
import { LocationData, emptyLocation } from '../../../core/models/project.model';

// Step 1 — Location. The first step of the Solar.creator flow:
//  • Leaflet map (Map/Satellite toggle) — select a location by clicking on the map
//  • Address search (Nominatim/OSM — free geocoding without an API key)
//  • PVGIS irradiation data through weather-service + increase/decrease slider
//  • Grid parameters: country approval, feed-in limit, displacement power factor
@Component({
  selector: 'app-location',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './location.component.html',
  styleUrl: './location.component.scss'
})
export class LocationComponent implements AfterViewInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private state = inject(ProjectStateService);
  private weather = inject(WeatherService);

  // Map DOM element — Leaflet is attached to this div in ngAfterViewInit.
  private mapEl = viewChild.required<ElementRef<HTMLDivElement>>('map');
  private map?: L.Map;
  private marker?: L.Marker;
  // Map/Satellite layers are kept separately so they can be switched instantly.
  private streetLayer?: L.TileLayer;
  private satelliteLayer?: L.TileLayer;

  // Local working copy for this step. Read from state, edited locally, written back on "Next".
  loc = signal<LocationData>(emptyLocation());

  // UI state signals
  satellite = signal(false);        // true → satellite view
  addressQuery = signal('');        // search input
  loadingIrradiance = signal(false);
  errorMsg = signal<string | null>(null);

  // Final irradiation adjusted by the slider: raw PVGIS value ± user percentage.
  adjustedIrradiance = computed(() => {
    const base = this.loc().solarIrradiance;
    if (base == null) return null;
    return Math.round(base * (1 + this.loc().irradianceAdjustment / 100));
  });

  constructor() {
    // If project state does not exist, create a local skeleton while the backend is offline on Windows.
    const id = this.route.parent?.snapshot.paramMap.get('id') ?? '';
    if (!this.state.project()) {
      this.state.initLocal(id, 'sc-local');
    }
    // Load a previously saved location if it exists; otherwise keep the empty default.
    const existing = this.state.location();
    if (existing) this.loc.set({ ...existing });
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    // Since Leaflet is manually attached to the DOM, it must be cleaned up when the component is destroyed;
    // otherwise route changes can cause the "map container already initialized" error.
    this.map?.remove();
  }

  // ---- Map setup ------------------------------------------------------------

  private initMap(): void {
    const { latitude, longitude } = this.loc();

    this.map = L.map(this.mapEl().nativeElement).setView([latitude, longitude], 13);

    // Standard street map (OpenStreetMap)
    this.streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19
    });

    // Satellite imagery (Esri World Imagery — accessible without an API key)
    this.satelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: '© Esri', maxZoom: 19 }
    );

    this.streetLayer.addTo(this.map);
    this.addMarker(latitude, longitude);

    // When the map is clicked, update the location and fill the address using reverse geocoding.
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.setCoords(e.latlng.lat, e.latlng.lng);
      this.reverseGeocode(e.latlng.lat, e.latlng.lng);
    });
  }

  private addMarker(lat: number, lng: number): void {
    // Leaflet's default marker icon breaks with bundlers; using CDN icons fixes it.
    const icon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41]
    });
    this.marker = L.marker([lat, lng], { icon, draggable: true }).addTo(this.map!);
    // Also update the coordinates when the marker is dragged.
    this.marker.on('dragend', () => {
      const p = this.marker!.getLatLng();
      this.setCoords(p.lat, p.lng);
      this.reverseGeocode(p.lat, p.lng);
    });
  }

  toggleSatellite(useSat: boolean): void {
    this.satellite.set(useSat);
    if (!this.map) return;
    if (useSat) {
      this.map.removeLayer(this.streetLayer!);
      this.satelliteLayer!.addTo(this.map);
    } else {
      this.map.removeLayer(this.satelliteLayer!);
      this.streetLayer!.addTo(this.map);
    }
  }

  // ---- Coordinates & address ------------------------------------------------

  // Centralizes coordinate changes coming from both the map and manual inputs.
  setCoords(lat: number, lng: number): void {
    this.patch({ latitude: lat, longitude: lng });
    this.marker?.setLatLng([lat, lng]);
    this.map?.panTo([lat, lng]);
  }

  // Address search — forward geocoding with Nominatim (OSM). Focuses on the first result.
  async searchAddress(): Promise<void> {
    const q = this.addressQuery().trim();
    if (!q) return;
    this.errorMsg.set(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
      const res = await fetch(url);
      const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
      if (!data.length) {
        this.errorMsg.set('Adres bulunamadı.');
        return;
      }
      const hit = data[0];
      const lat = parseFloat(hit.lat);
      const lng = parseFloat(hit.lon);
      this.patch({ address: hit.display_name });
      this.setCoords(lat, lng);
      this.map?.setView([lat, lng], 15);
    } catch {
      this.errorMsg.set('Adres arama servisine ulaşılamadı.');
    }
  }

  // Reverse geocoding — creates a readable address from coordinates after a map click.
  private async reverseGeocode(lat: number, lng: number): Promise<void> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
      const res = await fetch(url);
      const data = (await res.json()) as { display_name?: string };
      if (data.display_name) this.patch({ address: data.display_name });
    } catch {
      /* address is optional — fail silently */
    }
  }

  // ---- PVGIS irradiation ----------------------------------------------------

  fetchIrradiance(): void {
    this.loadingIrradiance.set(true);
    this.errorMsg.set(null);
    const { latitude, longitude } = this.loc();
    this.weather.getIrradiance(latitude, longitude).subscribe({
      next: r => {
        this.patch({ solarIrradiance: Math.round(r.irradianceKwhM2) });
        this.loadingIrradiance.set(false);
      },
      error: () => {
        // When the backend is offline on Windows, inform the user and continue without blocking the flow.
        this.errorMsg.set('Işınım verisi alınamadı (weather-service çalışmıyor olabilir).');
        this.loadingIrradiance.set(false);
      }
    });
  }

  // ---- Helpers --------------------------------------------------------------

  // Partially updates the local copy — immutable update so the signal change is triggered.
  patch(partial: Partial<LocationData>): void {
    this.loc.update(l => ({ ...l, ...partial }));
  }

  // Separate patch method for the nested grid object using an immutable update.
  patchGrid(partial: Partial<LocationData['grid']>): void {
    this.loc.update(l => ({ ...l, grid: { ...l.grid, ...partial } }));
  }

  // "Next" → write to state, run GraphQL mutation if available, then move to Step 2.
  saveAndNext(): void {
    this.state.saveLocation(this.loc());
    const id = this.route.parent?.snapshot.paramMap.get('id') ?? '';
    this.router.navigate(['/projects', id, 'consumption']);
  }
}