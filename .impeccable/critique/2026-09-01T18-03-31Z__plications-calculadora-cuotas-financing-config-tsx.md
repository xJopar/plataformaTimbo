---
target: Financiación de Calculadora de Cuotas
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-09-01T18-03-31Z
slug: plications-calculadora-cuotas-financing-config-tsx
---
Method: dual-agent (A: /root/critique_design · B: /root/critique_evidence)

## Design Health Score

| # | Heurística | Puntaje | Hallazgo clave |
|---|---|---:|---|
| 1 | Visibilidad del estado | 3/4 | Falta confirmar qué configuración alimenta el cuotero. |
| 2 | Relación con el mundo real | 3/4 | El vocabulario comercial es claro. |
| 3 | Control y libertad | 3/4 | No hay reinicio de configuración. |
| 4 | Consistencia y estándares | 3/4 | Unidades actualizan solas y financiación exige aplicar. |
| 5 | Prevención de errores | 3/4 | El mínimo de entrega se valida tarde. |
| 6 | Reconocimiento antes que memoria | 3/4 | La acción está alejada de los últimos controles. |
| 7 | Flexibilidad y eficiencia | 3/4 | Desktop obliga a volver visualmente arriba para aplicar. |
| 8 | Diseño estético y minimalista | 3/4 | La acción compite con el título. |
| 9 | Recuperación ante errores | 3/4 | El estado normal de borrador parece error. |
| 10 | Ayuda y documentación | 2/4 | No explica con precisión qué se actualiza al aplicar. |
| **Total** | | **29/40** | Buena base operativa; el cierre del flujo necesita corrección. |

## Veredicto de especificidad

La pantalla se siente propia de una herramienta operativa de TIMBO: paleta, reglas, datos tabulares y flujo Agregar unidad → Financiación → Cuotero responden al producto. La debilidad está en el ciclo borrador → aplicar → resultado, que no está expresado en la composición.

El detector sobre `financing-config.tsx` devolvió `[]` (0 hallazgos, código 0). No hubo automatización de navegador disponible; la evaluación visual se apoyó en la captura provista y la estructura/CSS del componente.

## Impresión general

La unión de Agregar unidad y Financiación bajo una única superficie blanca es correcta: ambos preparan el mismo cálculo. El resultado sigue separado como respuesta. Sin embargo, la acción principal fue colocada en el único lugar que rompe esa lectura: dentro del título, antes de las decisiones que debe confirmar.

## Lo que funciona

- La columna de Cuotero queda visible y entiende como consecuencia de la configuración.
- La superficie blanca compartida evita una grilla innecesaria de tarjetas.
- La barra fija de móvil ya resuelve bien el alcance del pulgar y evita scroll para ver el resultado.

## Problemas prioritarios

### [P1] Acción desconectada del final de la decisión

**Por qué importa:** después de elegir periodicidad y refuerzos, la persona debe buscar un botón que quedó arriba. Además, junto al título reduce la claridad de ambos.

**Corrección:** mover `Calcular cuota` a un footer contextual de Financiación, inmediatamente después del último control. Debe ocupar el ancho del panel o alinearse a la derecha con una regla superior ligera. El mensaje de borrador queda a su lado o encima, no cerca del título.

### [P1] Títulos y columnas no forman una misma línea de inicio

**Por qué importa:** Agregar unidad inicia más alto que Financiación; se perciben como bloques pegados, no como dos partes de una misma entrada.

**Corrección:** hacer que ambos encabezados comiencen en la misma línea base y aumentar el `gap` interno entre `.cc-layout-main` y `.cc-layout-config` de 24 a 32 px en escritorio ancho. No hace falta una línea divisoria.

### [P2] “Cambios pendientes” parece una alerta

**Por qué importa:** rojo comunica error, aunque editar condiciones es un estado normal.

**Corrección:** usar tinta secundaria o azul operativo y decir “Recalculá para actualizar el cuotero”. Reservar rojo para una validación real.

### [P2] Modelo de actualización ambiguo

**Por qué importa:** las unidades modifican el resultado automáticamente, mientras las condiciones financieras quedan en borrador. Se puede leer o exportar un resultado desactualizado.

**Corrección:** después de aplicar, expresar “Cuotero actualizado”; mientras haya borrador, indicar que el cuotero conserva la configuración anterior.

### [P2] Validación de entrega tardía

**Por qué importa:** se descubre en el Cuotero luego de accionar.

**Corrección:** validar el mínimo junto al campo de entrega y explicar cómo corregirlo.

## Riesgos por persona

- **Empleado primerizo:** puede tomar el botón gris superior como indisponibilidad del módulo y no saber que debe recalcular tras cambiar condiciones.
- **Empleado avanzado:** puede ajustar un refuerzo y compartir/exportar el cuotero anterior porque no distingue el borrador de los resultados aplicados.

## Observaciones menores

- Los controles visuales de radio deberían aceptar flechas para funcionar como un radiogroup estándar.
- El comentario CSS que habla de `fieldset`/`legend` no coincide con los `div.cc-field-group` actuales.

## Preguntas a considerar

- ¿El resultado debería indicar explícitamente la última configuración aplicada?
- ¿Conviene que aplicar y saltar al Cuotero sean una sola acción únicamente en móvil? Sí, porque ese salto evita un scroll adicional; en escritorio no hace falta.
