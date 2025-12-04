import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Verificar si el usuario está autenticado
  if (!authService.isLoggedIn()) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  // Obtener la ruta a la que se intenta acceder
  const requestedRoute = state.url;

  // Rutas que solo requieren autenticación (no verificación de permisos específicos)
  const authOnlyRoutes = ['/create-route'];

  if (authOnlyRoutes.includes(requestedRoute)) {
    // Solo verificar que esté autenticado (ya verificado arriba)
    return true;
  }

  // Para otras rutas, verificar permisos específicos
  if (!authService.hasAccessToRoute(requestedRoute)) {
    console.warn(`Acceso denegado a la ruta: ${requestedRoute}`);
    alert('No tienes permisos para acceder a esta página');
    router.navigate(['/home']);
    return false;
  }

  return true;
};
