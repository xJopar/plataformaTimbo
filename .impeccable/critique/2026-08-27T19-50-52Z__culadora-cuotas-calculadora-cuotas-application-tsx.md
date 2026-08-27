---
target: Calculadora de Cuotas
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
timestamp: 2026-08-27T19-50-52Z
slug: culadora-cuotas-calculadora-cuotas-application-tsx
---
# Crítica de diseño — Calculadora de Cuotas

Method: dual-agent (A: design-review sub-agent · B: detector + visual-evidence sub-agent)

## Design Health Score

| # | Heurística | Puntaje | Hallazgo clave |
|---|-----------|-------|-----------------|
| 1 | Visibilidad del estado del sistema | 3/4 | Cuotero muestra resultado por defecto sin acción del usuario; "Calcular cuota" arranca deshabilitado sin explicar por qué |
| 2 | Correspondencia con el mundo real | 3/4 | Terminología comercial correcta; copy del cuotero suena a nota de desarrollo |
| 3 | Control y libertad del usuario | 2/4 | Quitar exige modal siempre; no hay edición inline de precio manual |
| 4 | Consistencia y estándares | 3/4 | Fiel a DESIGN.md; pero ítems instantáneos vs. config en "borrador" sin señal que distinga |
| 5 | Prevención de errores | 3/4 | Buena validación manual; entrega manual se recorta silenciosamente sin avisar |
| 6 | Reconocer antes que recordar | 2/4 | Sólo búsqueda por texto, sin navegación por marca/modelo como Lista de Precios |
| 7 | Flexibilidad y eficiencia | 2/4 | Buen patrón borrador/aplicar; sin edición inline ni comparación de escenarios |
| 8 | Diseño estético y minimalista | 3/4 | Panel de condiciones visible e interactivo antes de que haya algo que calcular |
| 9 | Ayuda a reconocer y recuperar errores | 2/4 | Error de carga del catálogo sin reintentar (regresión vs. Lista de Precios) |
| 10 | Ayuda y documentación | 2/4 | Sin microcopy en el punto de mayor fricción (botón deshabilitado) |
| **Total** | | **25/40** | **Aceptable** |

## Design Specificity Verdict

Específico por integración de dominio (cuotero, refuerzos semestrales/anuales, formato es-PY, búsqueda sobre catálogo real, deep-link desde Lista de Precios), genérico en el mecanismo de interacción (widget de plazo/%/periodicidad intercambiable con cualquier categoría).

Scan determinístico: `detect.mjs` — 0 hallazgos sobre calculadora-cuotas (detector verificado funcional contra otra app del monorepo).

Verificación de contraste contra CSS real (corrige dos falsos positivos de la evidencia visual):
- Botón "Quitar" (error-ink #8C2F16 sobre error-surface #FFF7F4, ambos documentados en DESIGN.md): 7.84:1 — cumple AA. Falso positivo.
- Texto de ayuda del buscador (text-secondary #475569 sobre #EDF2F7): 6.73:1 — cumple AA. Falso positivo.
- Botón "Calcular cuota" deshabilitado (text-disabled #64748B sobre border #BCC9D7): 2.82:1 — confirmado por debajo de AA, coincide con el hallazgo independiente de Assessment A sobre el mismo botón.

## Priority Issues

**[P1] "Calcular cuota" no explica su estado y esconde una asimetría real (ítems instantáneos vs. config en borrador); su estado deshabilitado además tiene contraste real de 2.82:1.**
Fix: microcopy junto al total explicando qué se aplica solo y qué necesita Calcular; subir contraste del estado deshabilitado.

**[P2] Quitar exige modal siempre; no hay edición inline de precio manual.**
Fix: reemplazar el modal por deshacer tipo toast en la remoción rutinaria; agregar edición inline del monto manual.

**[P2] Sin exportar/compartir el cuotero, sin desglose por unidad al combinar varias.**
Fix: acción mínima de copiar/compartir resumen; desglose por unidad a más largo plazo.

**[P2] Inconsistencias visuales confirmadas en mobile: tabs con altura despareja al wrapear, fila "Precio final" apretada por doble wrap.**
Fix: ajustar copy/layout de los tabs; apilar label/valor de esa fila en mobile.

**[P3] Copy del cuotero con tono de nota de desarrollo; panel de condiciones visible antes de tener algo que calcular (costoso en mobile vacío).**
Fix: reescribir tono del copy provisional; atenuar/mover el bloque de condiciones en mobile hasta que haya al menos un ítem.

## Persona Red Flags

**Vendedor de piso (mobile, en vivo con cliente):** no puede editar un precio manual sin borrar todo y re-tipear; el copy "sólo para probar el flujo" puede leerlo el cliente en el peor momento.

**Administrativo armando cotización:** sin export/compartir ni desglose por unidad al combinar varias.

**Gerente comparando escenarios:** cambiar plazo pisa el resultado anterior sin dejar rastro para comparar.

## Minor Observations

- Código de chasis con el mismo peso tipográfico que el nombre del modelo en la fila de ítem agregado.
- Monto de la barra inferior de mobile sin etiqueta (no aclara si es precio final, cuota o total financiado).
- Buscador sin sugerencias iniciales ni indicación de resultados truncados (tope de 8).
- Contenedor de esta app limita a 1040px vs. 1280px del resto de la plataforma (home/administración) — más aire muerto en monitores anchos.
- Deep-link `from-stock` sin camino de regreso visible a Lista de Precios salvo el selector de Aplicaciones o el botón atrás del navegador.

## Questions to Consider

1. Si el cuotero ya muestra un resultado con los defaults sin acción del usuario, ¿qué comunica realmente que "Calcular cuota" esté deshabilitado?
2. ¿El flujo real siempre termina con alguien leyendo los números en voz alta, o falta una salida (exportar/compartir) que hoy no está contemplada?
