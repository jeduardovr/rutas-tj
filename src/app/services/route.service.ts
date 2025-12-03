import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { RouteData } from '@interfaces';

@Injectable({
  providedIn: 'root'
})
export class RouteService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  // Ejemplo: Obtener todas las rutas desde el servidor
  getRoutes(): Observable<RouteData[]> {
    return this.http.get<RouteData[]>(`${this.apiUrl}route/`);
  }

  // Ejemplo: Obtener una ruta específica por ID
  getRouteById(id: string): Observable<RouteData> {
    return this.http.get<RouteData>(`${this.apiUrl}route/${id}`);
  }

  // Ejemplo: Buscar rutas por término
  searchRoutes(query: string): Observable<RouteData[]> {
    return this.http.get<RouteData[]>(`${this.apiUrl}route/search?q=${query}`);
  }

  // Crear una nueva ruta
  createRoute(route: any): Observable<any> {
    return this.http.post(`${this.apiUrl}route/`, route);
  }

  // Proponer una nueva ruta (para usuarios no admin)
  proposeRoute(route: any): Observable<any> {
    return this.http.post(`${this.apiUrl}route/propose`, route);
  }

  updateRoute(id: string, routeData: any): Observable<any> {
    return this.http.put(`${this.apiUrl}route/${id}`, routeData);
  }
}
