---
target: Pantalla principal de Calculadora de Cuotas
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-09-03T13-28-48Z
slug: culadora-cuotas-calculadora-cuotas-application-tsx
---
## Salud del diseño

| Heurística | Puntaje | Hallazgo principal |
| --- | ---: | --- |
| Visibilidad de estado | 3/4 | El wizard comunica el paso actual. |
| Correspondencia con el negocio | 3/4 | Stock y Manual requieren una distinción visible. |
| Control y libertad | 3/4 | Se puede volver, editar y quitar unidades. |
| Consistencia | 3/4 | El shell aún separaba sesión y tarea. |
| Prevención de errores | 3/4 | Hay validación, duplicados y confirmación. |
| Reconocimiento | 2/4 | El modo inactivo podía quedar oculto. |
| Eficiencia | 2/4 | El selector no seguía el patrón de teclado. |
| Estética y minimalismo | 2/4 | La altura mínima dejaba una zona vacía. |
| Recuperación | 3/4 | Los errores manuales son accionables. |
| Ayuda | 2/4 | Manual carecía de contexto visual. |

**Total: 26/40.** La tarea de cotizar tiene una secuencia clara, pero la composición inicial se
sentía como tres franjas independientes y el cambio Stock/Manual sacrificaba reconocimiento por
una animación.

## Especificidad

La calculadora está anclada a unidades, stock y financiación, pero su shell anterior era
intercambiable con cualquier aplicación interna. La oportunidad prioritaria es un marco operativo
único que agrupe sesión y tarea, reutilizable por otras aplicaciones sin convertir cada bloque en
una card.

## Problemas priorizados

1. **P1 — Ambos orígenes deben seguir visibles.** En navegadores con `clip-path`, los botones
   ocultaban su texto y el indicador inactivo se recortaba por completo. Se reemplaza por una única
   capa azul recortada, mientras los dos textos reales permanecen visibles.
2. **P1 — La superficie de trabajo debe ser continua.** Sesión y contenido vivían sobre fondos y
   marcos distintos. Se introduce `platform-application-workspace` para contener contexto, alertas
   y tarea dentro de una superficie blanca plana.
3. **P1 — No reservar altura ficticia.** `min-block-size: 12.75rem` creaba aire muerto con una
   búsqueda vacía. Se elimina; los resultados extensos conservan scroll interno y el documento
   reserva el gutter del scrollbar.
4. **P2 — La sesión necesita jerarquía.** Nombre y fecha larga tenían el mismo peso. La barra pasa
   a comunicar estado, identidad y actualización en dos niveles, con adaptación para ancho chico.
5. **P2 — El selector debe ser operable por teclado.** Se adopta el patrón de pestañas con flechas,
   Inicio y Fin; alta y eliminación alcanzan 44 px.

## Evidencia técnica

Dos evaluaciones independientes revisaron fuente y detector. El detector de layout devolvió `[]`;
no detecta jerarquía, texto oculto ni espacio vacío. No hubo navegador disponible (`browsers: []`),
por lo que no se generó overlay ni se inició servidor para la crítica.

## Personas

- **Usuario experto:** necesita alternar y avanzar sin perder foco; el selector pasa a admitir
  teclado estándar.
- **Primera vez:** debe descubrir Stock y Manual sin adivinar una alternativa oculta.
- **Usuario de movilidad o accesibilidad:** recibe blancos táctiles de 44 px y controles con roles,
  estado y foco coherentes.

## Preguntas resueltas por la solicitud actual

- El encabezado azul conserva su rol de navegación global; la superficie blanca empieza debajo.
- Manual se presenta como alternativa visible para cargar una unidad o monto fuera del catálogo.
- El marco y la barra se documentan como candidatos a adopción gradual en otras aplicaciones.
