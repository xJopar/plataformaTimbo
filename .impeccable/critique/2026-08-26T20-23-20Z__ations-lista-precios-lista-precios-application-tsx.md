---
target: header y subheader de Lista de Precios (móvil)
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-26T20-23-20Z
slug: ations-lista-precios-lista-precios-application-tsx
---
## Salud de diseño

| # | Heurística | Puntaje | Hallazgo clave |
|---|---|---:|---|
| 1 | Visibilidad del estado | 2 | El contexto indica ubicación, pero no hay señal de carga, resultados o actualización. |
| 2 | Relación sistema / mundo real | 3 | La terminología de marca, modelo y configuración pertenece al dominio. |
| 3 | Control y libertad | 3 | Existe Volver; en móvil el destino no es visible y su área es de 36 px. |
| 4 | Consistencia y estándares | 3 | Las dos vistas repiten estructura, reglas y azul operacional. |
| 5 | Prevención de errores | 2 | La búsqueda y Filtrar no aclaran su alcance ni estado activo. |
| 6 | Reconocimiento antes que recuerdo | 3 | El buscador y el contexto están expuestos; los iconos dependen de una etiqueta no visual. |
| 7 | Flexibilidad y eficiencia | 1 | No se observan atajos ni persistencia de filtros para consultas repetitivas. |
| 8 | Estética y minimalismo | 3 | La ejecución es plana y limpia, aunque el chrome ocupa demasiado primer viewport. |
| 9 | Recuperación ante errores | 1 | No hay evidencia de estados de búsqueda, vacío o error. |
| 10 | Ayuda y documentación | 0 | No se ofrece ayuda contextual para filtros ni términos. |
| **Total** | | **21/40** | **Aceptable; requiere mejoras de claridad.** |

## Veredicto de especificidad

La cabecera es parcialmente específica: el wordmark TIMBO, el azul operativo y el uso de reglas planas sí responden al sistema. Sin embargo, la combinación de logo, iconos y metabar de saludo/fecha sería intercambiable con muchas aplicaciones internas. La identidad está presente; la tarea de consultar precios no domina todavía.

El detector se ejecutó sobre las dos capturas PNG y devolvió `[]` en ambos casos. Ese cero no es una señal de limpieza: el detector procesa texto/markup y no puede evaluar composición visual dentro de un PNG. No hubo falsos positivos; hay un falso negativo estructural para los problemas visuales. No se realizó overlay ni navegador: las entradas son imágenes estáticas, sin URL ni DOM mutable.

## Impresión general

El shell transmite confianza de marca y continuidad, pero la cabecera toma más altura y atención de la que una consulta rápida de precios puede permitirse. La mejora decisiva es transformar el espacio superior en orientación útil: qué nivel del catálogo estoy viendo y qué puedo buscar ahora.

## Lo que funciona

- El azul, los separadores y la ausencia de sombras respetan la dirección de operación corporativa clara.
- La estructura entre la lista de modelos y el detalle conserva el mismo patrón de marca, contexto, sesión y búsqueda.
- El código ofrece etiquetas accesibles para las acciones de aplicaciones y salida, y sus controles miden 44 px; es mejor de lo que permite inferir la captura.

## Problemas prioritarios

- **[P1] Chrome vertical desproporcionado.** El bloque azul de dos/tres líneas, la franja de sesión y el buscador desplazan el primer resultado por debajo del primer viewport móvil. **Por qué importa:** una consulta frecuente empieza sintiéndose lenta. **Fix:** compactar la marca una vez dentro de la app y reservar la segunda línea para `← Lista de Precios / Marca: SCANIA` o `← Lista de Precios / Modelo: SCANIA 124`; conservar al menos 44 px en el control de regreso. **Comando sugerido:** `$impeccable layout`.

- **[P1] Jerarquía de catálogo ambigua.** `Lista de Precios`, `SCANIA` y `SCANIA - 124` no explican visualmente si refieren a aplicación, marca, modelo o configuración. **Por qué importa:** el usuario debe deducir dónde está antes de buscar. **Fix:** usar separadores y etiquetas de nivel; ej. `Marca: SCANIA` y `Modelo: SCANIA 124`. **Comando sugerido:** `$impeccable clarify`.

- **[P2] La barra de sesión compite con la tarea.** Saludo y fecha son datos de baja frecuencia, se perciben diminutos y consumen una fila completa. **Por qué importa:** rompen el camino logo → contexto → búsqueda. **Fix:** mover fecha/hora a la cuenta o reducir la fila para mostrar una señal de resultados/filtros cuando sea útil. **Comando sugerido:** `$impeccable distill`.

- **[P2] El regreso no cumple el mínimo táctil del sistema.** `.application-breadcrumb-back` mide 36×36 px, mientras la propia guía de plataforma pide 44 px para controles móviles. **Por qué importa:** se degrada la navegación con pulgar o movilidad limitada. **Fix:** aumentar a 44×44 y mantener `aria-label`, foco turquesa y tooltip existentes. **Comando sugerido:** `$impeccable adapt`.

- **[P2] Búsqueda y filtro no describen su estado.** Los placeholders mejoran por pantalla, pero no hay indicación visible de alcance, filtros activos, cantidad de coincidencias ni recuperación vacía. **Por qué importa:** el usuario no puede verificar qué cambió después de actuar. **Fix:** añadir un resumen bajo el buscador, por ejemplo `5 modelos` / `2 filtros activos · Limpiar`, más estados de vacío y error. **Comando sugerido:** `$impeccable harden`.

## Alertas de persona

- **Alex, usuario frecuente:** ve una ruta lineal, sin persistencia de filtro ni un atajo para volver a una consulta recurrente; el chrome añade pasos perceptivos en cada visita.
- **Jordan, primera vez:** puede interpretar `SCANIA - 124` como un único nombre opaco; los iconos son accesibles en el código pero siguen sin etiqueta visual permanente en móvil.
- **Sam, usuario de teclado o lector de pantalla:** las acciones de app/salida disponen de `aria-label` y foco; el botón Volver, sin embargo, necesita 44 px y los tamaños compactos de sesión deben validarse a 200% de zoom.
- **Casey, móvil distraído:** las acciones de arriba quedan fuera de la zona cómoda del pulgar y el primer contenido útil llega tarde.

## Observaciones menores

- `FILTRAR` en mayúsculas no expresa si hay filtros activos; un contador resolvería la duda.
- La fecha con zona regional es correcta, pero la densidad tipográfica de esa fila necesita una prueba de contraste AA real.
- Las capturas no permiten validar foco, estados asíncronos, navegación por teclado ni el resultado de aplicar filtros.

## Preguntas para considerar

- ¿Qué información del encabezado ayuda realmente a decidir un precio ahora mismo?
- ¿Puede cada vista decir explícitamente qué nivel de catálogo muestra y qué busca el campo?
- Para una consulta repetitiva, ¿qué filtro o contexto debería sobrevivir entre visitas?
