import { Component, OnInit, AfterViewInit, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouteData } from '@interfaces';

@Component({
  selector: 'app-create-route',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-route.component.html',
  styleUrl: './create-route.component.css'
})
export class CreateRouteComponent implements OnInit, AfterViewInit {
  // --- ESTADO ---
  viewMode = signal<'viewer' | 'creator'>('viewer');
  isSidebarOpen = signal(false);

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

  // Capas del creador
  private creatorPolyline: any;
  private creatorMarkers: any[] = []; // Para mostrar los puntos clicados

  // --- DATOS SIMULADOS ---
  routes = signal<RouteData[]>([
    {
      id: '1',
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

  // Helper to safely access path as array
  get routePath(): [number, number][] {
    const path = this.newRoute.path;
    return Array.isArray(path) ? path : [];
  }

  ngOnInit() {
    this.loadLeafletResources();
  }

  ngAfterViewInit() {
    const checkLeaflet = setInterval(() => {
      if ((window as any).L) {
        clearInterval(checkLeaflet);
        this.initViewerMap();
        // No iniciamos el mapa creador hasta que el usuario cambie de tab
        // o podemos iniciarlo oculto. Lo haremos lazy cuando cambie el modo.
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
  toggleSidebar() { this.isSidebarOpen.update(v => !v); }

  setViewMode(mode: 'viewer' | 'creator') {
    this.viewMode.set(mode);

    // Hack para redibujar mapas de leaflet cuando cambian de display: none
    setTimeout(() => {
      if (mode === 'viewer' && this.mapViewer) {
        this.mapViewer.invalidateSize();
      } else if (mode === 'creator') {
        if (!this.mapCreator) {
          this.initCreatorMap();
        } else {
          this.mapCreator.invalidateSize();
        }
      }
    }, 100);

    if (window.innerWidth < 768) this.isSidebarOpen.set(false);
  }

  // --- VISOR LÓGICA ---
  initViewerMap() {
    const L = (window as any).L;
    this.mapViewer = L.map('map-viewer', { zoomControl: false }).setView([32.5149, -117.0382], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(this.mapViewer);
    L.control.zoom({ position: 'bottomright' }).addTo(this.mapViewer);
  }

  filterRoutes(e: Event) { this.searchQuery.set((e.target as HTMLInputElement).value); }

  selectRoute(route: RouteData) {
    const L = (window as any).L;
    if (this.selectedRoute()?.id === route.id) return;
    this.selectedRoute.set(route);

    if (this.viewerPolyline) this.mapViewer.removeLayer(this.viewerPolyline);

    this.viewerPolyline = L.polyline(route.path, { color: route.color, weight: 6 }).addTo(this.mapViewer);
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
    // Usamos un ID diferente para el mapa del creador
    this.mapCreator = L.map('map-creator', { zoomControl: false }).setView([32.5149, -117.0382], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(this.mapCreator);
    L.control.zoom({ position: 'bottomright' }).addTo(this.mapCreator);

    // Evento de clic para agregar puntos
    this.mapCreator.on('click', (e: any) => {
      this.addCreatorPoint(e.latlng.lat, e.latlng.lng);
    });
  }

  addCreatorPoint(lat: number, lng: number) {
    const L = (window as any).L;

    // Agregar a datos - ensure we're working with array type
    if (Array.isArray(this.newRoute.path)) {
      this.newRoute.path.push([lat, lng]);
    } else {
      this.newRoute.path = [[lat, lng]];
    }

    // Agregar marcador visual (puntito)
    const marker = L.circleMarker([lat, lng], {
      radius: 5,
      color: '#333',
      fillColor: '#fff',
      fillOpacity: 1,
      weight: 2
    }).addTo(this.mapCreator);
    this.creatorMarkers.push(marker);

    // Dibujar/Actualizar línea
    this.redrawCreatorPolyline();
  }

  undoLastPoint() {
    if (!Array.isArray(this.newRoute.path) || this.newRoute.path.length === 0) return;

    // Quitar datos
    this.newRoute.path.pop();

    // Quitar marcador visual
    const L = (window as any).L;
    const lastMarker = this.creatorMarkers.pop();
    if (lastMarker) this.mapCreator.removeLayer(lastMarker);

    this.redrawCreatorPolyline();
  }

  clearCreatorMap() {
    const L = (window as any).L;
    this.newRoute.path = [];

    // Limpiar marcadores
    this.creatorMarkers.forEach(m => this.mapCreator.removeLayer(m));
    this.creatorMarkers = [];

    // Limpiar línea
    if (this.creatorPolyline) this.mapCreator.removeLayer(this.creatorPolyline);
  }

  redrawCreatorPolyline() {
    const L = (window as any).L;

    if (this.creatorPolyline) this.mapCreator.removeLayer(this.creatorPolyline);

    if (Array.isArray(this.newRoute.path) && this.newRoute.path.length > 0) {
      this.creatorPolyline = L.polyline(this.newRoute.path, {
        color: this.newRoute.color,
        weight: 4,
        dashArray: '5, 10', // Linea punteada mientras se edita
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
    // Procesar landmarks string a array
    this.newRoute.landmarks = this.landmarksString.split(',').map(s => s.trim()).filter(s => s.length > 0);

    // Generar ID temporal o dejar que Mongo lo haga
    const finalData = {
      ...this.newRoute,
      // path: this.newRoute.path // Ya está en formato correcto
    };

    this.generatedJson = JSON.stringify(finalData, null, 2);
    this.showJsonModal = true;
  }

  copyJson() {
    navigator.clipboard.writeText(this.generatedJson).then(() => {
      alert('JSON copiado al portapapeles');
    });
  }
}
