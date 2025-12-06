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
        // Initialization moved to AppComponent to avoid Circular Dependency in Interceptor
    }

    verifySession(): Observable<any> {
        return this.http.get(`${this.apiUrl}user/verify`);
    }

    public loadUserFromStorage() {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');

        if (token && user) {
            // Validar si el token está expirado
            if (this.isTokenExpired(token)) {
                console.warn('Token expirado. Cerrando sesión...');
                this.logout();
            } else {
                this.currentUser.set(JSON.parse(user));

                // Validar sesión con el backend
                this.verifySession().subscribe({
                    next: (res) => {
                        console.log('Sesión validada con éxito', res);
                        if (res.user) {
                            this.currentUser.set(res.user);
                            localStorage.setItem('user', JSON.stringify(res.user));
                        }
                    },
                    error: (err) => {
                        console.warn('Sesión inválida en el backend. Cerrando sesión...', err);
                        this.logout();
                    }
                });
            }
        }
    }

    /**
     * Decodifica el payload del token JWT
     */
    private decodeToken(token: string): any {
        try {
            if (!token || token.split('.').length < 3) {
                return null;
            }
            const payload = token.split('.')[1];
            const decodedPayload = atob(payload);
            return JSON.parse(decodedPayload);
        } catch (error) {
            // No loguear error para evitar ruido en consola si el token no es JWT
            return null;
        }
    }

    /**
     * Verifica si el token JWT ha expirado
     */
    private isTokenExpired(token: string): boolean {
        const decoded = this.decodeToken(token);

        // Si no se puede decodificar (no es JWT estándar o está encriptado), 
        // asumimos que es válido y dejamos que el backend lo valide en las peticiones.
        if (!decoded) {
            return false;
        }

        if (!decoded.exp) {
            return false; // Si es JWT pero no tiene campo exp, asumimos válido
        }

        const expirationDate = decoded.exp * 1000;
        const currentDate = Date.now();

        return currentDate >= expirationDate;
    }

    /**
     * Valida si el token actual sigue siendo válido
     * NOTA: No realiza logout automático para evitar efectos secundarios en la vista (NG0600)
     */
    isTokenValid(): boolean {
        const token = this.getToken();

        if (!token) {
            return false;
        }

        if (this.isTokenExpired(token)) {
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

    googleLogin(credential: string, mode: 'login' | 'register'): Observable<any> {
        return this.http.post(`${this.apiUrl}user/google`, { credential, mode }).pipe(
            tap((response: any) => this.handleAuthResponse(response))
        );
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        this.currentUser.set(null);
    }

    private handleAuthResponse(response: any) {
        console.log("🚀 ~ AuthService ~ handleAuthResponse ~ response:", response);

        // Normalizar la respuesta: a veces viene directa, a veces dentro de 'data'
        const data = response.data || response;

        const token = data.token || response.token;
        const user = data.user || response.user;

        if (token && user) {
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            this.currentUser.set(user);
        } else {
            console.error('La respuesta de login no contiene token o usuario:', response);
        }
    }

    isLoggedIn(): boolean {
        return !!this.currentUser() && this.isTokenValid();
    }

    getToken(): string | null {
        return localStorage.getItem('token');
    }

    isAdmin(): boolean {
        const user = this.currentUser();
        return user && (user.role === 'admin' || user.role?.name === 'SUPER ADMINISTRADOR');
    }

    /**
     * Verifica si el usuario tiene acceso a una ruta específica
     * @param route Ruta a verificar (ej: '/admin-proposals')
     * @returns true si el usuario tiene acceso, false en caso contrario
     */
    hasAccessToRoute(route: string): boolean {
        const user = this.currentUser();

        if (!user) {
            return false;
        }

        // Si el usuario tiene un objeto role con routes
        if (user.role && typeof user.role === 'object' && Array.isArray(user.role.routes)) {
            return user.role.routes.includes(route);
        }

        // Fallback: si no hay información de rutas, permitir acceso básico
        return true;
    }

    /**
     * Obtiene todas las rutas permitidas para el usuario actual
     * @returns Array de rutas permitidas
     */
    getAllowedRoutes(): string[] {
        const user = this.currentUser();

        if (!user) {
            return [];
        }

        // Si el usuario tiene un objeto role con routes
        if (user.role && typeof user.role === 'object' && Array.isArray(user.role.routes)) {
            return user.role.routes;
        }

        // Fallback: rutas básicas
        return ['/home', '/login'];
    }

    /**
     * Obtiene el nombre del rol del usuario
     * @returns Nombre del rol o null
     */
    getRoleName(): string | null {
        const user = this.currentUser();

        if (!user) {
            return null;
        }

        // Si el usuario tiene un objeto role con name
        if (user.role && typeof user.role === 'object' && user.role.name) {
            return user.role.name;
        }

        // Fallback: retornar el role si es string
        if (typeof user.role === 'string') {
            return user.role;
        }

        return null;
    }
}
