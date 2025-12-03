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
        const user = localStorage.getItem('user');
        if (user) {
            this.currentUser.set(JSON.parse(user));
        }
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
        if (response.token && response.user) {
            localStorage.setItem('token', response.token);
            localStorage.setItem('user', JSON.stringify(response.user));
            this.currentUser.set(response.user);
        }
    }

    isLoggedIn(): boolean {
        return !!this.currentUser();
    }

    getToken(): string | null {
        return localStorage.getItem('token');
    }
}
