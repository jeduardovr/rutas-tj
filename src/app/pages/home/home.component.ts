import { Component, computed, signal, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouteData } from '@interfaces';
import { RouteService } from '@services/route.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit, AfterViewInit {
  // --- ESTADO ---
  viewMode = signal<'viewer' | 'creator'>('viewer');
  isSidebarOpen = signal(false);
  searchQuery = signal('');
  selectedRoute = signal<RouteData | null>(null);
  isLoading = signal(false);
  isEditing = signal<boolean>(false); // Estado de ed ición

  // Creator State
  landmarksString = '';
  newRoute: RouteData = {
    name: '',
    type: 'taxi',
    color: '#3b82f6',
    description: '',
    path: [],
    landmarks: []
  };
  showJsonModal = false;
  generatedJson = '';

  // --- MAPAS ---
  private mapViewer: any;
  private mapCreator: any;
  private viewerPolyline: any;
  private creatorPolyline: any;
  private creatorMarkers: any[] = [];

  // Rutas cargadas desde el servidor
  routes = signal<RouteData[]>([]);

  filteredRoutes = computed(() => {
    const q = this.searchQuery().toLowerCase();
    return this.routes().filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.landmarks.some(l => l.toLowerCase().includes(q))
    );
  });

  constructor(private routeService: RouteService) { }

  ngOnInit() {
    this.loadLeafletResources();
    this.loadRoutes();
  }

  loadRoutes() {
    this.isLoading.set(true);
    this.routeService.getRoutes().subscribe({
      next: (response: any) => {
        console.log(response);
        this.routes.set(response.data);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error al cargar rutas:', error);
        this.isLoading.set(false);
      }
    });
  }

  ngAfterViewInit() {
    const checkLeaflet = setInterval(() => {
      if ((window as any).L) {
        clearInterval(checkLeaflet);
        this.initViewerMap();
      }
    }, 100);
  }

  loadLeafletResources() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    document.head.appendChild(script);

    const fa = document.createElement('link');
    fa.rel = 'stylesheet';
    fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
    document.head.appendChild(fa);
  }

  // --- LÓGICA DE VISTAS ---
  toggleSidebar() {
    this.isSidebarOpen.update(v => !v);
  }

  setViewMode(mode: 'viewer' | 'creator') {
    this.viewMode.set(mode);

    // 💡 FIX: Esperamos a que Angular actualice el DOM antes de manipular los mapas
    setTimeout(() => {
      if (mode === 'viewer' && this.mapViewer) {
        this.mapViewer.invalidateSize();
      } else if (mode === 'creator') {
        if (!this.mapCreator) {
          // Inicializamos el mapa creador si no existe
          this.initCreatorMap();
        }
        // 💡 FIX CRÍTICO: Siempre redibujamos el mapa después de hacerlo visible
        // Usamos requestAnimationFrame para asegurar que el contenedor es visible
        requestAnimationFrame(() => {
          if (this.mapCreator) {
            this.mapCreator.invalidateSize();
          }
        });
      }
    }, 100);

    if (window.innerWidth < 768) {
      this.isSidebarOpen.set(false);
    }
  }

  // --- VISOR LÓGICA ---
  initViewerMap() {
    const L = (window as any).L;
    this.mapViewer = L.map('map-viewer', { zoomControl: false }).setView([32.5149, -117.0382], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(this.mapViewer);
    L.control.zoom({ position: 'bottomright' }).addTo(this.mapViewer);
  }

  filterRoutes(e: Event) {
    this.searchQuery.set((e.target as HTMLInputElement).value);
  }

  selectRoute(route: RouteData) {
    const L = (window as any).L;
    if (!L || !this.mapViewer) return;

    const routeId = route._id || route.id;
    const selectedId = this.selectedRoute()?._id || this.selectedRoute()?.id;

    if (routeId === selectedId) return;

    this.selectedRoute.set(route);

    if (window.innerWidth < 768) {
      this.isSidebarOpen.set(false);
    }

    let coordinates: [number, number][];

    if (route.path && typeof route.path === 'object' && 'coordinates' in route.path) {
      const geoCoords = route.path.coordinates as [number, number][];
      coordinates = geoCoords.map(coord => [coord[1], coord[0]] as [number, number]);
    } else if (Array.isArray(route.path)) {
      coordinates = route.path;
    } else {
      return;
    }

    if (!coordinates || coordinates.length === 0) return;

    if (this.viewerPolyline) this.mapViewer.removeLayer(this.viewerPolyline);

    try {
      this.viewerPolyline = L.polyline(coordinates, {
        color: route.color,
        weight: 6,
        opacity: 0.9,
        lineJoin: 'round'
      }).addTo(this.mapViewer);

      this.mapViewer.fitBounds(this.viewerPolyline.getBounds(), {
        padding: [50, 50],
        maxZoom: 14
      });
    } catch (error) {
      console.error('Error al dibujar la ruta:', error);
    }
  }

  clearSelection() {
    this.selectedRoute.set(null);
    if (this.viewerPolyline) this.mapViewer.removeLayer(this.viewerPolyline);
    this.mapViewer.flyTo([32.5149, -117.0382], 12);
  }

  // --- LÓGICA DE EDICIÓN ---
  startEditing(route: RouteData) {
    this.isEditing.set(true);
    this.newRoute = { ...route };
    this.landmarksString = route.landmarks ? route.landmarks.join(', ') : '';
    this.setViewMode('creator');

    // Esperamos a que el mapa se inicialice antes de cargar el path
    setTimeout(() => {
      if (this.mapCreator && this.newRoute.path && Array.isArray(this.newRoute.path)) {
        this.loadPathIntoCreatorMap(this.newRoute.path as [number, number][]);
      }
    }, 200);

    if (window.innerWidth < 768) this.isSidebarOpen.set(true);
  }

  resetCreator() {
    this.isEditing.set(false);
    this.newRoute = {
      name: '', type: 'taxi', color: '#3b82f6', description: '', path: [], landmarks: []
    };
    this.landmarksString = '';
    if (this.mapCreator) {
      this.clearCreatorMap();
    }
  }

  // --- CREADOR LÓGICA ---
  initCreatorMap() {
    const L = (window as any).L;
    this.mapCreator = L.map('map-creator', { zoomControl: false }).setView([32.5149, -117.0382], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(this.mapCreator);
    L.control.zoom({ position: 'bottomright' }).addTo(this.mapCreator);

    this.mapCreator.on('click', (e: any) => {
      this.addCreatorPoint(e.latlng.lat, e.latlng.lng);
    });
  }

  addCreatorPoint(lat: number, lng: number) {
    const L = (window as any).L;

    if (Array.isArray(this.newRoute.path)) {
      this.newRoute.path.push([lat, lng]);
    } else {
      this.newRoute.path = [[lat, lng]];
    }

    const marker = L.circleMarker([lat, lng], {
      radius: 5,
      color: '#333',
      fillColor: '#fff',
      fillOpacity: 1,
      weight: 2
    }).addTo(this.mapCreator);
    this.creatorMarkers.push(marker);

    this.redrawCreatorPolyline();
  }

  loadPathIntoCreatorMap(path: [number, number][]) {
    const L = (window as any).L;
    if (!this.mapCreator) return;

    this.clearCreatorMap();

    if (!path || path.length === 0) return;

    // Manejar tanto formato GeoJSON como array simple
    let coordinates: [number, number][] = [];
    if (typeof path === 'object' && 'coordinates' in path && Array.isArray((path as any).coordinates)) {
      // GeoJSON format: convert [lng, lat] to [lat, lng]
      coordinates = (path as any).coordinates.map((coord: any) => [coord[1], coord[0]]);
    } else if (Array.isArray(path)) {
      coordinates = path.map(p => [...p] as [number, number]);
    } else {
      return;
    }

    this.newRoute.path = coordinates;

    coordinates.forEach(coords => {
      const [lat, lng] = coords;
      const marker = L.circleMarker([lat, lng], {
        radius: 5, color: '#333', fillColor: '#fff', fillOpacity: 1, weight: 2
      }).addTo(this.mapCreator);
      this.creatorMarkers.push(marker);
    });

    this.redrawCreatorPolyline();

    const polyline = L.polyline(coordinates);
    this.mapCreator.fitBounds(polyline.getBounds(), { padding: [50, 50] });
  }

  undoLastPoint() {
    if (!Array.isArray(this.newRoute.path) || this.newRoute.path.length === 0) return;

    this.newRoute.path.pop();

    const L = (window as any).L;
    const lastMarker = this.creatorMarkers.pop();
    if (lastMarker) this.mapCreator.removeLayer(lastMarker);

    this.redrawCreatorPolyline();
  }

  clearCreatorMap() {
    const L = (window as any).L;
    this.newRoute.path = [];

    this.creatorMarkers.forEach(m => this.mapCreator.removeLayer(m));
    this.creatorMarkers = [];

    if (this.creatorPolyline) this.mapCreator.removeLayer(this.creatorPolyline);
  }

  redrawCreatorPolyline() {
    const L = (window as any).L;

    if (this.creatorPolyline) this.mapCreator.removeLayer(this.creatorPolyline);

    if (Array.isArray(this.newRoute.path) && this.newRoute.path.length > 0) {
      this.creatorPolyline = L.polyline(this.newRoute.path, {
        color: this.newRoute.color,
        weight: 4,
        dashArray: '5, 10',
        opacity: 0.7
      }).addTo(this.mapCreator);
    }
  }

  updateCreatorPolylineStyle() {
    if (this.creatorPolyline) {
      this.creatorPolyline.setStyle({ color: this.newRoute.color });
    }
  }

  saveNewRoute() {
    if (!this.newRoute.name.trim()) {
      alert('Por favor ingresa un nombre para la ruta');
      return;
    }

    if (!Array.isArray(this.newRoute.path) || this.newRoute.path.length === 0) {
      alert('Por favor agrega al menos un punto en el mapa');
      return;
    }

    this.newRoute.landmarks = this.landmarksString.split(',').map(s => s.trim()).filter(s => s.length > 0);

    const coordinates = this.newRoute.path.map(point => [point[1], point[0]]);
    const geoJsonPath = {
      type: "LineString",
      coordinates: coordinates
    };

    const routeData = {
      name: this.newRoute.name,
      type: this.newRoute.type,
      color: this.newRoute.color,
      description: this.newRoute.description,
      landmarks: this.newRoute.landmarks,
      path: geoJsonPath,
      active: true
    };

    this.routeService.createRoute(routeData).subscribe({
      next: (response) => {
        alert('✅ Ruta guardada exitosamente');
        this.newRoute = {
          name: '',
          type: 'taxi',
          color: '#3b82f6',
          description: '',
          path: [],
          landmarks: []
        };
        this.landmarksString = '';
        this.clearCreatorMap();
        this.loadRoutes();
        this.setViewMode('viewer');
      },
      error: (error) => {
        console.error('Error al guardar ruta:', error);
        alert('❌ Error al guardar la ruta. Por favor intenta de nuevo.');
      }
    });
  }

  getPathLength(): number {
    if (Array.isArray(this.newRoute.path)) {
      return this.newRoute.path.length;
    }
    return 0;
  }
}
