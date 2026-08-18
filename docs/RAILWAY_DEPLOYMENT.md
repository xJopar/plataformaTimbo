# Despliegue inicial en GitHub y Railway

Esta guía publica el mismo monorepo como dos servicios Railway:

| Servicio | Paquete      | Healthcheck   | Variable propia     |
| -------- | ------------ | ------------- | ------------------- |
| `api`    | `@timbo/api` | `/api/health` | `CORS_ORIGIN`       |
| `web`    | `@timbo/web` | `/`           | `VITE_API_BASE_URL` |

No crear una base de datos para este incremento. El código actual no usa persistencia ni
`DATABASE_URL`. Cuando se implementen usuarios, aplicaciones, perfiles y asignaciones se
creará PostgreSQL junto con Prisma y las migraciones; crearla ahora sólo dejaría
infraestructura sin consumidor.

## 1. Publicar el repositorio en GitHub

Crear un repositorio privado vacío en GitHub, sin README, `.gitignore` ni licencia generados
por GitHub. Desde la raíz local ejecutar, reemplazando la URL:

```powershell
git branch -M main
git remote add origin https://github.com/<organizacion-o-usuario>/<repositorio>.git
git push -u origin main
```

Si `origin` ya existe, comprobarlo con `git remote -v` y actualizarlo únicamente si apunta al
destino incorrecto:

```powershell
git remote set-url origin https://github.com/<organizacion-o-usuario>/<repositorio>.git
```

No subir `.env`; Git lo ignora. `.env.example` sí se versiona porque sólo contiene valores de
desarrollo y documentación.

## 2. Crear el proyecto Railway

1. Crear un proyecto vacío en Railway.
2. Crear dos servicios vacíos y nombrarlos exactamente `api` y `web`.
3. Conectar ambos servicios al mismo repositorio GitHub y a la rama `main`.
4. Mantener **Root Directory** en `/` para ambos. Es un workspace compartido: la web necesita
   `packages/contracts` y ambos paquetes necesitan los archivos pnpm de la raíz.
5. Configurar **Config File Path**:
   - servicio `api`: `/apps/api/railway.json`;
   - servicio `web`: `/apps/web/railway.json`.
6. En **Networking**, generar un dominio público Railway para cada servicio.

Los archivos `railway.json` contienen build, start, watch paths, healthcheck y política de
reinicio. No repetir esos comandos manualmente en el dashboard salvo para diagnosticar una
configuración.

## 3. Configurar variables

Railway inyecta `PORT`; no crearla manualmente. Usar variables de referencia para que cada
servicio siga el dominio Railway del otro.

En el servicio `api`, crear:

```dotenv
CORS_ORIGIN=https://${{web.RAILWAY_PUBLIC_DOMAIN}}
```

En el servicio `web`, crear:

```dotenv
VITE_API_BASE_URL=https://${{api.RAILWAY_PUBLIC_DOMAIN}}
```

`VITE_API_BASE_URL` se incorpora durante el build de Vite, por lo que un cambio de esa variable
requiere un nuevo despliegue de `web`. Ninguna de estas dos variables es secreta.

## 4. Desplegar y verificar

Aplicar los cambios pendientes de Railway y desplegar primero `api` y después `web`.

Comprobar:

1. `https://<dominio-api>/api/health` responde `200` y `status: "ok"`.
2. `https://<dominio-api>/api/docs` abre Swagger UI.
3. `https://<dominio-web>/` muestra primero “Verificando conexión” y luego “API disponible”.
4. En la respuesta de health, `Access-Control-Allow-Origin` coincide exactamente con el origen
   público de `web`.

Si la web muestra “API no disponible”, revisar primero el valor efectivo de
`VITE_API_BASE_URL`, volver a desplegar `web` y después comprobar `CORS_ORIGIN` en `api`.

## 5. Qué no crear todavía

- PostgreSQL o `DATABASE_URL`;
- volúmenes;
- Redis, workers o cron services;
- Dockerfiles o Caddy;
- secretos de autenticación.

Fuentes: [monorepos](https://docs.railway.com/deployments/monorepo),
[configuración como código](https://docs.railway.com/config-as-code/reference),
[variables y referencias](https://docs.railway.com/variables) y
[despliegue de React/Vite](https://docs.railway.com/guides/react).
