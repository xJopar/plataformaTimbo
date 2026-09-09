---
target: Calculadora de Cuotas — layout/estructura
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-09-01T14-25-16Z
slug: apps-web-src-applications-calculadora-cuotas
---
# Crítica de diseño — Calculadora de Cuotas (layout/estructura)

Method: dual-agent (A: design-review sub-agent · B: detector + evidencia técnica sub-agent)

⚠️ Nota de alcance: navegador no disponible esta sesión (extensión de Chrome desconectada) — sin overlay del detector ni inspección visual en vivo. La evidencia visual sale de las 4 capturas reales que compartiste + medición exacta contra el CSS real (Assessment B).

## Design Health Score

| # | Heurística | Puntaje | Hallazgo clave |
|---|---|---|---|
| 1 | Visibilidad del estado del sistema | 2/4 | El Cuotero ya se recalcula solo al agregar el primer ítem (usa `DEFAULT_CONFIG`), pero "Calcular cuota" sigue deshabilitado porque `draftConfig === appliedConfig` al montar — el botón dice "nada calculado" cuando sí hay números reales en pantalla. |
| 2 | Correspondencia con el mundo real | 3/4 | Terminología del negocio correcta y específica (entrega inicial, refuerzos semestrales, cuota de ajuste). Resta un punto por no explicar "Cuota de ajuste (redondeo)" en ningún lado. |
| 3 | Control y libertad del usuario | 2/4 | Sin "resetear a valores por defecto"; quitar un ítem obliga a rebuscarlo en el catálogo. |
| 4 | Consistencia y estándares | 2/4 | Segmentado para 2-3 opciones en unos campos, `<select>` nativo en otros, misma clase de decisión. Confirmado en CSS: `.cc-config-grid` no fija `align-items`, así que "Plazo" (una línea) se estira a la altura de "Entrega inicial" (segmentado + input + hint), dejando un hueco vacío visible. |
| 5 | Prevención de errores | 1/4 | Sin validación inline mientras se escribe; el error de "entrega insuficiente" aparece recién en el Cuotero. Confirmado en CSS: `.cc-apply-row` (contiene el botón) no tiene borde/fondo que lo separe de la grilla, a diferencia de `.cc-total-row` que sí. |
| 6 | Reconocimiento antes que memoria | 3/4 | Buscador con precio visible, lista de agregados siempre a la vista, total siempre presente. |
| 7 | Flexibilidad y eficiencia | 1/4 | Sin comparar dos escenarios (36 vs 48 meses) ni exportar/copiar el cuotero ya calculado — fricción real para un vendedor que cotiza todo el día. |
| 8 | Estética y diseño minimalista | 2/4 | Huecos verticales muertos medibles en `cc-config-grid` (línea 435-439 del CSS); 4 campos con el mismo peso visual sin separar "elegibilidad" (Plazo/Entrega) de "preferencias de formato" (Periodicidad/Refuerzos). |
| 9 | Ayuda a reconocer y recuperar errores | 2/4 | Mensajes de error bien redactados y accionables, pero geográficamente desconectados del campo que los causó. |
| 10 | Ayuda y documentación | 1/4 | Cero tooltips/glosario para "Cuota de ajuste", "Saldo a financiar", "Refuerzo" — términos que un empleado nuevo no necesariamente conoce. |
| **Total** | | **19/40** | **Pobre** (banda 12-19: overhaul mayor necesario) |

## Design Specificity Verdict

**Contenido específico, forma genérica.** El copy sí está anclado al dominio (entrega inicial, refuerzos semestrales típicos de financiación de maquinaria/vehículos, cuota de ajuste, saldo a financiar). Pero la forma —resultados de catálogo puramente textuales sin foto/ícono de tipo de unidad, un `<dl>` de filas etiqueta/valor para el cuotero— es intercambiable con cualquier simulador de crédito genérico. Nada en el layout delata que se trata de bienes de alto valor unitario con selección física de SKU.

**Scan determinístico** (`detect.mjs --json`): exit code 0, **0 hallazgos**. El motor es léxico/regex (colores no neutros, fuentes sobreusadas, animaciones tipo bounce) — no evalúa composición de grillas, `max-width` efectivo por viewport ni relaciones espaciales. Cero hallazgos del CLI es coherente con "no viola patrones léxicos conocidos", pero no contradice el problema de layout reportado, que es de composición, no de léxico.

