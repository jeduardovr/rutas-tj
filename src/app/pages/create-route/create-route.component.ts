import { Component, OnInit, AfterViewInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouteData } from '@interfaces';
// import { RouteService } from '@app/services/route.service'; // Descomentar al integrar backend real

@Component({
  selector: 'app-create-route',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-route.component.html',
  styleUrl: './create-route.component.css'
})
export class CreateRouteComponent implements OnInit, AfterViewInit {
  // El servicio está inyectado pero no usado para simulación. Descomentar si se usa.
  // private readonly routesService = inject(RouteService); 

  // --- ESTADO ---
  viewMode = signal<'viewer' | 'creator'>('viewer');
  isSidebarOpen = signal(false);
  isEditing = signal<boolean>(false); // 💡 Para controlar la edición
  isLoading = signal(false); // Se mantiene por la estructura del HTML

  // Viewer State
  searchQuery = signal('');
  selectedRoute = signal<RouteData | null>(null);

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

  // --- DATOS SIMULADOS ---
  routes = signal<RouteData[]>([
    {
      id: '1', // Manteniendo 'id' para la simulación
      name: 'Rojo y Negro',
      type: 'taxi',
      color: '#d91a1a',
      description: 'Circuito Centro - Agua Caliente - Presa',
      path: [[32.5332, -117.0365], [32.5250, -117.0250], [32.5180, -117.0080], [32.5050, -116.9750], [32.4650, -116.9200]],
      landmarks: ['Centro', '5 y 10', 'Presa']
    },
    {
      id: '2',
      name: 'Verde (Otay)',
      type: 'bus',
      color: '#10b981',
      description: 'Ruta universitaria Otay',
      path: [[32.5050, -116.9750], [32.5150, -116.9700], [32.5350, -116.9500], [32.5400, -116.9400]],
      landmarks: ['UABC', 'Garita Otay']
    }
  ]);

  filteredRoutes = computed(() => {
    const q = this.searchQuery().toLowerCase();
    return this.routes().filter(r => r.name.toLowerCase().includes(q));
  });

  get routePath(): [number, number][] {
    const path = this.newRoute.path;
    return Array.isArray(path) ? path : [];
  }

  ngOnInit() {
    this.loadLeafletResources();
    // ❌ loadRoutes() eliminado. Las rutas simuladas se cargan inmediatamente.
  }

  ngAfterViewInit() {
    const checkLeaflet = setInterval(() => {
      if ((window as any).L) {
        clearInterval(checkLeaflet);
        this.initViewerMap();
        this.initCreatorMap(); // 💡 Inicializamos ambos mapas
      }
    }, 100);
  }

  // ❌ loadRoutes() eliminado.

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
  toggleSidebar() { this.isSidebarOpen.update(v => !v); }

  setViewMode(mode: 'viewer' | 'creator') {
    this.viewMode.set(mode);

    // Si cambiamos a creación/edición y no estamos editando, reiniciamos el formulario.
    if (mode === 'creator' && !this.isEditing()) {
      this.resetCreator();
    }

    // 💡 FIX: Aumentamos el tiempo para que el mapa se redibuje correctamente
    setTimeout(() => {
      if (this.mapViewer) {
        this.mapViewer.invalidateSize();
      }
      if (this.mapCreator) {
        this.mapCreator.invalidateSize();
        // Opcional: Centrar el mapa al mostrarse
        if (mode === 'creator') {
          this.mapCreator.setView([32.5149, -117.0382], 12);
        }
      }
    }, 250); // 💡 Tiempo aumentado a 250ms

    if (window.innerWidth < 768) this.isSidebarOpen.set(false);
  }

