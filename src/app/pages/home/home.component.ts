import { Component, computed, signal, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CreateRouteComponent } from '../create-route/create-route.component';
import { RouteData } from '@interfaces';
import { RouteService } from '@services/route.service';
import { AuthService } from '@services/auth.service';
import { GeolocationService, UserLocation } from '@services/geolocation.service';
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
  // Propiedades del mapa creador (AÑADIDAS)
  private mapCreator: any;
  private creatorPolyline: any;
  private creatorMarkers: any[] = [];

  // Rutas cargadas desde el servidor
  routes = signal<RouteData[]>([]);

  // Geolocalización
  userLocation = signal<UserLocation | null>(null);
  sortByProximity = signal<boolean>(false);
  isLoadingLocation = signal<boolean>(false);

  filteredRoutes = computed(() => {
    const q = this.searchQuery().toLowerCase();
    let filtered = this.routes().filter(r =>
      r.from.toLowerCase().includes(q) ||
      r.to.toLowerCase().includes(q) ||
      r.landmarks.some(l => l.toLowerCase().includes(q))
    );

    // Ordenar por proximidad si está activado
    if (this.sortByProximity() && this.userLocation()) {
      const location = this.userLocation()!;
      filtered = [...filtered].sort((a, b) => {
        const distA = this.getRouteDistance(a, location);
        const distB = this.getRouteDistance(b, location);
        return distA - distB;
      });
    }

    return filtered;
  });

  // onSaveRoute eliminado o modificado: el guardado real lo hace saveNewRoute
  onSaveRoute(route: RouteData) {
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

  constructor(
    private routeService: RouteService,
    public authService: AuthService,
    private geolocationService: GeolocationService,
    private router: Router
  ) { }

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
    setTimeout(() => {
      if (mode === 'viewer' && this.mapViewer) {
        this.mapViewer.invalidateSize();
      }
      if (mode === 'creator') {
        this.initCreatorMap();
        if (this.mapCreator) {
          this.mapCreator.invalidateSize();
        }
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
    let initialPath: [number, number][] = [];
    if (route.path && typeof route.path === 'object' && 'coordinates' in route.path) {
      const geoCoords = route.path.coordinates as [number, number][];
      // Convertir [lng, lat] a [lat, lng] para Leaflet
      initialPath = geoCoords.map(coord => [coord[1], coord[0]] as [number, number]);
      this.newRoute.path = initialPath;
    } else if (Array.isArray(route.path)) {
      initialPath = route.path;
    }

    this.setViewMode('creator');

    // CAMBIO: Inicializa y carga la ruta en el mapa creador
    setTimeout(() => {
      this.initCreatorMap();
      if (initialPath.length > 0) {
        this.loadPathIntoCreatorMap(initialPath);
      }
    }, 100);

    if (window.innerWidth < 768) this.isSidebarOpen.set(true);
  }

  resetCreator() {
    this.isEditing.set(false);
    this.newRoute = {
      from: '', to: '', type: 'taxi', schedule: { start: '', end: '' }, color: '#3b82f6', description: '', path: [], landmarks: []
    };
    this.landmarksString = '';
    this.clearCreatorMap();
  }

  // --- CREADOR LÓGICA (Movida desde CreateRouteComponent) ---
  initCreatorMap() {
    const L = (window as any).L;
    const mapElement = document.getElementById('map-creator');
    if (this.mapCreator && this.mapCreator._container) return;
    if (!mapElement) return;

    this.mapCreator = L.map('map-creator', { zoomControl: false }).setView([32.5149, -117.0382], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(this.mapCreator);
    L.control.zoom({ position: 'bottomright' }).addTo(this.mapCreator);
    this.mapCreator.on('click', (e: any) => {
      this.addCreatorPoint(e.latlng.lat, e.latlng.lng);
    });
    if (this.isEditing() && Array.isArray(this.newRoute?.path) && this.newRoute.path.length > 0) {
      this.loadPathIntoCreatorMap(this.newRoute.path as [number, number][]);
    }
  }

  addCreatorPoint(lat: number, lng: number) {
    const L = (window as any).L;
    if (!this.mapCreator) return;
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

  undoLastPoint() {
    if (!Array.isArray(this.newRoute.path) || this.newRoute.path.length === 0 || !this.mapCreator) return;
    this.newRoute.path.pop();
    const lastMarker = this.creatorMarkers.pop();
    if (lastMarker) this.mapCreator.removeLayer(lastMarker);
    this.redrawCreatorPolyline();
  }

  clearCreatorMap() {
    if (!this.mapCreator) return;
    this.newRoute.path = [];
    this.creatorMarkers.forEach(m => this.mapCreator.removeLayer(m));
    this.creatorMarkers = [];
    if (this.creatorPolyline) this.mapCreator.removeLayer(this.creatorPolyline);
    this.mapCreator.setView([32.5149, -117.0382], 12);
  }

  redrawCreatorPolyline() {
    const L = (window as any).L;
    if (!this.mapCreator) return;
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
    if (!this.authService.isLoggedIn()) {
      alert('Necesitas iniciar sesión para crear una ruta.');
      this.goToLogin();
      return;
    }
    if (!this.newRoute.from.trim() || !this.newRoute.to.trim()) {
      alert('Por favor ingresa el inicio y fin de la ruta');
      return;
    }

    if (!Array.isArray(this.newRoute.path) || this.newRoute.path.length < 2) {
      alert('Por favor agrega al menos dos puntos en el mapa');
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
      user: this.authService.currentUser()?.email || ''
    };

    // Verificar si estamos editando o creando
    if (this.isEditing() && this.newRoute._id) {
      // Solo administradores pueden editar rutas existentes
      if (!this.authService.isAdmin()) {
        alert('❌ Solo los administradores pueden editar rutas.');
        return;
      }

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
      // Crear nueva ruta o proponer ruta
      if (this.authService.isAdmin()) {
        // Administradores crean rutas directamente
        this.routeService.createRoute(routeData).subscribe({
          next: (response) => {
            alert('✅ Ruta creada exitosamente');
            this.resetCreator();
            this.loadRoutes();
            this.setViewMode('viewer');
          },
          error: (error) => {
            console.error('Error al guardar ruta:', error);
            alert('❌ Error al guardar la ruta. Por favor intenta de nuevo.');
          }
        });
      } else {
        // Usuarios comunes proponen rutas para aprobación
        this.routeService.proposeRoute(routeData).subscribe({
          next: (response) => {
            alert('✅ Tu propuesta de ruta ha sido enviada para aprobación. Un administrador la revisará pronto.');
            this.resetCreator();
            this.setViewMode('viewer');
          },
          error: (error) => {
            console.error('Error al proponer ruta:', error);
            alert('❌ Error al enviar la propuesta. Por favor intenta de nuevo.');
          }
        });
      }
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

  goToLogin() {
    this.router.navigate(['/login']);
  }

  logout() {
    this.authService.logout();
    this.setViewMode('viewer');
    this.resetCreator();
  }

  overrideStartEditing(route: RouteData) {
    if (!this.authService.isLoggedIn()) {
      this.goToLogin();
      return;
    }
    this.startEditing(route);
  }

  overrideSetViewMode(mode: 'viewer' | 'creator') {
    if (mode === 'creator' && !this.authService.isLoggedIn()) {
      this.goToLogin();
      return;
    }
    this.setViewMode(mode);
  }

  // --- GEOLOCALIZACIÓN ---
  toggleSortByProximity() {
    if (!this.sortByProximity()) {
      if (!this.userLocation()) {
        this.getUserLocation();
      } else {
        this.sortByProximity.set(true);
      }
    } else {
      this.sortByProximity.set(false);
    }
  }

  getUserLocation() {
    this.isLoadingLocation.set(true);
    this.geolocationService.getCurrentPosition().subscribe({
      next: (location) => {
        this.isLoadingLocation.set(false);
        if (location) {
          this.userLocation.set(location);
          this.sortByProximity.set(true);
          console.log('Ubicación obtenida:', location);
          this.addUserLocationMarker(location);
        } else {
          alert('No se pudo obtener tu ubicación. Por favor, permite el acceso a la ubicación en tu navegador.');
        }
      },
      error: (error) => {
        this.isLoadingLocation.set(false);
        console.error('Error al obtener ubicación:', error);
        alert('Error al obtener tu ubicación. Por favor, verifica los permisos de ubicación.');
      }
    });
  }

  private userLocationMarker: any = null;

  addUserLocationMarker(location: UserLocation) {
    const L = (window as any).L;
    if (!L || !this.mapViewer) return;

    if (this.userLocationMarker) {
      this.mapViewer.removeLayer(this.userLocationMarker);
    }

    const userIcon = L.divIcon({
      className: 'user-location-marker',
      html: '<div style="background-color: #4285F4; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    this.userLocationMarker = L.marker(
      [location.latitude, location.longitude],
      { icon: userIcon }
    ).addTo(this.mapViewer);

    this.mapViewer.setView([location.latitude, location.longitude], 13);
  }

  getRouteDistance(route: RouteData, userLocation: UserLocation): number {
    let coordinates: [number, number][] = [];

    if (route.path && typeof route.path === 'object' && 'coordinates' in route.path) {
      const geoCoords = route.path.coordinates as [number, number][];
      coordinates = geoCoords.map(coord => [coord[1], coord[0]] as [number, number]);
    } else if (Array.isArray(route.path)) {
      coordinates = route.path;
    }

    if (coordinates.length === 0) {
      return Infinity;
    }

    return this.geolocationService.calculateMinDistanceToRoute(
      userLocation.latitude,
      userLocation.longitude,
      coordinates
    );
  }

  getRouteDistanceText(route: RouteData): string {
    if (!this.userLocation() || !this.sortByProximity()) {
      return '';
    }

    let coordinates: [number, number][] = [];

    if (route.path && typeof route.path === 'object' && 'coordinates' in route.path) {
      const geoCoords = route.path.coordinates as [number, number][];
      coordinates = geoCoords.map(coord => [coord[1], coord[0]] as [number, number]);
    } else if (Array.isArray(route.path)) {
      coordinates = route.path;
    }

    if (coordinates.length === 0) {
      return '';
    }

    const distance = this.geolocationService.calculateDistanceToRouteStart(
      this.userLocation()!.latitude,
      this.userLocation()!.longitude,
      coordinates
    );

    if (distance === Infinity) {
      return '';
    }

    if (distance < 1) {
      return `${Math.round(distance * 1000)} m al inicio`;
    }

    return `${distance.toFixed(1)} km al inicio`;
  }

  getImage(route: RouteData): string {
    if (!route.image) {
      return '/images/logo.png';
    }
    return `/images/${route.image}`;
  }

  goToAdminProposals() {
    this.router.navigate(['/admin-proposals']);
  }
}