**Verificación cuantitativa contra el CSS real** (esto es lo que más pesa de Assessment B):
- `.cc-page { max-width: 1040px; margin: 0 auto }` — coincide exacto con el `1040 × 636` del overlay del usuario. Aire muerto: 160px por lado a 1360px de viewport (23.5%), 200px a 1440px (27.8%), **440px por lado a 1920px (45.8% del viewport vacío)**.
- Este ancho **no es un outlier de esta app**: el panel de administración del propio shell usa 1024px (`64rem`); `calculadora-cuotas` es 16px más ancho. El aire muerto es real en cifras absolutas, pero es una característica compartida con el resto de la plataforma, no una desviación exclusiva de esta app.
- `.cc-layout` en desktop: `grid-template-columns: minmax(0, 1fr) 380px`. La columna del Cuotero es **fija en 380px sin importar el viewport** — ni con 1920px de ancho crece.
- **Causa raíz confirmada del Cuotero "enterrado"**: `position: sticky` está en `.cc-layout-aside` como bloque completo, no en el Cuotero individualmente. Dentro de ese bloque, `FinancingConfig` precede a `InstallmentSummary` en el JSX. El sticky sólo fija el borde superior del bloque combinado — no sube el Cuotero por separado. La altura acumulada de título + fila de total + grid de 4 campos + hints + fila de aplicar de "Precio final y condiciones" empuja el inicio del Cuotero cerca o debajo del pliegue en alturas de viewport típicas de laptop. El propio comentario del código (`css:66-68`, "la derecha es un panel de resultado siempre a la vista... así no hace falta bajar toda la página") documenta una intención que el resultado medido contradice directamente: es un bug de layout respecto a la propia especificación interna, no sólo una opinión externa.
- Esto sólo aplica desde `min-width: 1024px`; por debajo, todo es una sola columna en flujo normal (mitigado por la barra fija `.cc-mobile-summary`).

**Visual overlays**: no disponibles esta sesión (extensión de Chrome desconectada) — señal de fallback, no hay overlay visible en un tab `[Human]`.

## Overall Impression

El motor de cálculo (interés real + redondeo) ya es sólido y auditable línea por línea en el Cuotero — ese trabajo se nota. Pero el layout invierte la jerarquía de valor: en un "loan simulator", el resultado es el producto, y hoy vive en una columna angosta de 380px fijos, después de un formulario completo, con un botón "Calcular" que además miente sobre si ese resultado ya es real o no. La oportunidad más grande no es estética — es de secuencia y prioridad espacial: qué se ve primero, y si lo que se ve es honesto sobre su propio estado.

## What's Working

1. **Patrón draft/applied con "Cambios sin aplicar"**: evita recalcular en cada tecla y da control explícito sobre cuándo comprometerse a una configuración — sólido para no generar parpadeo de resultados mientras se ajustan varios parámetros a la vez.
2. **Desglose transparente y auditable del Cuotero**: entrega, tasa, interés, saldo, cuota regular, ajuste, refuerzo y total como líneas separadas en vez de un número único — genuinamente útil para que un vendedor justifique cada componente ante un cliente.
3. **Intención de resultado siempre visible** (aside sticky en desktop + barra fija en mobile): la intención de diseño documentada en el propio código es correcta; la ejecución en desktop es lo que falla (ver Priority Issues).

## Priority Issues

**[P1] El Cuotero, la razón de ser de la herramienta, queda debajo del pliegue en el primer render (desktop).**
Why it matters: en un simulador de préstamo, enterrar el resultado detrás de un formulario completo invierte la jerarquía de valor — y contradice la propia intención documentada en el código de esta app.
Fix: no depender de que `sticky` en el bloque combinado resuelva la visibilidad; separar el Cuotero para que tenga su propio carril visible desde el arranque (ej. reordenar para que el resumen/total esté arriba o al costado del formulario, no después; considerar una tercera columna real en vez de forzar todo a los 380px fijos de la aside).
Suggested command: `/impeccable layout`

**[P1] "Calcular cuota" miente sobre el estado real del cálculo.**
Why it matters: el Cuotero ya se recalcula automáticamente con la configuración por defecto en cuanto se agrega el primer ítem, pero el botón sigue deshabilitado — un vendedor puede citar cifras creyendo que "todavía no se calculó nada", o al revés, no darse cuenta de que 36 meses/20% por defecto no es lo que pidió el cliente.
Fix: o el Cuotero no muestra nada hasta el primer click en "Calcular" (gatear también por `items`, no sólo por config aplicada), o el estado visual comunica honestamente "mostrando resultado con valores por defecto" hasta que el usuario aplique un cambio explícito.
Suggested command: `/impeccable clarify`

