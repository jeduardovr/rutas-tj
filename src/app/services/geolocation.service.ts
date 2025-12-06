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
                const options = {
                    enableHighAccuracy: true,
                    timeout: 20000,
                    maximumAge: 0
                };

                let bestPosition: GeolocationPosition | null = null;
                let watchId: number;

                // Timeout de seguridad: si no obtenemos una precisión excelente en 5s,
                // devolvemos la mejor que tengamos.
                const timeoutId = setTimeout(() => {
                    navigator.geolocation.clearWatch(watchId);
                    if (bestPosition) {
                        console.log('Timeout de precisión agotado. Usando mejor posición:', bestPosition.coords.accuracy + 'm');
                        resolve(bestPosition);
                    } else {
                        // Si no tenemos NADA, intentamos una última llamada directa o rechazamos
                        navigator.geolocation.getCurrentPosition(resolve, reject, options);
                    }
                }, 5000);

                watchId = navigator.geolocation.watchPosition(
                    (position) => {
                        // Si es la primera o tiene mejor precisión, guardarla
                        if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
                            bestPosition = position;
                        }

                        // Si la precisión es muy buena (< 15 metros), terminamos temprano
                        if (position.coords.accuracy <= 15) {
                            console.log('Precisión excelente alcanzada:', position.coords.accuracy + 'm');
                            clearTimeout(timeoutId);
                            navigator.geolocation.clearWatch(watchId);
                            resolve(position);
                        }
                    },
                    (error) => {
                        // Si es un error de permisos, fallar inmediato. Si es timeout/unavailable, esperar un poco más si el timer sigue.
                        if (error.code === error.PERMISSION_DENIED) {
                            clearTimeout(timeoutId);
                            navigator.geolocation.clearWatch(watchId);
                            reject(error);
                        }
                    },
                    options
                );
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
