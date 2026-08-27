# Flujo vigente de GitHub y Railway

Esta guía describe el recorrido operativo del monorepo ya publicado como dos servicios Railway:

| Servicio | Paquete      | Healthcheck   | Variable propia                            |
| -------- | ------------ | ------------- | ------------------------------------------ |
| `api`    | `@timbo/api` | `/api/health` | `CORS_ORIGIN`                              |
| `web`    | `@timbo/web` | `/`           | `VITE_API_BASE_URL`, `API_INTERNAL_ORIGIN` |

El servicio `web` no sirve sólo estáticos: `apps/web/server` es un gateway HTTP mínimo que sirve
la SPA y reenvía todo lo que empieza con `/api` al servicio `api`, para que el navegador use
siempre el origen público de `web` y la cookie de sesión funcione como primera parte (Railway
publica `api` y `web` como sitios `*.up.railway.app` distintos, y las cookies de terceros no
pueden asumirse habilitadas). El gateway no conoce autenticación ni credenciales Google: sólo
reenvía método, cuerpo, encabezados y respuesta (incluido `Set-Cookie`) entre el navegador y la
API.

La API usa PostgreSQL mediante Prisma. Cada entorno Railway referencia solamente el
`DATABASE_URL` privado de su PostgreSQL del mismo entorno. La migración se aplica antes de
arrancar la API mediante el `preDeployCommand` versionado en `apps/api/railway.json`.

El build de la API genera el cliente Prisma antes de compilar y la CLI `prisma` es una dependencia
disponible en la imagen. El pre-deploy ejecuta exclusivamente `prisma migrate deploy`: no genera
migraciones ni ejecuta `migrate dev`, `db push` o `migrate reset`.

## Configuración inicial histórica (no repetir)

El repositorio GitHub, su remoto, el proyecto Railway, los servicios `api` y `web`, y sus dominios
públicos ya existen. La creación del remoto, el cambio de nombre de ramas y el primer enlace de
servicios fueron pasos históricos, no instrucciones del trabajo cotidiano. Esta guía no autoriza
crear o reemplazar remotos, renombrar ramas, hacer push, merge ni cambiar Railway.

La configuración que debe conservarse es:

- **Root Directory**: `/` en ambos servicios, porque es un workspace compartido.
- **Config File Path**: `/apps/api/railway.json` para `api` y `/apps/web/railway.json` para `web`.
- **Dominios públicos**: se mantienen para cada servicio; son necesarios para CORS y para la URL
  pública compilada por la web, y no son secretos.

## Flujo vigente por incremento

1. El trabajo y el primer push de cada incremento se realizan en la rama `desarrollo`.
2. Railway **development** está conectado a `desarrollo`. Después de revisión y con autorización
   explícita, un push a esa rama permite verificar el despliegue de development.
3. Se comprueban health, Swagger, OpenAPI y la comunicación web/API en development. Si hay una
   migración versionada, el pre-deploy debe terminar correctamente antes de iniciar la API.
4. Sólo tras esa verificación y una nueva autorización explícita se promueve o integra
   `desarrollo` en `main`.
5. Railway **production** está conectado exclusivamente a `main`. La promoción autorizada es el
   único recorrido que habilita su despliegue productivo.

No interpretar estos pasos como autorización automática para commit, push, merge, deploy o
cambios en Railway. Cada uno requiere la autorización correspondiente del responsable del
entorno.

## Configuración vigente de variables

Railway inyecta `PORT`; no se crea manualmente. Usar variables de referencia para que cada
servicio siga el dominio Railway del otro dentro del mismo entorno.

En el servicio `api` de **development**, debe mantenerse:

```dotenv
CORS_ORIGIN=https://${{web.RAILWAY_PUBLIC_DOMAIN}}
DATABASE_URL=${{dev-base-datos.DATABASE_URL}}
```

La referencia anterior es la configuración confirmada para `development`; es una referencia
privada, no una URL que deba copiarse fuera de Railway.

La autenticación Google se configura sólo en el servicio `api` de **development**. Mantener
`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` y `GOOGLE_OAUTH_REDIRECT_URI` como
variables de backend; el secreto no se copia a `web`, al repositorio ni a los logs. El callback
debe coincidir exactamente con el registrado en Google Cloud. Esta tanda no autoriza configurar
estas variables, ni modificar las existentes, en production.

La cookie de sesión se emitirá posteriormente desde la API, sin atributo `Domain`: en localhost
usa HTTP con `SameSite=Lax`; con el callback HTTPS de Railway usa `Secure` y `SameSite=None`.
Su vencimiento absoluto es de ocho horas.

