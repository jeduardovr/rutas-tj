import { Component, OnInit, Input, Output, EventEmitter, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouteData } from '@interfaces';

@Component({
  selector: 'app-create-route',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-route.component.html',
  styleUrls: ['./create-route.component.css']
})
export class CreateRouteComponent implements OnInit, AfterViewInit {
  @Input() newRoute: RouteData = {
    from: '',
    to: '',
    type: 'taxi',
    color: '#3b82f6',
    description: '',
    path: [],
    landmarks: [],
    schedule: { start: '', end: '' }
  };
  @Input() isEditing: boolean = false;
  @Input() is24Hours: boolean = false;
  @Input() landmarksString: string = '';
  @Output() saveRoute = new EventEmitter<RouteData>();
  @Output() cancel = new EventEmitter<void>();

  showJsonModal = false;
  generatedJson = '';

  private mapCreator: any;
  private creatorPolyline: any;
  private creatorMarkers: any[] = [];

  get safeSchedule() {
    return this.newRoute.schedule ?? { start: '', end: '' };
  }

  ngOnInit() {
    this.loadLeafletResources()
    if (!this.newRoute.schedule) {
      this.newRoute.schedule = { start: '', end: '' };
    }
    if (!this.newRoute.color || !/^#[0-9A-Fa-f]{6}$/.test(this.newRoute.color)) {
      this.newRoute.color = '#3b82f6';
    }
  }

  ngAfterViewInit() {
    const checkLeaflet = setInterval(() => {
      if ((window as any).L) {
        clearInterval(checkLeaflet);
        ;console.log('entra?');
        
        this.initCreatorMap();
      }
    }, 100);

    // (Google sign-in moved to standalone Login page)
  }

  loadLeafletResources(callback?: () => void) {
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

  initCreatorMap() {
    const L = (window as any).L;
    if (this.mapCreator && this.mapCreator._container) return;
    this.mapCreator = L.map('map-creator', { zoomControl: false }).setView([32.5149, -117.0382], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(this.mapCreator);
    L.control.zoom({ position: 'bottomright' }).addTo(this.mapCreator);
    this.mapCreator.on('click', (e: any) => {
      this.addCreatorPoint(e.latlng.lat, e.latlng.lng);
    });
    if (this.isEditing && Array.isArray(this.newRoute?.path) && this.newRoute.path.length > 0) {
      this.loadPathIntoCreatorMap(this.newRoute.path as [number, number][]);
    }
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
  }

  getPathLength(): number {
    if (Array.isArray(this.newRoute?.path)) {
      return this.newRoute.path.length;
    }
    return 0;
  }

  saveNewRoute() {
    if (!this.newRoute.from.trim() || !this.newRoute.to.trim()) {
      alert('Por favor ingresa el inicio y fin de la ruta');
      return;
    }
    if (!Array.isArray(this.newRoute.path) || this.newRoute.path.length < 2) {
      alert('Por favor traza al menos dos puntos en el mapa');
      return;
    }
    this.newRoute.landmarks = this.landmarksString.split(',').map(s => s.trim()).filter(s => s.length > 0);
    const coordinatesGeoJson = this.newRoute.path.map(point => [point[1], point[0]]);
    const routeDataToSimulate = {
      ...this.newRoute,
      path: {
        type: "LineString",
        coordinates: coordinatesGeoJson
      },
      active: true
    };
    this.generatedJson = JSON.stringify({ action: this.isEditing ? "UPDATE" : "CREATE", data: routeDataToSimulate }, null, 2);
    this.showJsonModal = true;
    this.saveRoute.emit(this.newRoute);
  }

  copyJson(): void {
    if (this.generatedJson) {
      navigator.clipboard.writeText(this.generatedJson).then(() => {
        alert('JSON copiado al portapapeles');
      });
    }
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
}