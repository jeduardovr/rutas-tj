import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
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
export class CreateRouteComponent implements OnInit {
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
  @Input() pathLength: number = 0; // CORREGIDO: Input para recibir la longitud del path

  @Output() saveRoute = new EventEmitter<RouteData>();
  @Output() cancel = new EventEmitter<void>();
  @Output() undoPoint = new EventEmitter<void>();
  @Output() removePoint = new EventEmitter<number>();
  @Output() clearMap = new EventEmitter<void>();
  @Output() updateColor = new EventEmitter<string>();

  showJsonModal = false;
  generatedJson = '';

  get safeSchedule() {
    return this.newRoute.schedule ?? { start: '', end: '' };
  }

  ngOnInit() {
    if (!this.newRoute.schedule) {
      this.newRoute.schedule = { start: '', end: '' };
    }
    if (!this.newRoute.color || !/^#[0-9A-Fa-f]{6}$/.test(this.newRoute.color)) {
      this.newRoute.color = '#3b82f6';
    }
  }

  // CORREGIDO: Función para acceder al Input pathLength
  getPathLength(): number {
    return this.pathLength;
  }

  getRoutePoints(): [number, number][] {
    if (Array.isArray(this.newRoute.path)) {
      return this.newRoute.path;
    }
    return [];
  }

  // CORREGIDO: Función onColorChange para emitir el evento
  onColorChange() {
    this.updateColor.emit(this.newRoute.color);
  }

  saveNewRoute() {
    if (!this.newRoute.from.trim() || !this.newRoute.to.trim()) {
      alert('Por favor ingresa el inicio y fin de la ruta');
      return;
    }
    if (this.pathLength < 2) {
      alert('Por favor traza al menos dos puntos en el mapa');
      return;
    }
    this.newRoute.landmarks = this.landmarksString.split(',').map(s => s.trim()).filter(s => s.length > 0);

    // Aquí solo emitimos el evento. La lógica de API está en el padre.
    this.saveRoute.emit(this.newRoute);
  }
}