# Lista de Precios: variantes

La pantalla de variantes es una superficie operativa de consulta rápida. El recorrido de lectura es
buscador y filtros avanzados, segmentación por situación de ubicación, ubicación concreta y,
finalmente, las variantes resultantes.

La segmentación rápida conserva cuatro grupos comerciales: Disponibles, En tránsito, Judiciales y
Comprometidos. Al elegir uno, sólo se muestran ubicaciones que tienen al menos una unidad dentro de
ese grupo; cada control informa su cantidad. La primera línea usa cuatro celdas equivalentes en
escritorio y dos columnas en móvil. En escritorio la segunda línea es horizontal. En móvil se
contrae inicialmente a una acción explícita que informa cuántas ubicaciones existen; al expandirla,
las presenta en una lista vertical. Tras elegir una, el mismo control muestra la selección y ofrece
"Cambiar", evitando que el scroll horizontal oculte opciones a quien no descubra el gesto.

Las ubicaciones En tránsito, Fábrica y Aduana pertenecen al segmento En tránsito; Ciudad del Este,
Carneados, Proceso/Taller y Leasing al Judicial; y Préstamo, Alquileres y Uso Interno al
Comprometido. Las demás unidades cuyo indicador de disponibilidad sea `SI` son Disponibles.

La selección de búsqueda, filtros avanzados, grupo comercial y ubicación pertenece a cada
marca/modelo/suspensión mientras la persona recorre el detalle de una variante. No se convierte en
un patrón global porque es propio de la consulta de stock de Lista de Precios.

Al entrar al detalle, esa misma selección limita la lista de unidades. El encabezado de la lista
declara cuántas unidades se muestran frente al total de la variante y nombra los criterios activos;
así el contexto se conserva sin repetir la interfaz de filtros.
