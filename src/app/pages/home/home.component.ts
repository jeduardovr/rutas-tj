import { Component, computed, signal, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CreateRouteComponent } from '../create-route/create-route.component';
import { RouteData } from '@interfaces';
import { RouteService } from '@services/route.service';
import { AuthService } from '@services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, CreateRouteComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, AfterViewInit {
  // --- ESTADO ---
  viewMode = signal<'viewer' | 'creator'>('viewer');
  isSidebarOpen = signal(false);
  searchQuery = signal('');
  selectedRoute = signal<RouteData | null>(null);
  isLoading = signal(false);
  isEditing = signal<boolean>(false); // Estado de edición
  is24Hours = false;

  // Creator State
  landmarksString = '';
  newRoute: RouteData = {
    from: '',
    to: '',
    type: 'taxi',
    schedule: {
      start: '',
      end: ''
    },
    color: '#3b82f6',
    description: '',
    path: [],
    landmarks: []
  };
  showJsonModal = false;
  generatedJson = '';

  // --- AUTH STATE ---

  // --- MAPAS ---
  private mapViewer: any;
  private viewerPolyline: any;

  // Rutas cargadas desde el servidor
  routes = signal<RouteData[]>([]);

  filteredRoutes = computed(() => {
    const q = this.searchQuery().toLowerCase();
    return this.routes().filter(r =>
      r.from.toLowerCase().includes(q) ||
      r.to.toLowerCase().includes(q) ||
      r.landmarks.some(l => l.toLowerCase().includes(q))
    );
  });

  onSaveRoute(route: RouteData) {
    // Aquí puedes guardar la ruta (crear o editar)
    // Por ejemplo, llamar a tu servicio y luego regresar a modo viewer
    this.newRoute = {
      from: '',
      to: '',
      type: 'taxi',
      schedule: {
        start: '',
        end: ''
      },
      color: '#3b82f6',
      description: '',
      path: [],
      landmarks: []
    };
    this.viewMode.set('viewer');
  }

  onCancelCreateRoute() {
    // Regresa a modo viewer sin guardar
    this.viewMode.set('viewer');
  }

  constructor(private routeService: RouteService, public authService: AuthService, private router: Router) { }

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

    // (Google sign-in moved to standalone Login page)
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
    setTimeout(() => {
      if (mode === 'viewer' && this.mapViewer) {
        this.mapViewer.invalidateSize();
      }
      // Ya no inicializamos ni manipulamos el mapa creator aquí
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
    if (route.path && typeof route.path === 'object' && 'coordinates' in route.path) {
      const geoCoords = route.path.coordinates as [number, number][];
      this.newRoute.path = geoCoords.map(coord => [coord[1], coord[0]] as [number, number]);
    }
    this.setViewMode('creator');
    // Ya no llamamos a loadPathIntoCreatorMap, CreateRouteComponent se encarga
    if (window.innerWidth < 768) this.isSidebarOpen.set(true);
  }

  resetCreator() {
    this.isEditing.set(false);
    this.newRoute = {
      from: '', to: '', type: 'taxi', schedule: { start: '', end: '' }, color: '#3b82f6', description: '', path: [], landmarks: []
    };
    this.landmarksString = '';
    // Ya no llamamos a clearCreatorMap, CreateRouteComponent se encarga
  }

  // --- CREADOR LÓGICA ---
  // initCreatorMap() eliminado, ahora es responsabilidad de CreateRouteComponent
  // addCreatorPoint() eliminado
  // loadPathIntoCreatorMap() eliminado
  // undoLastPoint() eliminado
  // removePoint() eliminado
  // clearCreatorMap() eliminado
  // redrawCreatorPolyline() eliminado
  // updateCreatorPolylineStyle() eliminado

  saveNewRoute() {
    if (!this.authService.isLoggedIn()) {
      alert('Necesitas iniciar sesión para crear una ruta.');
      this.goToLogin();
      return;
    }
    if (!this.newRoute.from.trim() || !this.newRoute.to.trim()) {
      alert('Por favor ingresa el inicio y fin de la ruta');
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
      from: this.newRoute.from,
      to: this.newRoute.to,
      type: this.newRoute.type,
      schedule: this.newRoute.schedule,
      color: this.newRoute.color,
      description: this.newRoute.description,
      landmarks: this.newRoute.landmarks,
      path: geoJsonPath,
      active: true,
      user: '' // TODO: Add user tracking
    };

    // Verificar si estamos editando o creando
    if (this.isEditing() && this.newRoute._id) {
      // Actualizar ruta existente
      this.routeService.updateRoute(this.newRoute._id, routeData).subscribe({
        next: (response) => {
          alert('✅ Ruta actualizada exitosamente');
          this.resetCreator();
          this.loadRoutes();
          this.setViewMode('viewer');
        },
        error: (error) => {
          console.error('Error al actualizar ruta:', error);
          alert('❌ Error al actualizar la ruta. Por favor intenta de nuevo.');
        }
      });
    } else {
      // Crear nueva ruta
      this.routeService.createRoute(routeData).subscribe({
        next: (response) => {
          alert('✅ Ruta guardada exitosamente');
          this.resetCreator();
          this.loadRoutes();
          this.setViewMode('viewer');
        },
        error: (error) => {
          console.error('Error al guardar ruta:', error);
          alert('❌ Error al guardar la ruta. Por favor intenta de nuevo.');
        }
      });
    }
  }

  getPathLength(): number {
    if (Array.isArray(this.newRoute.path)) {
      return this.newRoute.path.length;
    }
    return 0;
  }

  toggle24Hours() {
    this.is24Hours = !this.is24Hours;
    if (this.is24Hours && this.newRoute.schedule) {
      this.newRoute.schedule.start = '24 horas';
      this.newRoute.schedule.end = '24 horas';
    } else if (this.newRoute.schedule) {
      this.newRoute.schedule.start = '';
      this.newRoute.schedule.end = '';
    }
  }

  // Login is handled in the separate LoginComponent

  goToLogin() {
    this.router.navigate(['/login']);
  }

  logout() {
    this.authService.logout();
    this.setViewMode('viewer');
    this.resetCreator();
  }

  // Google handlers removed; managed in LoginComponent

  // Override startEditing to check auth
  overrideStartEditing(route: RouteData) {
    if (!this.authService.isLoggedIn()) {
      this.goToLogin();
      return;
    }
    this.startEditing(route);
  }

  // Override setViewMode for creator to check auth
  overrideSetViewMode(mode: 'viewer' | 'creator') {
    if (mode === 'creator' && !this.authService.isLoggedIn()) {
      this.goToLogin();
      return;
    }
    this.setViewMode(mode);
  }
}