**[P2] Columna del Cuotero fija en 380px sin importar el viewport — nunca aprovecha el espacio ganado en monitores anchos.**
Why it matters: a 1920px hay 440px vacíos por lado mientras la columna que más necesita aire (etiquetas largas como "Total a pagar (entrega + refuerzos + cuotas)") sigue comprimida en 380px.
Fix: usar el ancho liberado del contenedor para una tercera columna real en breakpoints anchos, o al menos hacer la aside proporcional en vez de fija.
Suggested command: `/impeccable layout`

**[P2] Errores de validación aparecen lejos del campo que los causa.**
Why it matters: el usuario tiene que correlacionar manualmente "por qué no calculó" con cuál de los 4 campos fue el problema — más grave todavía si el Cuotero está fuera de vista (issue anterior).
Fix: mostrar el error también junto al campo ofensivo (ej. borde + texto bajo "Entrega inicial" cuando cae debajo del mínimo), no sólo en el Cuotero.
Suggested command: `/impeccable clarify`

**[P2] Grid de "Precio final y condiciones" con alturas de celda desparejas y sin agrupación jerárquica visible.**
Why it matters: `.cc-config-grid` no define `align-items`, así que "Plazo" (una línea) se estira a la altura de "Entrega inicial" (segmentado + input + hint), dejando un hueco vacío visible; las 4 celdas (Plazo, Entrega, Periodicidad, Refuerzos) tienen el mismo peso pese a ser dos tipos de decisión distintos (elegibilidad vs. preferencia de formato) sin ninguna línea, fondo o separador entre filas.
Fix: `align-items: start` en `.cc-config-grid`; separar visualmente elegibilidad (Plazo, Entrega) de preferencias de formato (Periodicidad, Refuerzos); unificar segmentado vs. `<select>` para el mismo tipo de decisión.
Suggested command: `/impeccable layout`

**[P2] Contraste insuficiente en los hints de campo.**
Why it matters: `.cc-field-hint` (usado en "Mínimo 20% para financiar.") usa `#64748B` sobre `#EDF2F7` → ratio ~4.23:1, falla AA para texto normal (se necesita 4.5:1) por un margen medible, justo en un texto que comunica una regla de negocio real (mínimo de entrega).
Fix: oscurecer levemente el color del hint o subir su tamaño a "texto grande" (18px+) donde 3:1 alcanza.
Suggested command: `/impeccable audit`

## Persona Red Flags

**Vendedor con el cliente enfrente, bajo presión de tiempo:** ajusta la entrega inicial a un valor insuficiente, el sistema lo rechaza en una sección que puede estar fuera de vista, y no hay ninguna señal en el campo mismo para saber qué corregir — tiene que scrollear y buscar el error mientras el cliente espera.

**Empleado nuevo, sin jerga de financiación de maquinaria:** se topa con "Cuota de ajuste (redondeo)" y "Refuerzo × 10 refuerzos / SEMESTRAL" sin tooltip ni glosario, y tiene que inferir el significado antes de explicárselo a un cliente.

**Vendedor senior de alto volumen:** no puede exportar/copiar el cuotero calculado, ni comparar dos escenarios (con/sin refuerzos, 36 vs. 48 meses) a la vez — el patrón apply-config es de un solo estado.

## Minor Observations

- El texto de confirmación al quitar un ítem ("Esta acción no se puede deshacer") es una advertencia desproporcionada para algo trivialmente reversible (rebuscar el ítem).
- La nota "Monto de refuerzo aún provisorio..." es una advertencia de negocio real (los números pueden cambiar) pero está tipográficamente al mismo nivel que cualquier texto secundario silencioso.
- Resultados de catálogo puramente textuales (nombre, stock, precio), sin foto/ícono que ayude a distinguir SKUs similares antes de agregarlos.
- El botón "Calcular cuota" reutiliza el mismo azul de marca que controles de selección secundarios (segmentados activos, tabs activos) — sin tratamiento de color exclusivo como CTA principal.
- `.cc-apply-row` no tiene separador visual respecto a la grilla de campos (a diferencia de `.cc-total-row`, que sí lo tiene arriba).

## Questions to Consider

1. Si el Cuotero es la razón de ser de esta herramienta, ¿por qué el layout obliga a atravesar dos secciones completas antes de ver un número? ¿Cómo se vería esta página si se diseñara empezando por el Cuotero?
2. El patrón draft/applied asume que "nada se recalcula hasta presionar Calcular" — pero el código ya recalcula solo con agregar un ítem. ¿Ese botón resuelve un problema real o enmascara uno?
3. Para un vendedor en vivo, ¿por qué el error de "entrega insuficiente" espera al Cuotero en vez de señalarse en el momento y lugar donde se escribe el valor problemático?
