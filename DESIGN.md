---
name: 'Plataforma Timbo'
description: 'Sistema visual operativo para el acceso y las herramientas internas de Timbo.'
colors:
  brand-blue: '#1F245C'
  operational-blue: '#00388A'
  focus-turquoise: '#00A6A6'
  page-background: '#EDF2F7'
  surface: '#F7F9FB'
  white: '#FFFFFF'
  ink: '#142033'
  muted-ink: '#475569'
  border: '#BCC9D7'
  access-muted: '#526176'
  error-ink: '#8C2F16'
  error-surface: '#FFF7F4'
typography:
  display:
    fontFamily: 'Aptos, Segoe UI, sans-serif'
    fontSize: 'clamp(2.5rem, 5vw, 4.75rem)'
    fontWeight: 750
    lineHeight: 0.98
    letterSpacing: '-0.055em'
  body:
    fontFamily: 'Aptos, Segoe UI, sans-serif'
    fontSize: '1rem'
    lineHeight: 1.6
  label:
    fontFamily: 'Aptos, Segoe UI, sans-serif'
    fontWeight: 700
rounded:
  square: '0'
spacing:
  xs: '8px'
  sm: '16px'
  md: '24px'
  lg: '32px'
  xl: 'clamp(32px, 6vw, 72px)'
components:
  button-primary:
    backgroundColor: '{colors.operational-blue}'
    textColor: '{colors.white}'
    rounded: '{rounded.square}'
    height: '44px'
  access-primary-action:
    backgroundColor: '{colors.brand-blue}'
    textColor: '{colors.white}'
    rounded: '{rounded.square}'
    height: '54px'
---

# Design System: Plataforma Timbo

## Overview

**Dirección: "Operación corporativa clara".** La plataforma prioriza lectura, control y continuidad entre herramientas internas. Es sobria, plana y de alta legibilidad: la marca se expresa con azul preciso, tipografía compacta y reglas, no con decoración.

Este documento registra lo implementado; no declara un rediseño total. Las reglas globales pertenecen al App Shell operativo. El acceso es una superficie específica con una composición y activos propios.

Rutas propietarias: `apps/web/src/app.css` (sistema compartido), `apps/web/src/auth/access-shell.tsx` y `apps/web/src/auth/access-shell.css` (acceso), `apps/web/assets/brand/README.md` (procedencia y derivados de marca), y `apps/web/public/marca/` (wordmark y fotografía).

## Colors

- **Azul de marca** `#1F245C`: identidad del acceso, acción principal y fondo/velo de la fotografía. Es el color dominante del wordmark proporcionado.
- **Azul operativo** `#00388A`: navegación, acciones y acentos del App Shell existente. No sustituye el azul de marca del acceso.
- **Turquesa de foco** `#00A6A6`: anillo de foco visible de 3 px y subrayado de navegación activa; nunca se usa para ocultar el estado de foco.
- **Neutros**: `#FFFFFF` para el panel de acceso y campos; `#EDF2F7` para fondo de plataforma; `#F7F9FB` para superficies operativas; `#142033` para tinta; `#475569`/`#526176` para texto secundario; `#BCC9D7` para divisores. El contraste se resuelve con tinta, fondo y bordes, no con sombras.
- **Error**: `#FFF7F4` con borde `#E8B5A4` y texto `#8C2F16`; los errores permanecen explícitos junto a la acción recuperable.

## Typography

Usar únicamente la pila de sistema `Aptos, "Segoe UI", sans-serif`; no cargar fuentes externas. Los encabezados usan peso alto, tracking negativo y pocas líneas; el cuerpo conserva interlineado generoso (`1.5`–`1.65`) y medidas de lectura acotadas.

El acceso reserva el display de `clamp(2.5rem, 5vw, 4.75rem)` para el título de estado. En las superficies operativas, títulos, etiquetas y enlaces favorecen una jerarquía funcional, con etiquetas de peso 700–800 y mayúsculas solo para metadatos breves.

## Layout

Globalmente, el App Shell usa contenedores amplios, espaciado de 8/16/24/32 px, fondos claros y grupos separados por reglas. En móvil, navegación, formularios, filtros y filas se apilan antes de reducir el área táctil; controles y campos mantienen al menos 44 px de alto.

