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
