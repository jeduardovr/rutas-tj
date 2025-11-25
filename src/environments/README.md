# Configuración de Environments

Este proyecto usa archivos de configuración de entorno para manejar diferentes URLs de API según el ambiente.

## Archivos de Environment

- **`environment.ts`** - Configuración para desarrollo (localhost)
- **`environment.prod.ts`** - Configuración para producción

## Uso en el código

Para usar las variables de entorno en tus servicios o componentes:

```typescript
import { environment } from '@environments/environment';

// Acceder a la URL del API
const apiUrl = environment.apiUrl;

// Verificar si estamos en producción
if (environment.production) {
  // Código específico para producción
}
```

## Ejemplo en un servicio

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MiServicio {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getData() {
    return this.http.get(`${this.apiUrl}/endpoint`);
  }
}
```

## Configuración del servidor

### Desarrollo
Por defecto, el servidor de desarrollo está configurado en:
```
http://localhost:3000/api
```

### Producción
Actualiza `environment.prod.ts` con la URL de tu servidor de producción antes de hacer el build.

## Build para producción

Cuando ejecutes `ng build`, Angular automáticamente usará `environment.prod.ts`.

```bash
ng build --configuration production
```