El acceso es una composición de dos columnas en escritorio: panel funcional blanco a la izquierda (47 %) y fotografía real de sede a la derecha (53 %). El wordmark blanco (recorte con canal alfa real, sin fondo sólido) vive directamente sobre el lado fotográfico; la marca corta es el monograma `T` junto a “Plataforma Timbo” en el panel funcional. El wordmark se muestra unos segundos al cargar y luego se desvanece, dejando la fotografía de la sede visible bajo el velo azul translúcido — ver Motion. La imagen se sirve en WebP con `srcset` de 640/960/1600 px y `sizes` acorde al viewport, sin ampliar la fuente.

A `860px` o menos, la foto pasa a una banda superior de 200–260 px y el panel queda debajo. La diagonal es exclusivamente decorativa: en escritorio separa los paneles y en móvil se reduce a esa banda superior; no cubre, recorta ni compite con controles, texto o sus anillos de foco.

## Elevation & Depth

La plataforma es plana por defecto. La separación procede de cambios de superficie, bordes de 1 px y acentos superiores de 2–3 px; no hay sombras como sistema de jerarquía. El acceso añade profundidad solo con la fotografía real y su velo azul translúcido.

## Shapes

Los controles y superficies operativas son rectangulares, sin radios por defecto. Campos, botones, tablas y paneles emplean bordes nítidos. La única forma redonda relevante es el contenedor del indicador de Google; no debe convertirse en una convención de tarjetas o botones redondeados.

## Components

### Acciones y campos globales

Acciones principales azul operativo, texto blanco y altura mínima de 44 px; acciones secundarias son transparentes y delineadas. Campos blancos con borde `#94A3B8`, caret azul operativo y foco turquesa visible de 3 px con offset. Los enlaces y la navegación activa preservan peso alto y contraste.

### Superficies operativas

Usar paneles planos y filas de lista/tablas para agrupar trabajo: fondo `#F7F9FB` o blanco, reglas `#BCC9D7` y acento superior cuando identifica una sección. No convertir agrupaciones rutinarias en una grilla de cards genéricas.

### Acceso corporativo

La jerarquía se mantiene estable en todos los estados: marca, título, detalle, señal de estado o error y acción recuperable. `checking` muestra el indicador y “Validando sesión segura”; `signed-out` ofrece Google; `rejected` conserva la misma acción y presenta alerta; `technical-failure` presenta alerta y “Reintentar”. La acción primaria mide 54 px, usa `#1F245C`, cambia discretamente a `#313B85` en hover y conserva foco turquesa.

Hay dos animaciones autorizadas en el acceso: el giro del indicador de comprobación (800 ms) y la revelación del wordmark sobre la foto (aparece, se sostiene y se desvanece en 4.5 s, una sola vez al cargar). La Calculadora de Cuotas usa además una transición breve de recorte (`clip-path`) al alternar por puntero entre Stock y Manual: comunica el cambio de formulario sin desplazar el layout. Con `prefers-reduced-motion: reduce`, el giro se reemplaza por un indicador estático de marca, el wordmark queda fijo en pantalla y la calculadora cambia de modo de forma instantánea; el resto del App Shell también desactiva transiciones y animaciones.

## Do's and Don'ts

### Do:

- **Do** mantener el azul de marca `#1F245C` para el acceso y el azul operativo `#00388A` para el App Shell, según su superficie propietaria.
- **Do** ofrecer foco turquesa visible, contraste suficiente y acciones recuperables para estados de autenticación y fallas.
- **Do** usar fotografía real de sede, wordmark y monograma solo en la composición de acceso donde están implementados.
- **Do** priorizar srcset, WebP, tamaños intrínsecos y movimiento reducido.

### Don't:

- **Don't** aplicar la composición fotográfica de acceso, ni su diagonal, a toda la plataforma.
- **Don't** colocar controles o contenido interactivo sobre la foto ni detrás de la diagonal.
- **Don't** introducir gradientes, sombras decorativas, cards genéricas o animación pesada.
- **Don't** cargar tipografías externas, reducir el foco visible ni depender solo del color para comunicar errores o estado.
