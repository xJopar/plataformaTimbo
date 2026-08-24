# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Empleados de Timbo que acceden a aplicaciones internas desde una experiencia compartida.
- Administradores de la plataforma que gobiernan usuarios, aplicaciones y acceso.

## Product Purpose

Plataforma Timbo reúne aplicaciones empresariales bajo una identidad, seguridad y experiencia comunes. Administración gobierna el acceso y mantiene el catálogo de aplicaciones disponibles.

## Positioning

Es un App Shell empresarial interno: centraliza capacidades transversales y permite integrar aplicaciones de negocio de forma gradual, sin convertirlas en productos aislados.

## Operating Context

- Uso interno desde navegador web.
- Las aplicaciones se abren mediante rutas internas de la plataforma.
- La evolución se realiza por incrementos pequeños y verificables.

## Capabilities and Constraints

- La autenticación, la sesión, la seguridad y la experiencia pertenecen a la plataforma compartida.
- Administración mantiene el catálogo de aplicaciones y su estado operativo.
- Las rutas de lanzamiento de las aplicaciones son internas.
- La asignación de aplicaciones a empleados y la administración de perfiles y permisos ya están
  disponibles; el launcher autorizado es el incremento posterior.
- Los iconos de aplicaciones quedan fuera del incremento inicial.
- Lista de Precios será la primera aplicación de negocio migrada; primero se incorpora una aplicación mínima de demostración.

## Evidence on Hand

- `README.md` y la documentación versionada en `docs/` describen la arquitectura y las decisiones vigentes.
- `apps/web` contiene el App Shell y la experiencia de Administración existente.
- `apps/api` contiene autenticación, administración y observabilidad.

## Product Principles

- Gobernanza central antes de ampliar el catálogo de aplicaciones.
- Integración progresiva mediante incrementos pequeños.
- Una sola identidad y experiencia coherente entre aplicaciones.
- Las decisiones no implementadas permanecen explícitamente fuera de alcance.
