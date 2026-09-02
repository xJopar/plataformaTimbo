-- AlterTable
ALTER TABLE "access_profiles" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "application_permissions" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "applications" ALTER COLUMN "updated_at" DROP DEFAULT;