En el servicio `api` de **production**, conservar la separación y configurar la referencia al
servicio PostgreSQL homónimo del entorno productivo:

```dotenv
DATABASE_URL=${{dev-base-datos.DATABASE_URL}}
```

Railway resuelve la referencia dentro del entorno activo: aunque el servicio se llame
`dev-base-datos` en ambos entornos, production usa su propia instancia y no la base de
development. No sustituir la referencia por una URL pública. `CORS_ORIGIN` debe seguir apuntando
al dominio `web` del mismo entorno.

En el servicio `web` de cada entorno, el gateway de mismo origen (`apps/web/server`) requiere:

```dotenv
VITE_API_BASE_URL=https://${{web.RAILWAY_PUBLIC_DOMAIN}}
API_INTERNAL_ORIGIN=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}
```

`VITE_API_BASE_URL` apunta al propio origen público de `web`: el navegador llama a `/api`
en ese mismo origen y el gateway lo reenvía a `api`. `API_INTERNAL_ORIGIN` es una variable
server-only nueva del servicio `web` (sin prefijo `VITE_`, nunca se incorpora al bundle) que usa
el dominio privado de Railway (`RAILWAY_PRIVATE_DOMAIN`) y el puerto que Railway le asignó al
servicio `api` (`api.PORT`) para reenviar `/api/*` dentro de la red privada del proyecto, sin
pasar por el dominio público de `api`. Si aún apunta al dominio público de `api`, el navegador
recibe una cookie de terceros que algunos navegadores bloquean. `VITE_API_BASE_URL` se incorpora
durante el build de Vite, por lo que un cambio de esa variable requiere un nuevo despliegue de
`web`. Ninguna de las dos es secreta; la referencia `DATABASE_URL` sí lo es.

El callback de Google debe coincidir con el origen publicado que recibe `/api/auth/google/callback`.
Si se sirve por el gateway Web, registrar primero ese callback en Google Cloud y actualizar
`GOOGLE_OAUTH_REDIRECT_URI` en el servicio `api` a
`https://${{web.RAILWAY_PUBLIC_DOMAIN}}/api/auth/google/callback`. Confirmar este cambio en el
dashboard y con un login real; el repositorio no puede confirmar las variables activas de Railway.

## Verificación autorizada de development

Con el incremento ya enviado a `desarrollo` y autorización para verificar development, comprobar:

1. `https://<dominio-api>/api/health` responde `200` y `status: "ok"`.
2. `https://<dominio-api>/api/docs` abre Swagger UI.
3. `https://<dominio-api>/api/docs-json` devuelve el documento OpenAPI.
4. `https://<dominio-web>/` muestra primero “Verificando conexión” y luego “API disponible”.
5. En la respuesta de health, `Access-Control-Allow-Origin` coincide exactamente con el origen
   público de `web`.
6. Una ruta de navegación como `/admin` devuelve `index.html` con `Cache-Control: no-cache`; un
   asset inexistente bajo `/assets/` devuelve `404` y nunca el HTML de la SPA.

Si la web muestra “API no disponible”, revisar primero el valor efectivo de
`VITE_API_BASE_URL`, volver a desplegar `web` sólo con autorización y después comprobar
`CORS_ORIGIN` en `api`.

El pre-deploy ejecuta `corepack pnpm --filter @timbo/api prisma:migrate:deploy` desde la raíz
real del monorepo; si una migración falla, Railway no inicia la API. En development puede
comprobarse de manera controlada que no haya migraciones pendientes. Producción no se usa para
crear, generar, validar por escritura ni resetear migraciones.

## Promoción autorizada a production

Después de verificar development, solicitar autorización explícita antes de promover o integrar
`desarrollo` en `main`. Railway production toma exclusivamente `main`; no se ejecutan
migraciones manuales ni cambios directos en su base. Antes de esa promoción, confirmar el nombre
del servicio PostgreSQL productivo y sustituir sólo el placeholder correspondiente dentro del
dashboard autorizado.

## Qué no crear todavía

- volúmenes;
- Redis, workers o cron services;
- Dockerfiles o Caddy;
- secretos de autenticación.

Fuentes: [monorepos](https://docs.railway.com/deployments/monorepo),
[configuración como código](https://docs.railway.com/config-as-code/reference),
[variables y referencias](https://docs.railway.com/variables) y
[despliegue de React/Vite](https://docs.railway.com/guides/react).
