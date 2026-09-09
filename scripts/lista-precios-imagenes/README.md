# Imágenes de Lista de Precios

Script puntual (no forma parte del build) para organizar en carpetas las
imágenes de los vehículos/máquinas de la app Lista de Precios, de forma que
se puedan subir a un proveedor de imágenes externo. Contexto completo en el
plan: `.claude/plans/en-lista-de-precios-logical-wren.md` (histórico de la
sesión que lo generó).

## Fase A — resolver permalinks (manual, con Claude Code)

No es un script standalone: se genera iterando el tool MCP
`productos_consultar_imagen` (ServiceLayer Timbo) por cada `Stock` de la
planilla `V_ListaPreciosTableau2`, y guardando el resultado en
`resolved-permalinks.json` con esta forma:

```json
[
  {
    "stock": "C14824",
    "marca": "SCANIA",
    "modelo": "P",
    "config": "",
    "susp": "",
    "tipoMotor": "",
    "permalink": "https://timbo.com.py/comprar/scania-p-2009-chasis-4x2-motor-360-12-opt/",
    "matchBy": "sku"
  }
]
```

`matchBy: "sku"` = foto propia de esa unidad (match por chasis, típicamente
Scania). `matchBy: "name"` = imagen default por Marca+Modelo+Config+Susp+
TipoMotor (fallback semántico).

## Fase B — descargar y organizar

```
node scripts/lista-precios-imagenes/download-images.mjs [resolved-permalinks.json] [carpetaSalida]
```

Por defecto lee `resolved-permalinks.json` de esta carpeta y escribe en
`C:\Users\desarrollo4.ti\Downloads\imagenes_lista_precios`, con:

- `por-stock/<STOCK>/...` para unidades con foto propia.
- `por-modelo/<MARCA>__<MODELO>__<CONFIG>__<SUSP>__<TIPOMOTOR>/...` para el resto.
- `_reporte.csv` con el detalle de qué se bajó y qué falló.

Sin dependencias externas: usa `fetch` nativo de Node y extrae las imágenes
del HTML por regex (`wp-content/uploads/...`), sin necesidad de un navegador.
