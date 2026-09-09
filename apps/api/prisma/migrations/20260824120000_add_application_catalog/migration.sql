-- CreateEnum
CREATE TYPE "application_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "launch_path" TEXT NOT NULL,
    "status" "application_status" NOT NULL DEFAULT 'ACTIVE',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivated_at" TIMESTAMPTZ(6),

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraint
ALTER TABLE "applications" ADD CONSTRAINT "applications_key_check" CHECK (
    "key" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND LENGTH("key") <= 64
);

-- AddCheckConstraint
ALTER TABLE "applications" ADD CONSTRAINT "applications_name_check" CHECK (
    BTRIM("name") <> '' AND LENGTH("name") <= 120
);

-- AddCheckConstraint
ALTER TABLE "applications" ADD CONSTRAINT "applications_description_check" CHECK (
    "description" IS NULL OR (BTRIM("description") <> '' AND LENGTH("description") <= 500)
);

-- AddCheckConstraint
ALTER TABLE "applications" ADD CONSTRAINT "applications_launch_path_check" CHECK (
    "launch_path" ~ '^/apps/[a-z0-9]+(-[a-z0-9]+)*(/[a-z0-9]+(-[a-z0-9]+)*)*$'
    AND LENGTH("launch_path") <= 200
);

-- AddCheckConstraint
ALTER TABLE "applications" ADD CONSTRAINT "applications_display_order_check" CHECK (
    "display_order" >= 0
);

-- AddCheckConstraint
ALTER TABLE "applications" ADD CONSTRAINT "applications_status_coherence_check" CHECK (
    ("status" = 'ACTIVE' AND "deactivated_at" IS NULL)
    OR ("status" = 'INACTIVE' AND "deactivated_at" IS NOT NULL)
);

-- CreateIndex
CREATE UNIQUE INDEX "applications_key_key" ON "applications"("key");

-- CreateIndex
CREATE UNIQUE INDEX "applications_launch_path_key" ON "applications"("launch_path");

-- CreateIndex
CREATE INDEX "applications_status_display_order_name_idx" ON "applications"("status", "display_order", "name");

-- SeedInitialApplication
INSERT INTO "applications" (
    "id",
    "key",
    "name",
    "description",
    "launch_path",
    "display_order"
) VALUES (
    '80aa0b7c-36bd-4d13-8d6c-fdbb0a64aa90',
    'hello-world',
    'Hello World',
    'Primera aplicación de Plataforma Timbo.',
    '/apps/hello-world',
    0
);
