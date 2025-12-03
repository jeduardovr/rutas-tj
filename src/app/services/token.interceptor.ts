import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {
  constructor(
    private authService: AuthService,
    private router: Router
  ) { }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.authService.getToken();

    // Solo agregar el token si existe y es válido
    if (token && this.authService.isTokenValid()) {
      const cloned = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });

      return next.handle(cloned).pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 401) {
            // Token inválido o expirado según el servidor
            console.warn('Respuesta 401: Token inválido o expirado. Cerrando sesión...');
            this.authService.logout();
            this.router.navigate(['/']);
          }
          return throwError(() => error);
        })
      );
    }

    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          console.warn('Respuesta 401: No autenticado.');
          this.authService.logout();
          this.router.navigate(['/']);
        }
        return throwError(() => error);
      })
    );
  }
}