  // --- VISOR LÓGICA ---
  initViewerMap() {
    const L = (window as any).L;
    if (this.mapViewer) return;
    this.mapViewer = L.map('map-viewer', { zoomControl: false }).setView([32.5149, -117.0382], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(this.mapViewer);
    L.control.zoom({ position: 'bottomright' }).addTo(this.mapViewer);
  }

  filterRoutes(e: Event) { this.searchQuery.set((e.target as HTMLInputElement).value); }

  selectRoute(route: RouteData) {
    const L = (window as any).L;
    const routeId = route._id || route.id;
    const selectedId = this.selectedRoute()?._id || this.selectedRoute()?.id;

    if (routeId === selectedId) return;
    this.selectedRoute.set(route);

    if (this.viewerPolyline) this.mapViewer.removeLayer(this.viewerPolyline);

    // Asumimos que route.path ya está en formato Leaflet [Lat, Lng]
    this.viewerPolyline = L.polyline(route.path as [number, number][], { color: route.color, weight: 6 }).addTo(this.mapViewer);
    this.mapViewer.fitBounds(this.viewerPolyline.getBounds(), { padding: [50, 50] });

    if (window.innerWidth < 768) this.isSidebarOpen.set(false);
  }

  clearSelection() {
    this.selectedRoute.set(null);
    if (this.viewerPolyline) this.mapViewer.removeLayer(this.viewerPolyline);
  }

  // --- CREADOR LÓGICA ---
  initCreatorMap() {
    const L = (window as any).L;
    if (this.mapCreator) return;

    this.mapCreator = L.map('map-creator', { zoomControl: false }).setView([32.5149, -117.0382], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(this.mapCreator);
    L.control.zoom({ position: 'bottomright' }).addTo(this.mapCreator);

    this.mapCreator.on('click', (e: any) => {
      this.addCreatorPoint(e.latlng.lat, e.latlng.lng);
    });

    // Si entramos al modo creador desde edición, cargamos el path
    if (this.isEditing() && this.newRoute.path.length > 0) {
      this.loadPathIntoCreatorMap(this.newRoute.path as [number, number][]);
    }
  }

  // 💡 Lógica de Edición - Carga la ruta seleccionada en el formulario
  startEditing(route: RouteData) {
    this.isEditing.set(true);
    this.newRoute = { ...route };
    this.landmarksString = route.landmarks ? route.landmarks.join(', ') : '';
    this.setViewMode('creator');

    if (!this.mapCreator) {
      this.initCreatorMap();
    }
    this.loadPathIntoCreatorMap(route.path as [number, number][]);

    if (window.innerWidth < 768) this.isSidebarOpen.set(true);
  }

  resetCreator() {
    this.isEditing.set(false);
    this.newRoute = {
      name: '', type: 'taxi', color: '#3b82f6', description: '', path: [], landmarks: []
    };
    this.landmarksString = '';
    this.clearCreatorMap();
  }

  loadPathIntoCreatorMap(path: [number, number][]) {
    const L = (window as any).L;
    if (!this.mapCreator) return;

    this.clearCreatorMap();

    if (!path || path.length === 0) return;

    this.newRoute.path = path.map(p => [...p]);

    path.forEach(coords => {
      const [lat, lng] = coords;
      const marker = L.circleMarker([lat, lng], {
        radius: 5, color: '#333', fillColor: '#fff', fillOpacity: 1, weight: 2
      }).addTo(this.mapCreator);
      this.creatorMarkers.push(marker);
    });

    this.redrawCreatorPolyline();

    const polyline = L.polyline(path);
    this.mapCreator.fitBounds(polyline.getBounds(), { padding: [50, 50] });
  }

  addCreatorPoint(lat: number, lng: number) {
    const L = (window as any).L;

    if (Array.isArray(this.newRoute.path)) {
      this.newRoute.path.push([lat, lng]);
    } else {
      this.newRoute.path = [[lat, lng]];
    }

    const marker = L.circleMarker([lat, lng], {
      radius: 5, color: '#333', fillColor: '#fff', fillOpacity: 1, weight: 2
    }).addTo(this.mapCreator);
    this.creatorMarkers.push(marker);

    this.redrawCreatorPolyline();
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
    this.mapCreator.setView([32.5149, -117.0382], 12);
    this.resetCreator(); // Asegura el estado inicial
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
    // 1. Validaciones
    if (!this.newRoute.name.trim()) {
      alert('Por favor ingresa un nombre para la ruta');
      return;
    }
    if (!Array.isArray(this.newRoute.path) || this.newRoute.path.length < 2) {
      alert('Por favor traza al menos dos puntos en el mapa');
      return;
    }

    // 2. Preparar datos (GeoJSON: [Lng, Lat])
    this.newRoute.landmarks = this.landmarksString.split(',').map(s => s.trim()).filter(s => s.length > 0);
    const coordinatesGeoJson = this.newRoute.path.map(point => [point[1], point[0]]); // [Lat, Lng] -> [Lng, Lat]

    const routeDataToSimulate = {
      ...this.newRoute,
      path: {
        type: "LineString",
        coordinates: coordinatesGeoJson
      },
      active: true
    };

    // 3. Determinar POST o PUT y simular JSON
    const action = this.isEditing() && (this.newRoute._id || this.newRoute.id) ? "UPDATE" : "CREATE";

    this.generatedJson = JSON.stringify({ action: action, data: routeDataToSimulate }, null, 2);
    this.showJsonModal = true;

    // Simular el cambio en la lista local para ver el efecto
    this.routes.update(routes => {
      if (action === "UPDATE") {
        return routes.map(r => (r.id === this.newRoute.id) ? { ...r, ...this.newRoute, path: this.newRoute.path } : r);
      } else {
        // Simular adición con un ID temporal
        return [...routes, { ...this.newRoute, id: Date.now().toString() }];
      }
    });

    // Resetear y volver al visor
    this.resetCreator();
    this.setViewMode('viewer');
  }

  copyJson() {
    navigator.clipboard.writeText(this.generatedJson).then(() => {
      alert('JSON copiado al portapapeles');
    });
  }

  getPathLength(): number {
    if (Array.isArray(this.newRoute.path)) {
      return this.newRoute.path.length;
    }
    return 0;
  }
}