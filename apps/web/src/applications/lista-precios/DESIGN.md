# Lista de Precios: modelos y variantes

Las pantallas de modelos y variantes forman una superficie operativa de consulta rápida. El recorrido
de lectura es buscador, segmentación por situación de ubicación, ubicación concreta y, finalmente,
los resultados. La pantalla de variantes agrega los filtros avanzados antes de esa segmentación.

La segmentación rápida conserva cinco grupos comerciales: Carneados, Comprometidos, Disponibles,
En tránsito y Judiciales. Al elegir uno, sólo se muestran ubicaciones que tienen al menos una unidad
dentro de ese grupo; cada control informa su cantidad. La primera línea usa cinco celdas equivalentes
en escritorio. En móvil, las primeras cuatro ocupan una grilla de dos columnas y Judiciales ocupa la
quinta celda a todo el ancho, evitando una opción aislada o comprimida. En escritorio la segunda línea
es horizontal. En móvil se
contrae inicialmente a una acción explícita que informa cuántas ubicaciones existen; al expandirla,
las presenta en una lista vertical. Tras elegir una, el mismo control muestra la selección y ofrece
"Cambiar", evitando que el scroll horizontal oculte opciones a quien no descubra el gesto.

Carneados se consulta como grupo propio porque son unidades a las que se les retiraron piezas para
reparar otra; siguen disponibles, pero requieren una reparación antes de ofrecerse. Préstamo,
Alquileres y Uso Interno pertenecen a Comprometidos. Asunción, Proceso/Taller, Línea 12, Santa Rita,
Encarnación, Santa Rosa del Aguaray, Cooperativa Neuland Chaco, IZ Todo Terreno CDE, Nueva Esperanza,
Curuguaty y Ciudad del Este pertenecen a Disponibles. En tránsito, Fábrica y Aduana pertenecen a En
tránsito; y Limpio y Leasing a Judiciales. Las demás unidades cuyo indicador de disponibilidad sea
`SI` son Disponibles.

La segmentación rápida comienza ya en la selección de modelos: las cantidades de cada modelo se
recalculan con el grupo comercial y la ubicación elegidos. Al entrar a un modelo, el mismo contexto
se conserva y se vuelve a mostrar sobre las variantes para poder ajustarlo con el detalle propio de
ese modelo. La búsqueda de modelos sigue siendo local a esa selección; la búsqueda y los filtros
avanzados pertenecen a la consulta de variantes.

La selección rápida pertenece a cada marca durante el recorrido. La selección detallada de
búsqueda y filtros avanzados pertenece a cada marca/modelo/suspensión mientras la persona recorre
el detalle de una variante. No se convierte en un patrón global porque es propio de la consulta de
stock de Lista de Precios.

Al entrar al detalle, esa misma selección limita la lista de unidades. El encabezado de la lista
declara cuántas unidades se muestran frente al total de la variante y nombra los criterios activos;
así el contexto se conserva sin repetir la interfaz de filtros.
