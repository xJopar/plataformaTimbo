-- Estas referencias iniciales permiten verificar la proyeccion de metas por marca en Power BI.
INSERT INTO "dim_negocios_metas" ("id_empresa", "negocio")
SELECT "id_empresa", 'Unidades & Semi'
FROM "dim_empresas_metas"
WHERE "codigo" = 'TIMBO'
ON CONFLICT ("id_empresa", "negocio") DO NOTHING;

INSERT INTO "dim_marcas_metas" ("id_empresa", "marca")
SELECT empresa."id_empresa", source."marca"
FROM "dim_empresas_metas" empresa
CROSS JOIN (
  VALUES ('SCANIA'), ('SINOTRUK')
) AS source("marca")
WHERE empresa."codigo" = 'TIMBO'
ON CONFLICT ("id_empresa", "marca") DO NOTHING;

INSERT INTO "ft_metas_marcas" ("periodo", "id_negocio", "id_marca", "meta")
SELECT
  DATE '2026-09-01',
  business."id_negocio",
  brand."id_marca",
  source."meta"
FROM (
  VALUES
    ('SCANIA', 864000.00::DECIMAL(18, 2)),
    ('SINOTRUK', 239330.00::DECIMAL(18, 2))
) AS source("marca", "meta")
JOIN "dim_empresas_metas" empresa ON empresa."codigo" = 'TIMBO'
JOIN "dim_negocios_metas" business
  ON business."id_empresa" = empresa."id_empresa"
  AND business."negocio" = 'Unidades & Semi'
JOIN "dim_marcas_metas" brand
  ON brand."id_empresa" = empresa."id_empresa"
  AND brand."marca" = source."marca"
ON CONFLICT ("periodo", "id_negocio", "id_marca") DO NOTHING;
