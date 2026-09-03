---
target: Área de trabajo de Calculadora de Cuotas
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-09-03T17-05-24Z
slug: culadora-cuotas-calculadora-cuotas-application-tsx
---
## Veredicto

La pantalla principal de Calculadora de Cuotas es funcional y específica para cotizar vehículos,
pero su composición de escritorio está subresuelta. La tarea vive como un bloque de 880 px centrado
en un lienzo gris amplio: no existe un plano de trabajo que use el ancho ni la altura disponibles.
Header y subheader quedan fuera de este análisis.

## Salud del diseño

| Heurística | Puntaje | Hallazgo en el área de trabajo |
| --- | ---: | --- |
| Visibilidad de estado | 3/4 | El progreso y la CTA son claros. |
| Correspondencia | 3/4 | El flujo es claro, pero no se comporta como mesa de cotización. |
| Control | 3/4 | Se puede editar, pero el espacio no reduce trabajo repetitivo. |
| Consistencia | 4/4 | Reglas y controles respetan el sistema. |
| Prevención | 4/4 | El avance bloqueado evita cálculo inválido. |
| Reconocimiento | 3/4 | Los pasos están visibles; el estado de cotización no es persistente. |
| Eficiencia | 2/4 | Desktop no gana nada del ancho disponible. |
| Estética | 2/4 | El vacío parece abandono, no respiración intencional. |
| Recuperación | 3/4 | Los estados hijos son recuperables. |
| Ayuda | 2/4 | El estado inicial no se contextualiza espacialmente. |

**Total: 29/40.**

## Problemas prioritarios

1. **P1 — Falta un plano de trabajo.** `.cc-page` sólo restringe ancho, centra y agrega padding;
   no declara superficie, borde o altura útil. Debe convertirse en un plano blanco continuo que
   alcance el final útil del viewport, sin envolver el wizard en una card.
2. **P1 — El viewport amplio no tiene función.** `.cc-wizard` queda en 880 px centrados tanto a
   1366 como a 1920 px. En escritorio debe haber una retícula de flujo principal y resumen
   persistente, separados por una regla, no por cards.
3. **P2 — El vacío vertical no está compuesto.** El primer paso finaliza abruptamente sobre el
   lienzo del shell. La superficie debe tener altura mínima disponible y el estado inicial debe
   explicar o sostener el comienzo de la cotización.
4. **P2 — Existen reglas desktop no conectadas al DOM.** `.cc-layout`, sus columnas sticky y
   `.cc-mobile-summary` no se renderizan en esta pantalla; la solución debe decidir si se
   reutilizan o se eliminan antes de adoptar una retícula nueva.

## Evidencia

El detector de layout devolvió `[]`. No detecta el problema de composición porque el fondo viene de
`.platform-shell` y el vacío nace de la combinación de `.cc-page` centrada y `.cc-wizard` limitado.
No hubo navegador disponible; la crítica visual se apoya en la captura proporcionada y en las
dimensiones del CSS. Header y subheader se excluyeron explícitamente.

## Preguntas

1. ¿El carril derecho debe ser un resumen persistente de la cotización, o una guía contextual que
   desaparezca cuando el resultado toma protagonismo?
2. ¿La pantalla debe priorizar notebook de 1366 px, monitor amplio, o ambos?
3. En vacío, ¿la persona inicia una cotización nueva o suele retomar una en curso?
