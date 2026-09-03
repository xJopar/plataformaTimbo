# Diseño: Calculadora de Cuotas

## Alcance y relación con el sistema

Esta aplicación extiende la dirección «Operación corporativa clara» de `DESIGN.md`. No crea una
marca paralela: reutiliza su azul operativo, superficies planas, reglas nítidas y foco turquesa.
Las decisiones de este archivo pertenecen exclusivamente al flujo de cotización; los patrones que
demuestren utilidad fuera de él se promueven al diseño general.

## Tesis de la superficie

La persona carga una o más unidades, define la financiación y lee un plan. Cada pantalla del
wizard debe responder una sola pregunta y la composición debe parecer una mesa de trabajo continua,
no una sucesión de franjas ni tarjetas.

## Superficie de trabajo

- La Calculadora vive dentro de `platform-application-workspace`: un marco blanco, con acento
  superior azul, sobre el fondo gris del App Shell.
- `PlatformHeader` y `PlatformSessionBar` forman el contexto compartido y consecutivo de la
  plataforma. El marco comienza después de ese subheader y reúne alertas y tarea.
- `PlatformSessionBar` comunica sólo identidad y fecha/hora en una línea compacta. En escritorio
  se reparte a ambos extremos; en anchos angostos conserva lectura sin competir con el nombre.
- Las secciones internas usan proximidad y reglas de 1 px. No se anidan tarjetas ni se agregan
  sombras para simular jerarquía.

## Pantalla Unidades

- El orden es: progreso, alta de unidad, unidades cargadas y continuación. El campo activo es el
  primer foco operativo de la pantalla.
- Stock y Manual son dos alternativas equivalentes y siempre legibles. Stock toma precio y datos
  del catálogo; Manual sirve para una unidad o monto que no está en él.
- El selector conserva un indicador azul de media anchura, revelado con `clip-path`; el texto real
  de ambos botones no se duplica ni se oculta. Las flechas cambian de pestaña y conducen al primer
  campo del modo elegido.
- La zona que cambia de modo toma su altura natural. La estabilidad visual viene de reservar el
  gutter del scrollbar y de desplazar resultados extensos dentro de la lista de catálogo, nunca de
  un espacio vacío fijo debajo de un formulario corto.
- Las acciones de alta y eliminación respetan el mínimo táctil de 44 px. Las unidades sin precio
  de lista no se ofrecen en las búsquedas de Stock.

## Movimiento y accesibilidad

El cambio Stock/Manual por puntero usa una transición de recorte de 180 ms con salida exponencial;
es direccional e interrumpible. Con teclado y con `prefers-reduced-motion: reduce`, el modo cambia
instantáneamente. No se anima el formulario ni la lista: evita una segunda señal que competiría con
la decisión principal.

## Candidatos para promoción

`platform-application-workspace` y la nueva estructura de `PlatformSessionBar` son patrones
compartidos. Se adoptan gradualmente en otras aplicaciones cuando su contenido también requiera un
contexto de sesión unido a una tarea principal.
