ALTER TABLE "ft_metas_marcas"
  ADD COLUMN "dias_habiles" INTEGER;

ALTER TABLE "ft_metas_marcas"
  ADD CONSTRAINT "ft_metas_marcas_dias_habiles_check"
  CHECK ("dias_habiles" IS NULL OR "dias_habiles" > 0);
