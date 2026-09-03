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

- `PlatformHeader` y `PlatformSessionBar` forman el contexto compartido y consecutivo de la
  plataforma. La tarea de la calculadora comienza después de ese subheader.
- `PlatformSessionBar` comunica sólo identidad y fecha/hora en una línea compacta. En escritorio
  se reparte a ambos extremos; en anchos angostos conserva lectura sin competir con el nombre.
- Las secciones internas usan proximidad y reglas de 1 px. No se anidan tarjetas ni se agregan
  sombras para simular jerarquía.
- La calculadora usa una superficie blanca continua debajo del subheader. En escritorio, la carga y
  la lista ocupan el plano principal y el resumen permanece a la derecha como parte de la misma
  mesa; en móvil se apilan sin perder el total ni la acción siguiente.

## Pantalla Unidades

- El orden es: progreso, alta de unidad, unidades cargadas y continuación. El campo activo es el
  primer foco operativo de la pantalla.
- Stock y Manual son dos alternativas equivalentes y siempre legibles. Stock toma precio y datos
  del catálogo; Manual sirve para una unidad o monto que no está en él.
- El selector conserva un indicador azul de media anchura, revelado con `clip-path`; el texto real
  de ambos botones no se duplica ni se oculta. Las flechas cambian de pestaña y conducen al primer
  campo del modo elegido.
- La zona que cambia de modo toma su altura natural. Los resultados extensos se desplazan dentro de
  la lista de catálogo, nunca se compensa su altura con un espacio vacío debajo de un formulario corto.
- Las acciones de alta y eliminación respetan el mínimo táctil de 44 px. Las unidades sin precio
  de lista no se ofrecen en las búsquedas de Stock.
- Una fila puede cotizar varias unidades iguales. Muestra sólo cantidad y total de línea; el
  selector de cantidad no reduce de una unidad y quitar elimina la fila completa tras confirmación.

## Pantalla Condiciones

- La pantalla conserva el shell blanco continuo del wizard: el encabezado azul de la plataforma y
  sus reglas siguen siendo el marco; los grupos internos se separan sólo con divisores, sin cards
  ni sombras.
- En escritorio, la ruta de lectura es entrega inicial, condiciones de cuota y cálculo. Los
  controles ocupan hasta 760 px y el resumen compacto queda a la derecha dentro de la misma mesa.
  En móvil, el resumen aparece antes de los controles tanto visual como semánticamente.
- El resumen muestra unidades, precio total, entrega inicial y saldo a financiar. El total y el
  saldo reciben el peso numérico principal; el resto es secundario.
- Entrega inicial es un único grupo con porcentaje destacado, slider de 0 a 100 % en pasos de
  0,01 % e importe manual. El slider conserva el origen porcentual; el importe conserva el origen
  manual. Ambos recalculan su contraparte de inmediato y se limitan entre cero y el precio total.
  Si cambia el total, se conserva el último origen elegido.
- El importe acepta formato paraguayo con puntos de agrupación, coma decimal y hasta dos
  decimales; siempre vuelve a presentarse como `#.###.###,## USD`. Los cambios se anuncian mediante
  una salida accesible que incluye entrega y saldo.
- El slider mantiene una pista táctil de 44 px y foco turquesa visible. Los demás controles
  preservan el orden de foco natural y la densidad empresarial plana de la plataforma.

## Movimiento y accesibilidad

El cambio Stock/Manual por puntero usa una transición de recorte de 180 ms con salida exponencial;
es direccional e interrumpible. Con teclado y con `prefers-reduced-motion: reduce`, el modo cambia
instantáneamente. No se anima el formulario ni la lista: evita una segunda señal que competiría con
la decisión principal.

El progreso del wizard es una cápsula pasiva de tres segmentos: las tres etapas permanecen visibles,
el paso actual usa azul operativo, los completos azul claro y los pendientes blanco. Al avanzar o
volver con puntero, sólo la nueva pantalla se mueve 8 px con opacidad; el teclado y la preferencia
de movimiento reducido actualizan el estado sin movimiento.

## Candidatos para promoción

La estructura de `PlatformSessionBar` es un patrón compartido. El marco y la composición de la
tarea se decidirán por separado antes de promoverlos a otras aplicaciones.
