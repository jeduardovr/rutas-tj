# Instrucciones para Aplicar Cambios de Geolocalización

## Archivo: home.component.ts

### 1. Línea 7 - Agregar import (después de línea 7):
```typescript
import { GeolocationService, UserLocation } from '@services/geolocation.service';
```

### 2. Línea 56 - Agregar propiedades de geolocalización (después de `routes = signal<RouteData[]>([]);`):
```typescript
  
  // Geolocalización
  userLocation = signal<UserLocation | null>(null);
  sortByProximity = signal<boolean>(false);
  isLoadingLocation = signal<boolean>(false);
```

### 3. Línea 58-65 - Reemplazar filteredRoutes computed:
```typescript
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
```

### 4. Línea 90 - Actualizar constructor:
```typescript
  constructor(
    private routeService: RouteService, 
    public authService: AuthService, 
    private geolocationService: GeolocationService,
    private router: Router
  ) { }
```

### 5. Al final del archivo (antes del último `}`), agregar estos métodos:

```typescript
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
```

## Resumen de Cambios

1. ✅ Import de GeolocationService
2. ✅ Propiedades de estado (userLocation, sortByProximity, isLoadingLocation)
3. ✅ Actualización de filteredRoutes para ordenar por proximidad
4. ✅ Inyección de GeolocationService en constructor
5. ✅ Métodos para obtener ubicación y calcular distancias
6. ✅ Método para mostrar distancia al inicio de la ruta

## Beneficio Principal

Ahora las rutas se ordenarán priorizando aquellas que **comienzan** cerca del usuario (70% peso), 
en lugar de solo mostrar cualquier ruta que tenga algún punto cercano.
