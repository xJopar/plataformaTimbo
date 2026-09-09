-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "display_name" TEXT,
    "corporate_email" TEXT NOT NULL,
    "google_subject" TEXT,
    "zoho_crm_user_id" TEXT,
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deactivated_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_corporate_email_normalized_check" CHECK (
        btrim("corporate_email") <> ''
        AND "corporate_email" = lower(btrim("corporate_email"))
    ),
    CONSTRAINT "users_status_deactivated_at_check" CHECK (
        ("status" = 'ACTIVE' AND "deactivated_at" IS NULL)
        OR ("status" = 'INACTIVE' AND "deactivated_at" IS NOT NULL)
    ),
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_corporate_email_key" ON "users"("corporate_email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_subject_key" ON "users"("google_subject");

-- CreateIndex
CREATE UNIQUE INDEX "users_zoho_crm_user_id_key" ON "users"("zoho_crm_user_id");
