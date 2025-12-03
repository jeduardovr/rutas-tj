import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '@environments/environment';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private apiUrl = environment.apiUrl;
    currentUser = signal<any>(null);

    constructor(private http: HttpClient) {
        this.loadUserFromStorage();
    }

    private loadUserFromStorage() {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');

        if (token && user) {
            // Validar si el token está expirado
            if (this.isTokenExpired(token)) {
                console.warn('Token expirado. Cerrando sesión...');
                this.logout();
            } else {
                this.currentUser.set(JSON.parse(user));
            }
        }
    }

    /**
     * Decodifica el payload del token JWT
     */
    private decodeToken(token: string): any {
        try {
            const payload = token.split('.')[1];
            const decodedPayload = atob(payload);
            return JSON.parse(decodedPayload);
        } catch (error) {
            console.error('Error al decodificar el token:', error);
            return null;
        }
    }

    /**
     * Verifica si el token JWT ha expirado
     */
    private isTokenExpired(token: string): boolean {
        const decoded = this.decodeToken(token);

        if (!decoded || !decoded.exp) {
            return true; // Si no se puede decodificar o no tiene exp, considerarlo expirado
        }

        // exp está en segundos, Date.now() está en milisegundos
        const expirationDate = decoded.exp * 1000;
        const currentDate = Date.now();

        return currentDate >= expirationDate;
    }

    /**
     * Valida si el token actual sigue siendo válido
     */
    isTokenValid(): boolean {
        const token = this.getToken();

        if (!token) {
            return false;
        }

        if (this.isTokenExpired(token)) {
            this.logout();
            return false;
        }

        return true;
    }

    register(userData: any): Observable<any> {
        return this.http.post(`${this.apiUrl}user/register`, userData).pipe(
            tap((response: any) => this.handleAuthResponse(response))
        );
    }

    login(credentials: any): Observable<any> {
        return this.http.post(`${this.apiUrl}user/login`, credentials).pipe(
            tap((response: any) => this.handleAuthResponse(response))
        );
    }

    googleLogin(credential: string): Observable<any> {
        return this.http.post(`${this.apiUrl}user/google`, { credential }).pipe(
            tap((response: any) => this.handleAuthResponse(response))
        );
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        this.currentUser.set(null);
    }

    private handleAuthResponse(response: any) {
        console.log("🚀 ~ AuthService ~ handleAuthResponse ~ response:", response)
        if (response.token && response.user) {
            localStorage.setItem('token', response.token);
            localStorage.setItem('user', JSON.stringify(response.user));
            this.currentUser.set(response.user);
        }
    }

    isLoggedIn(): boolean {
        return !!this.currentUser() && this.isTokenValid();
    }

    getToken(): string | null {
        return localStorage.getItem('token');
    }
}
