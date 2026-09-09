---
target: Área de trabajo de Calculadora de Cuotas
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-09-03T17-19-11Z
slug: culadora-cuotas-calculadora-cuotas-application-tsx
---
## Veredicto de especificidad

La calculadora tiene una identidad operativa clara, pero el área de trabajo parece un módulo suspendido: un wizard de 880 px queda centrado dentro de un canvas gris azulado mucho más ancho. No es una tarjeta, pero se percibe como tal por contraste y vacío.

## Lo que funciona

- El flujo, el selector Stock/Manual y el primer paso son claros.
- Header y subheader no forman parte de este hallazgo y se conservan.
- En móvil no hay desborde y los objetivos táctiles alcanzan el mínimo adecuado.

## Problemas prioritarios

### P1 — El canvas no se lee como superficie de trabajo

En 1366 px, el wizard ocupa 880 px y deja aproximadamente 236 px vacíos a cada lado. El gris #EDF2F7 hace que campos blancos y reglas finas parezcan elementos sueltos.

**Dirección recomendada:** una superficie local continua blanca, plana y de borde a borde debajo del subheader; sin tarjetas ni sombras. El gris queda para el shell fuera de la calculadora.

### P1 — El ancho desktop no ayuda a completar la tarea

El contenedor disponible mide aproximadamente 1189 px, pero el flujo usa solo su centro. En desktop debe ser un plano de trabajo de dos zonas: alta/búsqueda a la izquierda y resumen persistente a la derecha. No son dos cards; es una única superficie con una regla divisoria.

### P2 — Estado inicial demasiado vacío

El lienzo no explica qué se está construyendo ni compensa el vacío posterior a la búsqueda. Un título de propósito breve y un resumen que acompaña desde el inicio anclan el trabajo sin agregar ruido.

### P2 — Orden móvil de decisión

En móvil el CTA aparece visualmente antes del total. Conservar el total inmediatamente antes de Continuar para mantener la secuencia de lectura.

## Evidencia técnica

- Detector: limpio (`[]`) sobre los TSX de Calculadora.
- Navegador: inspección real en 1366×900 y 390×844.
- No hubo overlay: la evaluación del navegador es de solo lectura.

## Dirección de rediseño

No reemplazar el gris por crema como único cambio: aliviaría el color, pero dejaría el vacío. Primero se corrige la composición; después el fondo blanco continuo termina de unirla. El crema suave es una alternativa de identidad posterior, no la solución estructural.
