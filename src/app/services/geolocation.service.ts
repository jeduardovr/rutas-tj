import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface UserLocation {
    latitude: number;
    longitude: number;
}

@Injectable({
    providedIn: 'root'
})
export class GeolocationService {
    private currentLocation: UserLocation | null = null;

    constructor() { }

    /**
     * Obtiene la ubicación actual del usuario
     */
    getCurrentPosition(): Observable<UserLocation | null> {
        if (!navigator.geolocation) {
            console.error('La geolocalización no está soportada por este navegador.');
            return of(null);
        }

        return from(
            new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            })
        ).pipe(
            map(position => {
                const location: UserLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };
                this.currentLocation = location;
                return location;
            }),
            catchError(error => {
                console.error('Error al obtener la ubicación:', error);
                return of(null);
            })
        );
    }

    /**
     * Calcula la distancia entre dos puntos usando la fórmula de Haversine
     * @param lat1 Latitud del punto 1
     * @param lon1 Longitud del punto 1
     * @param lat2 Latitud del punto 2
     * @param lon2 Longitud del punto 2
     * @returns Distancia en kilómetros
     */
    calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Radio de la Tierra en kilómetros
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        return distance;
    }

    /**
     * Convierte grados a radianes
     */
    private toRadians(degrees: number): number {
        return degrees * (Math.PI / 180);
    }

    /**
     * Calcula la distancia ponderada desde un punto a una ruta
     * Prioriza el punto de INICIO de la ruta (donde el usuario la tomaría)
     * @param userLat Latitud del usuario
     * @param userLon Longitud del usuario
     * @param path Array de coordenadas [lat, lng]
     * @returns Distancia ponderada en kilómetros
     */
    calculateMinDistanceToRoute(userLat: number, userLon: number, path: [number, number][]): number {
        if (!path || path.length === 0) {
            return Infinity;
        }

        // Distancia al punto de INICIO de la ruta (más importante)
        const [startLat, startLng] = path[0];
        const distanceToStart = this.calculateDistance(userLat, userLon, startLat, startLng);

        // Distancia al punto FINAL de la ruta (menos importante)
        const [endLat, endLng] = path[path.length - 1];
        const distanceToEnd = this.calculateDistance(userLat, userLon, endLat, endLng);

        // Distancia mínima a cualquier punto de la ruta (para rutas que pasan cerca)
        let minDistanceToPath = Infinity;
        for (const point of path) {
            const [lat, lng] = point;
            const distance = this.calculateDistance(userLat, userLon, lat, lng);
            if (distance < minDistanceToPath) {
                minDistanceToPath = distance;
            }
        }

        // Algoritmo ponderado:
        // - 70% peso al punto de inicio (donde el usuario tomaría la ruta)
        // - 20% peso a la proximidad de la ruta (si pasa cerca)
        // - 10% peso al punto final
        const weightedDistance =
            (distanceToStart * 0.7) +
            (minDistanceToPath * 0.2) +
            (distanceToEnd * 0.1);

        return weightedDistance;
    }

    /**
     * Calcula solo la distancia al punto de inicio de la ruta
     * Útil para mostrar al usuario qué tan lejos está el inicio
     */
    calculateDistanceToRouteStart(userLat: number, userLon: number, path: [number, number][]): number {
        if (!path || path.length === 0) {
            return Infinity;
        }

        const [startLat, startLng] = path[0];
        return this.calculateDistance(userLat, userLon, startLat, startLng);
    }

    /**
     * Obtiene la ubicación guardada en caché
     */
    getCachedLocation(): UserLocation | null {
        return this.currentLocation;
    }
}
