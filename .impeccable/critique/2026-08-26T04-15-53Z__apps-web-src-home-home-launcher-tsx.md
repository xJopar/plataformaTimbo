---
target: home / launcher de aplicaciones
total_score: 31
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-26T04-15-53Z
slug: apps-web-src-home-home-launcher-tsx
---
Method: dual-agent (A: /root/critique_design_a2 · B: /root/critique_evidence_b)

## Design Health Score

| # | Heurística | Puntaje | Hallazgo clave |
|---|---|---:|---|
| 1 | Visibilidad del estado | 3/4 | Carga, error, vacío y cantidad están comunicados; al abrir una app no hay señal de transición. |
| 2 | Correspondencia con el mundo real | 4/4 | Lenguaje interno claro y fecha localizada para empleados. |
| 3 | Control y libertad | 3/4 | Inicio y reintentos son salidas seguras; falta retorno contextual tras un lanzamiento erróneo. |
| 4 | Consistencia y estándares | 4/4 | Sistema visual, foco y patrones coherentes con el App Shell. |
| 5 | Prevención de errores | 3/4 | Administración se muestra aun a quien no tendría acceso. |
| 6 | Reconocimiento sobre recuerdo | 4/4 | Nombre, descripción y acción están visibles. |
| 7 | Flexibilidad y eficiencia | 3/4 | Lanzamiento de un clic; sin búsqueda, favoritos ni atajos al crecer el catálogo. |
| 8 | Diseño estético y minimalista | 3/4 | Limpio, pero el título y vacío visual eclipsan la única herramienta. |
| 9 | Reconocer y recuperar errores | 3/4 | Reintento claro; sin vía de soporte si persiste la falla. |
| 10 | Ayuda y documentación | 1/4 | No hay ayuda ni ruta de soporte visible. |
| **Total** |  | **31/40** | **Bueno (78%)** |

## Veredicto de especificidad

El App Shell se siente propio de Timbo por su tono corporativo, el nombre del empleado, la fecha y la disciplina de líneas, color y tipografía. Sin embargo, la fila de aplicación es intercambiable: nombre, descripción y “Abrir aplicación” podrían pertenecer a cualquier intranet. No requiere iconos —están fuera del alcance vigente—, sino metadatos de tarea y destino más reconocibles.

El detector determinista no halló problemas: `detect.mjs --json apps/web/src/home/home-launcher.tsx` devolvió `[]` (salida 0). La revisión visual autenticada confirmó el H1, el contador y un enlace de lanzamiento. No hubo falsos positivos.

## Impresión general

Es una base sobria, clara y confiable para operar. La oportunidad principal es convertir el lanzamiento de una fila técnica en un punto de inicio de trabajo inequívoco, sin abandonar el minimalismo del sistema.

## Lo que funciona

- Jerarquía nítida: el objetivo de la pantalla se entiende de inmediato y la superficie de trabajo conserva una medida legible.
- Estados operativos sólidos: carga, vacío, error y reintento tienen copy explícito y semántica accesible.
- Coherencia real del sistema: contraste, foco turquesa de 3 px, controles rectangulares y reducción de movimiento respetan el diseño documentado.

## Problemas prioritarios

### [P1] Riesgo de colisión del encabezado en móvil o zoom al 200%

**Por qué importa:** `Plataforma Timbo`, `Administración` y `Cerrar sesión` permanecen en una sola fila; a 320 px o con zoom se comprometen el orden, los objetivos táctiles y el recorrido por teclado.

**Arreglo:** apilar o envolver el encabezado en un breakpoint probado, preservando objetivos de 44 px y orden de foco lógico.

**Comando sugerido:** `$impeccable adapt`.

### [P1] Administración promete una acción potencialmente inaccesible

**Por qué importa:** el enlace se renderiza sin comprobar el rol; un empleado sin privilegios puede llegar a un rechazo evitable.

**Arreglo:** mostrarlo solo a administradores o comunicar antes de navegar qué acceso se requiere.

**Comando sugerido:** `$impeccable harden`.

### [P2] La fila de aplicación no escala como catálogo sin iconos

**Por qué importa:** a medida que haya 8–15 aplicaciones, nombre y descripción genérica obligarán a leer linealmente y la lista perderá identidad.

**Arreglo:** incorporar un metadato compacto y orientado a tarea/destino por aplicación, manteniendo toda la fila como un único enlace.

**Comando sugerido:** `$impeccable clarify`.

### [P2] La composición privilegia el título sobre el objeto de trabajo

**Por qué importa:** en escritorio, “Tus aplicaciones” domina visualmente y el contador queda lejos de la lista; la única herramienta parece secundaria.

**Arreglo:** bajar la escala o el margen del H1 en escritorio, alinear el contador con el encabezado de lista e incrementar levemente la densidad útil de la fila.

**Comando sugerido:** `$impeccable layout`.

### [P2] Falla recuperable sin escalamiento

**Por qué importa:** reintentar repetidamente no da a la persona una ruta segura hacia soporte ni una referencia para diagnosticar.

**Arreglo:** añadir una alternativa de soporte segura y, cuando exista, un identificador de solicitud no sensible.

**Comando sugerido:** `$impeccable harden`.

## Personas

**Alex (usuario experto):** lanzar una app hoy es rápido, pero al crecer el catálogo no tendrá búsqueda, favoritos, recientes ni atajos; además, el enlace de Administración agrega una parada de tabulación sin valor para quien no es administrador.

**Sam (accesibilidad):** la estructura semántica y el foco visible son buenas señales. El encabezado sin envoltura es un riesgo a 200% de zoom; no hay enlace para saltar directamente al contenido ni alternativa de escalamiento tras errores repetidos.

**Jordan (primera vez):** entiende qué hacer enseguida, pero “Hello World” y “Primera aplicación…” no explican el trabajo concreto ni el destino posterior. Tampoco ve una ayuda o soporte cercano.

## Observaciones menores

- La hora exacta añade densidad, pero aporta poco a la decisión de abrir una aplicación.
- Una señal textual de destino reduciría la dependencia de hover para anticipar el lanzamiento.
- El H1 usa una escala cercana al display reservado para la superficie de acceso y puede sobrepesar una pantalla de operación.

## Preguntas para considerar

1. Si Timbo llega a 12 aplicaciones sin iconos, ¿qué único metadato permitiría reconocer la herramienta correcta en menos de tres segundos?
2. ¿Administración debe ser una función visible solo para quien tiene rol o una ruta descubrible con explicación de acceso?
3. ¿El launcher debe sentirse como un catálogo sereno o como una central de trabajo que prioriza la próxima tarea de la persona?
