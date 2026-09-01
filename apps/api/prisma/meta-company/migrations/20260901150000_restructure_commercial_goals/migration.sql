CREATE TYPE "commercial_advisor_kind" AS ENUM ('PERSON', 'SALES_CHANNEL');

CREATE TABLE "dim_empresas_metas" (
  "id_empresa" SERIAL PRIMARY KEY,
  "codigo" VARCHAR(30) NOT NULL UNIQUE,
  "empresa" VARCHAR(100) NOT NULL UNIQUE,
  "activo" BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO "dim_empresas_metas" ("codigo", "empresa")
VALUES ('TIMBO', 'Timbo'), ('FIXIT', 'Fixit');

ALTER TABLE "dim_negocio_margenes" RENAME TO "dim_negocios_metas";
ALTER TABLE "dim_negocios_metas" ADD COLUMN "id_empresa" INTEGER;
UPDATE "dim_negocios_metas"
SET "id_empresa" = (SELECT "id_empresa" FROM "dim_empresas_metas" WHERE "codigo" = 'TIMBO');
ALTER TABLE "dim_negocios_metas" ALTER COLUMN "id_empresa" SET NOT NULL;
ALTER TABLE "dim_negocios_metas"
  ADD CONSTRAINT "dim_negocios_metas_id_empresa_fkey"
  FOREIGN KEY ("id_empresa") REFERENCES "dim_empresas_metas"("id_empresa") ON DELETE RESTRICT;
ALTER TABLE "dim_negocios_metas" DROP CONSTRAINT "dim_negocio_margenes_negocio_key";
ALTER TABLE "dim_negocios_metas"
  ADD CONSTRAINT "dim_negocios_metas_id_empresa_negocio_key" UNIQUE ("id_empresa", "negocio");
CREATE INDEX "dim_negocios_metas_id_empresa_activo_idx"
  ON "dim_negocios_metas" ("id_empresa", "activo");

ALTER TABLE "dim_marcas_timbo_margenes" RENAME TO "dim_marcas_metas";
ALTER TABLE "dim_marcas_metas" ADD COLUMN "id_empresa" INTEGER;
UPDATE "dim_marcas_metas"
SET "id_empresa" = (SELECT "id_empresa" FROM "dim_empresas_metas" WHERE "codigo" = 'TIMBO');
ALTER TABLE "dim_marcas_metas" ALTER COLUMN "id_empresa" SET NOT NULL;
ALTER TABLE "dim_marcas_metas"
  ADD CONSTRAINT "dim_marcas_metas_id_empresa_fkey"
  FOREIGN KEY ("id_empresa") REFERENCES "dim_empresas_metas"("id_empresa") ON DELETE RESTRICT;
ALTER TABLE "dim_marcas_metas" DROP CONSTRAINT "dim_marcas_timbo_margenes_marca_key";
ALTER TABLE "dim_marcas_metas"
  ADD CONSTRAINT "dim_marcas_metas_id_empresa_marca_key" UNIQUE ("id_empresa", "marca");
CREATE INDEX "dim_marcas_metas_id_empresa_activo_idx"
  ON "dim_marcas_metas" ("id_empresa", "activo");

INSERT INTO "dim_negocios_metas" ("id_empresa", "negocio")
SELECT "id_empresa", 'FIXIT'
FROM "dim_empresas_metas"
WHERE "codigo" = 'FIXIT';

CREATE TABLE "dim_asesores_metas" (
  "id_asesor" SERIAL PRIMARY KEY,
  "id_empresa" INTEGER NOT NULL REFERENCES "dim_empresas_metas"("id_empresa") ON DELETE RESTRICT,
  "sistema_origen" VARCHAR(30) NOT NULL,
  "codigo_externo" VARCHAR(100) NOT NULL,
  "nombre_visible" VARCHAR(150) NOT NULL,
  "tipo" "commercial_advisor_kind" NOT NULL DEFAULT 'PERSON',
  "activo" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "dim_asesores_metas_id_empresa_sistema_origen_codigo_externo_key"
    UNIQUE ("id_empresa", "sistema_origen", "codigo_externo")
);
CREATE INDEX "dim_asesores_metas_id_empresa_activo_nombre_visible_idx"
  ON "dim_asesores_metas" ("id_empresa", "activo", "nombre_visible");

INSERT INTO "dim_asesores_metas" (
  "id_empresa", "sistema_origen", "codigo_externo", "nombre_visible"
)
SELECT DISTINCT
  empresa."id_empresa",
  'SAP_B1',
  legacy."slp_code"::TEXT,
  'Codigo SAP ' || legacy."slp_code"::TEXT
FROM "ft_metas_margenes" legacy
CROSS JOIN "dim_empresas_metas" empresa
WHERE empresa."codigo" = 'TIMBO' AND legacy."tipo_meta" = 'Vendedor';

CREATE TABLE "ft_metas_marcas" (
  "id_meta_marca" SERIAL PRIMARY KEY,
  "periodo" DATE NOT NULL,
  "id_negocio" INTEGER NOT NULL REFERENCES "dim_negocios_metas"("id_negocio") ON DELETE RESTRICT,
  "id_marca" INTEGER NOT NULL REFERENCES "dim_marcas_metas"("id_marca") ON DELETE RESTRICT,
  "meta" DECIMAL(18, 2) NOT NULL,
  "fecha_creacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fecha_modificacion" TIMESTAMPTZ(6),
  CONSTRAINT "ft_metas_marcas_periodo_check" CHECK (EXTRACT(DAY FROM "periodo") = 1),
  CONSTRAINT "ft_metas_marcas_meta_check" CHECK ("meta" >= 0),
  CONSTRAINT "ft_metas_marcas_periodo_id_negocio_id_marca_key"
    UNIQUE ("periodo", "id_negocio", "id_marca")
);
CREATE INDEX "ft_metas_marcas_id_negocio_periodo_idx"
  ON "ft_metas_marcas" ("id_negocio", "periodo");
CREATE INDEX "ft_metas_marcas_id_marca_periodo_idx"
  ON "ft_metas_marcas" ("id_marca", "periodo");

CREATE TABLE "ft_metas_asesores" (
  "id_meta_asesor" SERIAL PRIMARY KEY,
  "periodo" DATE NOT NULL,
  "id_negocio" INTEGER NOT NULL REFERENCES "dim_negocios_metas"("id_negocio") ON DELETE RESTRICT,
  "id_marca" INTEGER REFERENCES "dim_marcas_metas"("id_marca") ON DELETE RESTRICT,
  "id_asesor" INTEGER NOT NULL REFERENCES "dim_asesores_metas"("id_asesor") ON DELETE RESTRICT,
  "meta" DECIMAL(18, 2) NOT NULL,
  "dias_habiles" INTEGER,
  "fecha_creacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fecha_modificacion" TIMESTAMPTZ(6),
  CONSTRAINT "ft_metas_asesores_periodo_check" CHECK (EXTRACT(DAY FROM "periodo") = 1),
  CONSTRAINT "ft_metas_asesores_meta_check" CHECK ("meta" >= 0),
  CONSTRAINT "ft_metas_asesores_dias_habiles_check" CHECK ("dias_habiles" IS NULL OR "dias_habiles" > 0)
);
CREATE INDEX "ft_metas_asesores_id_negocio_periodo_idx"
  ON "ft_metas_asesores" ("id_negocio", "periodo");
CREATE INDEX "ft_metas_asesores_id_asesor_periodo_idx"
  ON "ft_metas_asesores" ("id_asesor", "periodo");
CREATE INDEX "ft_metas_asesores_id_marca_periodo_idx"
  ON "ft_metas_asesores" ("id_marca", "periodo");
CREATE UNIQUE INDEX "ft_metas_asesores_alcance_con_marca_key"
  ON "ft_metas_asesores" ("periodo", "id_negocio", "id_asesor", "id_marca")
  WHERE "id_marca" IS NOT NULL;
CREATE UNIQUE INDEX "ft_metas_asesores_alcance_sin_marca_key"
  ON "ft_metas_asesores" ("periodo", "id_negocio", "id_asesor")
  WHERE "id_marca" IS NULL;

INSERT INTO "ft_metas_marcas" (
  "periodo", "id_negocio", "id_marca", "meta", "fecha_creacion", "fecha_modificacion"
)
SELECT
  "periodo", "id_negocio", "id_marca", "meta", "fecha_creacion", "fecha_modificacion"
FROM "ft_metas_margenes"
WHERE "tipo_meta" = 'Marca';

INSERT INTO "ft_metas_asesores" (
  "periodo", "id_negocio", "id_marca", "id_asesor", "meta", "fecha_creacion", "fecha_modificacion"
)
SELECT
  legacy."periodo",
  legacy."id_negocio",
  legacy."id_marca",
  advisor."id_asesor",
  legacy."meta",
  legacy."fecha_creacion",
  legacy."fecha_modificacion"
FROM "ft_metas_margenes" legacy
JOIN "dim_empresas_metas" empresa ON empresa."codigo" = 'TIMBO'
JOIN "dim_asesores_metas" advisor ON
  advisor."id_empresa" = empresa."id_empresa"
  AND advisor."sistema_origen" = 'SAP_B1'
  AND advisor."codigo_externo" = legacy."slp_code"::TEXT
WHERE legacy."tipo_meta" = 'Vendedor';

DROP TABLE "ft_metas_margenes";

CREATE VIEW "ft_metas_margenes" AS
SELECT
  brand_goal."id_meta_marca" * 2 AS "id_meta",
  brand_goal."periodo",
  brand_goal."id_negocio",
  brand_goal."id_marca",
  NULL::INTEGER AS "slp_code",
  'Marca'::"commercial_goal_type" AS "tipo_meta",
  brand_goal."meta",
  brand_goal."fecha_creacion",
  brand_goal."fecha_modificacion"
FROM "ft_metas_marcas" brand_goal
UNION ALL
SELECT
  advisor_goal."id_meta_asesor" * 2 + 1 AS "id_meta",
  advisor_goal."periodo",
  advisor_goal."id_negocio",
  advisor_goal."id_marca",
  CASE
    WHEN advisor."sistema_origen" = 'SAP_B1' AND advisor."codigo_externo" ~ '^[0-9]+$'
      THEN advisor."codigo_externo"::INTEGER
    ELSE NULL
  END AS "slp_code",
  'Vendedor'::"commercial_goal_type" AS "tipo_meta",
  advisor_goal."meta",
  advisor_goal."fecha_creacion",
  advisor_goal."fecha_modificacion"
FROM "ft_metas_asesores" advisor_goal
JOIN "dim_asesores_metas" advisor ON advisor."id_asesor" = advisor_goal."id_asesor";
