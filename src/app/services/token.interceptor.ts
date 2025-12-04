import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const token = authService.getToken();

  console.log('🔐 Interceptor - Token:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
  console.log('🔐 Interceptor - Token válido:', authService.isTokenValid());
  console.log('🔐 Interceptor - URL:', req.url);

  // Solo agregar el token si existe y es válido
  if (token && authService.isTokenValid()) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log('✅ Token agregado al header Authorization');

    return next(cloned).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('❌ Error en petición:', error.status, error.message);
        if (error.status === 401) {
          // Token inválido o expirado según el servidor
          console.warn('Respuesta 401: Token inválido o expirado. Cerrando sesión...');
          authService.logout();
          router.navigate(['/login']);
        }
        if (error.status === 403) {
          console.warn('Respuesta 403: Acceso denegado.');
        }
        return throwError(() => error);
      })
    );
  }

  console.log('⚠️ Token NO agregado (no existe o no es válido)');

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      console.error('❌ Error en petición sin token:', error.status, error.message);
      if (error.status === 401) {
        console.warn('Respuesta 401: No autenticado.');
        authService.logout();
        router.navigate(['/login']);
      }
      if (error.status === 403) {
        console.warn('Respuesta 403: Acceso denegado. Token no enviado o inválido.');
      }
      return throwError(() => error);
    })
  );
};
