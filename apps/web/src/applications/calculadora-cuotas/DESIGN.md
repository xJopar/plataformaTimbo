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

