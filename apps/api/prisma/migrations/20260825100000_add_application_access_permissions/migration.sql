-- Los perfiles de sistema existentes permanecen vigentes, pero la clave deja de ser un enum
-- para que cada aplicación pueda definir perfiles funcionales persistidos.
ALTER TABLE "access_profiles" ADD COLUMN "name" TEXT;
ALTER TABLE "access_profiles" ADD COLUMN "description" TEXT;
CREATE TYPE "access_profile_scope" AS ENUM ('SYSTEM', 'APPLICATION');
CREATE TYPE "access_profile_status" AS ENUM ('ACTIVE', 'INACTIVE');
ALTER TABLE "access_profiles" ADD COLUMN "scope" "access_profile_scope";
ALTER TABLE "access_profiles" ADD COLUMN "application_id" UUID;
ALTER TABLE "access_profiles" ADD COLUMN "status" "access_profile_status" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "access_profiles" ADD COLUMN "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "access_profiles" ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "access_profiles" ADD COLUMN "deactivated_at" TIMESTAMPTZ(6);
UPDATE "access_profiles" SET "name" = 'Administrador de plataforma', "scope" = 'SYSTEM' WHERE "key"::text = 'PLATFORM_ADMIN';
ALTER TABLE "access_profiles" ALTER COLUMN "key" TYPE TEXT USING "key"::text;
ALTER TABLE "access_profiles" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "access_profiles" ALTER COLUMN "scope" SET NOT NULL;
DROP TYPE "access_profile_key";
ALTER TABLE "access_profiles" ADD CONSTRAINT "access_profiles_scope_application_check"
  CHECK (("scope" = 'SYSTEM' AND "application_id" IS NULL) OR ("scope" = 'APPLICATION' AND "application_id" IS NOT NULL));
ALTER TABLE "access_profiles" ADD CONSTRAINT "access_profiles_status_deactivated_check"
  CHECK (("status" = 'ACTIVE' AND "deactivated_at" IS NULL) OR ("status" = 'INACTIVE' AND "deactivated_at" IS NOT NULL));
ALTER TABLE "access_profiles" ADD CONSTRAINT "access_profiles_key_check"
  CHECK ("key" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR "key" = 'PLATFORM_ADMIN');
ALTER TABLE "access_profiles" ADD CONSTRAINT "access_profiles_name_check" CHECK (char_length(trim("name")) BETWEEN 1 AND 120);
ALTER TABLE "access_profiles" ADD CONSTRAINT "access_profiles_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
DROP INDEX "access_profiles_key_key";
CREATE UNIQUE INDEX "access_profiles_application_id_key_key" ON "access_profiles"("application_id", "key");
CREATE UNIQUE INDEX "access_profiles_system_key_key" ON "access_profiles"("key") WHERE "scope" = 'SYSTEM';
CREATE INDEX "access_profiles_application_id_status_name_idx" ON "access_profiles"("application_id", "status", "name");

CREATE TABLE "user_application_assignments" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "application_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_application_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_application_assignments_user_id_application_id_key" UNIQUE ("user_id", "application_id"),
  CONSTRAINT "user_application_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "user_application_assignments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "user_application_assignments_application_id_idx" ON "user_application_assignments"("application_id");

CREATE TYPE "application_permission_status" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TABLE "application_permissions" (
  "id" UUID NOT NULL, "application_id" UUID NOT NULL, "key" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT,
  "status" "application_permission_status" NOT NULL DEFAULT 'ACTIVE', "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "deactivated_at" TIMESTAMPTZ(6),
  CONSTRAINT "application_permissions_pkey" PRIMARY KEY ("id"), CONSTRAINT "application_permissions_application_id_key_key" UNIQUE ("application_id", "key"),
  CONSTRAINT "application_permissions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "application_permissions_key_check" CHECK ("key" ~ '^[a-z0-9]+([.-][a-z0-9]+)*$'),
  CONSTRAINT "application_permissions_name_check" CHECK (char_length(trim("name")) BETWEEN 1 AND 120),
  CONSTRAINT "application_permissions_status_deactivated_check" CHECK (("status" = 'ACTIVE' AND "deactivated_at" IS NULL) OR ("status" = 'INACTIVE' AND "deactivated_at" IS NOT NULL))
);
CREATE INDEX "application_permissions_application_id_status_name_idx" ON "application_permissions"("application_id", "status", "name");
CREATE TABLE "access_profile_permissions" (
  "id" UUID NOT NULL, "profile_id" UUID NOT NULL, "permission_id" UUID NOT NULL, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "access_profile_permissions_pkey" PRIMARY KEY ("id"), CONSTRAINT "access_profile_permissions_profile_id_permission_id_key" UNIQUE ("profile_id", "permission_id"),
  CONSTRAINT "access_profile_permissions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "access_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "access_profile_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "application_permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "access_profile_permissions_permission_id_idx" ON "access_profile_permissions"("permission_id");
-- Un trigger hace cumplir la igualdad entre application_id del perfil y del permiso, que un CHECK no puede consultar.
CREATE FUNCTION "ensure_access_profile_permission_application"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "access_profiles" profile JOIN "application_permissions" permission ON permission."id" = NEW."permission_id" WHERE profile."id" = NEW."profile_id" AND profile."scope" = 'APPLICATION' AND profile."application_id" = permission."application_id") THEN RAISE EXCEPTION 'El perfil y el permiso deben pertenecer a la misma aplicación'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "access_profile_permissions_application_trigger" BEFORE INSERT OR UPDATE ON "access_profile_permissions" FOR EACH ROW EXECUTE FUNCTION "ensure_access_profile_permission_application"();
