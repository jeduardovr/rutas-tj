import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { RouteData } from '@interfaces';

@Injectable({
  providedIn: 'root'
})
export class RouteService {
  private apiUrl = `${environment.apiUrl}route/`;

  constructor(private http: HttpClient) { }

  // Ejemplo: Obtener todas las rutas desde el servidor
  getRoutes(): Observable<RouteData[]> {
    return this.http.get<RouteData[]>(`${this.apiUrl}`);
  }

  // Ejemplo: Obtener una ruta específica por ID
  getRouteById(id: string): Observable<RouteData> {
    return this.http.get<RouteData>(`${this.apiUrl}/${id}`);
  }

  // Ejemplo: Buscar rutas por término
  searchRoutes(query: string): Observable<RouteData[]> {
    return this.http.get<RouteData[]>(`${this.apiUrl}search?q=${query}`);
  }

  // Crear una nueva ruta
  createRoute(route: any): Observable<any> {
    return this.http.post(`${this.apiUrl}`, route);
  }

  // Proponer una nueva ruta (para usuarios no admin)
  proposeRoute(route: any): Observable<any> {
    return this.http.post(`${this.apiUrl}propose`, route);
  }

  updateRoute(id: string, routeData: any): Observable<any> {
    return this.http.put(`${this.apiUrl}${id}`, routeData);
  }

  // Obtener propuestas pendientes (solo admin)
  getPendingProposals(): Observable<any> {
    return this.http.get(`${this.apiUrl}pending`);
  }

  // Actualizar una propuesta (antes de aprobar/rechazar)
  updateProposal(id: string, proposalData: any): Observable<any> {
    return this.http.put(`${this.apiUrl}pending/${id}`, proposalData);
  }

  // Aprobar una propuesta (solo admin)
  approveProposal(id: string, approvedBy?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}${id}/approve`, { approvedBy });
  }

  // Rechazar una propuesta (solo admin)
  rejectProposal(id: string, reason?: string, rejectedBy?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}${id}/reject`, { reason, rejectedBy });
  }

  // Eliminar (desactivar) una ruta (solo admin)
  deleteRoute(id: string): Observable<any> {
    return this.http.put(`${this.apiUrl}delete`, { id });
  }
}
