import { Component, computed, signal } from '@angular/core';
import { RouteData } from '@interfaces';
import { RouteService } from '@services/route.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  // Estado
  isSidebarOpen = signal(false);
  searchQuery = signal('');
  selectedRoute = signal<RouteData | null>(null);
  isLoading = signal(false);

  // Mapa y capas
  private map: any; // L.Map
  private currentPolyline: any; // L.Polyline

  // Rutas cargadas desde el servidor
  routes = signal<RouteData[]>([]);

  filteredRoutes = computed(() => {
    const q = this.searchQuery().toLowerCase();
    return this.routes().filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.landmarks.some(l => l.toLowerCase().includes(q)) // Ahora busca también en landmarks
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
        this.initMap();
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

  initMap() {
    const L = (window as any).L;

    try {
      // Centro en Tijuana
      this.map = L.map('map', {
        zoomControl: false
      }).setView([32.5149, -117.0382], 12);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(this.map);

      L.control.zoom({
        position: 'bottomright'
      }).addTo(this.map);
    } catch (error) {
      console.error('Error al inicializar el mapa:', error);
    }
  }

  toggleSidebar() {
    this.isSidebarOpen.update(v => !v);
  }

  filterRoutes(e: Event) {
    const target = e.target as HTMLInputElement;
    this.searchQuery.set(target.value);
  }

  selectRoute(route: RouteData) {
    const L = (window as any).L;

    // Validar que Leaflet esté cargado
    if (!L || !this.map) return;

    // Obtener el ID de la ruta (puede ser id o _id)
    const routeId = route._id || route.id;
    const selectedId = this.selectedRoute()?._id || this.selectedRoute()?.id;

    // Verificar si es la misma ruta (permitir redibujar)
    if (selectedId === routeId) {
      // Permitir redibujar la misma ruta
    }

    this.selectedRoute.set(route);

    if (window.innerWidth < 768) {
      this.isSidebarOpen.set(false);
    }

    // Extraer coordenadas del path (puede ser GeoJSON o array directo)
    let coordinates: [number, number][];

    if (route.path && typeof route.path === 'object' && 'coordinates' in route.path) {
      // Es un objeto GeoJSON LineString
      const geoCoords = route.path.coordinates as [number, number][];
      // GeoJSON usa [lng, lat], Leaflet usa [lat, lng] - invertir orden
      coordinates = geoCoords.map(coord => [coord[1], coord[0]] as [number, number]);
    } else if (Array.isArray(route.path)) {
      // Es un array directo
      coordinates = route.path;
    } else {
      return;
    }

    // Validar que tengamos coordenadas válidas
    if (!coordinates || coordinates.length === 0) return;

    // Limpiar mapa previo
    if (this.currentPolyline) this.map.removeLayer(this.currentPolyline);

    try {
      // Dibujar Ruta (Polyline)
      this.currentPolyline = L.polyline(coordinates, {
        color: route.color,
        weight: 6,
        opacity: 0.9,
        lineJoin: 'round'
      }).addTo(this.map);

      // Ajustar vista del mapa
      this.map.fitBounds(this.currentPolyline.getBounds(), {
        padding: [50, 50],
        maxZoom: 14
      });
    } catch (error) {
      console.error('Error al dibujar la ruta:', error);
    }
  }

  clearSelection() {
    this.selectedRoute.set(null);
    if (this.currentPolyline) this.map.removeLayer(this.currentPolyline);
    this.map.flyTo([32.5149, -117.0382], 12);
  }
}
