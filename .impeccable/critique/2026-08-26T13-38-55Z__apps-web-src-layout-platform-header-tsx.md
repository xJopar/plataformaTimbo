---
target: header de inicio de Plataforma Timbo
total_score: 24
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 2
timestamp: 2026-08-26T13-38-55Z
slug: apps-web-src-layout-platform-header-tsx
---

## Salud de diseño

| Heurística                 | Puntaje | Hallazgo principal                                                               |
| -------------------------- | ------: | -------------------------------------------------------------------------------- |
| Visibilidad del estado     |     3/4 | El cierre evita doble activación, pero su falla se recupera lejos del control.   |
| Relación con el mundo real |     3/4 | El lenguaje de sesión es claro; «Apps» rompe la convención en español.           |
| Control y libertad         |     2/4 | El cierre es inmediato y sin contexto local de recuperación.                     |
| Consistencia               |     3/4 | Base visual coherente, con jerarquía ambigua entre administración y salida.      |
| Prevención de errores      |     2/4 | El botón se deshabilita, pero salir sigue siendo una acción disruptiva expuesta. |
| Reconocimiento             |     3/4 | Las acciones se entienden, pero Administración no expresa su alcance.            |
| Eficiencia                 |     2/4 | La cabecera móvil se apila y desplaza el contenido principal.                    |
| Estética y minimalismo     |     3/4 | Sobria y legible, aunque la salida tiene demasiado peso.                         |
| Recuperación de errores    |     2/4 | El error de logout aparece en el tablero, no junto a la acción.                  |
| Ayuda                      |     1/4 | Administración no cuenta con contexto de rol.                                    |

**Total: 24/40.** Header funcional y legible, pero aún genérico y demasiado alto en móvil.

## Especificidad

El azul operativo, el wordmark y la franja de sesión anclan la experiencia a Timbo. La estructura «marca, acciones y sesión» sigue siendo intercambiable con una intranet corporativa. La oportunidad principal es ordenar navegación y sesión sin reducir accesibilidad.

## Evidencia técnica

El detector no produjo hallazgos. La semántica actual es correcta: header, navegación rotulada, enlace, botón, foco visible y objetivos de 44 px. En Chrome, el layout no generó overflow a 375 ni 320 px, pero a costa de apilar el header y retrasar las aplicaciones.

## Prioridades

1. **P1 — Jerarquía.** Salir tiene más peso visual que Administración. Convertir ambas en controles utilitarios compactos con icono, nombre accesible y tooltip.
2. **P1 — Móvil.** Unificar el breakpoint y preservar una fila compacta de marca/acciones para priorizar las aplicaciones.
3. **P2 — Recuperación.** Acercar un eventual error de cierre al control que lo dispara.
4. **P2 — Contexto de administración.** Nombrar la capacidad como Administración de plataforma, aun cuando se represente con icono.

## Personas

- **Primer uso:** necesita entender que Administración es una herramienta de gobierno de plataforma.
- **Empleado móvil:** debe llegar a sus aplicaciones sin una cabecera apilada innecesariamente alta.
- **Teclado o lector de pantalla:** al usar iconos necesita nombres accesibles, foco visible y una señal no dependiente de hover.

## Observaciones

- Hay reglas para `.top-bar-brand span` que el header de inicio no utiliza.
- La altura calculada del tablero presupone el header de escritorio.
- La convención de idioma debería decidir si «Apps» permanece o pasa a «Aplicaciones».
