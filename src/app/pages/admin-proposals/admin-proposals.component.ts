import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouteService } from '@services/route.service';
import { AuthService } from '@services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-proposals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-proposals.component.html',
  styleUrls: ['./admin-proposals.component.css']
})
export class AdminProposalsComponent implements OnInit {
  proposals = signal<any[]>([]);
  isLoading = signal(false);
  selectedProposal = signal<any | null>(null);
  showRejectModal = signal(false);
  rejectionReason = '';

  // Mapa para visualizar la propuesta seleccionada
  private map: any;
  private polyline: any;

  constructor(
    private routeService: RouteService,
    public authService: AuthService,
    private router: Router
  ) { }

  ngOnInit() {
    // Verificar si el usuario tiene acceso a esta página
    if (!this.authService.hasAccessToRoute('/admin-proposals')) {
      alert('No tienes permisos para acceder a esta página');
      this.router.navigate(['/home']);
      return;
    }

    this.loadLeafletResources();
    this.loadPendingProposals();
  }

  loadLeafletResources() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    document.head.appendChild(script);
  }

  loadPendingProposals() {
    this.isLoading.set(true);
    this.routeService.getPendingProposals().subscribe({
      next: (response: any) => {
        console.log('Propuestas pendientes:', response);
        this.proposals.set(response.data || []);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error al cargar propuestas:', error);
        alert('Error al cargar las propuestas pendientes');
        this.isLoading.set(false);
      }
    });
  }

  selectProposal(proposal: any) {
    this.selectedProposal.set(proposal);
    this.isEditing.set(false);

    // Inicializar el mapa si no existe
    setTimeout(() => {
      this.initMap(proposal);
    }, 100);
  }

  initMap(proposal: any) {
    const L = (window as any).L;
    if (!L) return;

    const mapElement = document.getElementById('proposal-map');
    if (!mapElement) return;

    // Limpiar mapa anterior si existe
    if (this.map) {
      this.map.remove();
    }

    this.map = L.map('proposal-map', { zoomControl: false }).setView([32.5149, -117.0382], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(this.map);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    // Dibujar la ruta propuesta
    if (proposal.path && proposal.path.coordinates) {
      const coordinates = proposal.path.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);

      this.polyline = L.polyline(coordinates, {
        color: proposal.color || '#3b82f6',
        weight: 6,
        opacity: 0.9,
        lineJoin: 'round'
      }).addTo(this.map);

      this.map.fitBounds(this.polyline.getBounds(), {
        padding: [50, 50],
        maxZoom: 14
      });
    }
  }

  approveProposal(proposal: any) {
    if (!confirm(`¿Estás seguro de que deseas aprobar la ruta "${proposal.from} → ${proposal.to}"?`)) {
      return;
    }

    const approvedBy = this.authService.currentUser()?.email || 'admin';

    this.routeService.approveProposal(proposal._id, approvedBy).subscribe({
      next: (response) => {
        alert('✅ Propuesta aprobada exitosamente');
        this.loadPendingProposals();
        this.selectedProposal.set(null);
      },
      error: (error) => {
        console.error('Error al aprobar propuesta:', error);
        alert('❌ Error al aprobar la propuesta');
      }
    });
  }

  openRejectModal(proposal: any) {
    this.selectedProposal.set(proposal);
    this.showRejectModal.set(true);
    this.rejectionReason = '';
  }

  closeRejectModal() {
    this.showRejectModal.set(false);
    this.rejectionReason = '';
  }

  isEditing = signal(false);
  editForm: any = {};
  // Variable para controlar si el mapa está en modo "captura de puntos"
  isDrawing = signal(false);

  startEdit(proposal: any) {
    this.editForm = JSON.parse(JSON.stringify(proposal)); // Deep copy simple

    // Normalizar datos para el formulario
    if (this.editForm.type) {
      this.editForm.type = this.editForm.type.toLowerCase();
    }

    // Asegurar que schedule existe para evitar errores
    if (!this.editForm.schedule) {
      this.editForm.schedule = { start: '', end: '' };
    } else {
      // Normalizar horas
      this.editForm.schedule.start = this.convertTo24Hour(this.editForm.schedule.start);
      this.editForm.schedule.end = this.convertTo24Hour(this.editForm.schedule.end);
    }

    // Asegurar path
    if (!this.editForm.path) {
      this.editForm.path = { coordinates: [] };
    }

    this.isEditing.set(true);
    // Re-inicializar mapa con los datos del formulario de edición para que refleje cambios en tiempo real
    setTimeout(() => {
      this.initMap(this.editForm);
      this.setupMapEventHandlers();
    }, 100);
  }

  private convertTo24Hour(timeStr: string): string {
    if (!timeStr) return '';
    // Si ya es formato HH:mm, devolverlo
    // Regex simple para HH:mm 24hrs
    if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr)) return timeStr;

    // Intentar convertir AM/PM
    const parts = timeStr.trim().split(' ');
    // Si no hay espacio o formato raro, dejarlo pasar (el input lo ignorará o lo borrará si no es válido)
    if (parts.length < 2) return timeStr;

    const time = parts[0];
    const modifier = parts[1];

    let [hours, minutes] = time.split(':');

    // Si no hay minutos definidas en string tipo "5 PM", asumir 00
    if (!minutes) {
      minutes = '00';
    }

    let hoursInt = parseInt(hours, 10);

    // Ajuste AM/PM
    if (modifier && modifier.toUpperCase() === 'PM' && hoursInt < 12) {
      hoursInt += 12;
    }
    if (modifier && modifier.toUpperCase() === 'AM' && hoursInt === 12) {
      hoursInt = 0;
    }

    return `${hoursInt.toString().padStart(2, '0')}:${minutes}`;
  }

  setupMapEventHandlers() {
    if (!this.map) return;

    this.map.off('click'); // Limpiar listeners anteriores
    this.map.on('click', (e: any) => {
      if (this.isEditing()) {
        this.addPoint(e.latlng);
      }
    });
  }

  addPoint(latlng: any) {
    // Leaflet usa [lat, lng], GeoJSON usa [lng, lat]
    const newPoint = [latlng.lng, latlng.lat];

    if (!this.editForm.path) this.editForm.path = { coordinates: [] };
    if (!this.editForm.path.coordinates) this.editForm.path.coordinates = [];

    this.editForm.path.coordinates.push(newPoint);

    // Redibujar mapa
    this.updateMapPolyline();
  }

  updateMapPolyline() {
    const L = (window as any).L;
    if (!L || !this.map) return;

    // Remover polyline anterior
    if (this.polyline) {
      this.map.removeLayer(this.polyline);
    }

    const coordinates = this.editForm.path.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);

    this.polyline = L.polyline(coordinates, {
      color: this.editForm.color || '#3b82f6',
      weight: 6,
      opacity: 0.9,
      lineJoin: 'round',
      dashArray: '10, 10' // Estilo punteado para indicar edición
    }).addTo(this.map);
  }

  clearPath() {
    if (!confirm('¿Borrar toda la ruta traza?')) return;
    if (this.editForm.path) {
      this.editForm.path.coordinates = [];
      this.updateMapPolyline();
    }
  }

  undoLastPoint() {
    if (this.editForm.path && this.editForm.path.coordinates.length > 0) {
      this.editForm.path.coordinates.pop();
      this.updateMapPolyline();
    }
  }

  cancelEdit() {
    this.isEditing.set(false);
    this.editForm = {};
    if (this.selectedProposal()) {
      setTimeout(() => this.initMap(this.selectedProposal()), 100);
    }
  }

  saveEdit() {
    if (!this.selectedProposal()) return;

    this.routeService.updateProposal(this.selectedProposal()._id, this.editForm).subscribe({
      next: (response: any) => {
        alert('✅ Propuesta actualizada correctamente');
        this.isEditing.set(false);
        const updatedProposal = response.data;

        // Actualizar la lista localmente para reflejar cambios inmediatos
        const currentProposals = this.proposals();
        const index = currentProposals.findIndex(p => p._id === updatedProposal._id);
        if (index !== -1) {
          currentProposals[index] = updatedProposal;
          this.proposals.set([...currentProposals]);
        }

        // Actualizar el seleccionado
        this.selectedProposal.set(updatedProposal);

        // Redibujar mapa si cambió el color o algo visual (opcional)
        setTimeout(() => {
          this.initMap(updatedProposal);
        }, 100);
      },
      error: (error) => {
        console.error('Error al actualizar propuesta:', error);
        alert('❌ Error al actualizar la propuesta');
      }
    });
  }

  rejectProposal() {
    const proposal = this.selectedProposal();
    if (!proposal) return;

    const rejectedBy = this.authService.currentUser()?.email || 'admin';

    this.routeService.rejectProposal(proposal._id, this.rejectionReason, rejectedBy).subscribe({
      next: (response) => {
        alert('✅ Propuesta rechazada');
        this.loadPendingProposals();
        this.closeRejectModal();
        this.selectedProposal.set(null);
      },
      error: (error) => {
        console.error('Error al rechazar propuesta:', error);
        alert('❌ Error al rechazar la propuesta');
      }
    });
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  goBack() {
    this.router.navigate(['/home']);
  }
}
