-- CreateEnum
CREATE TYPE "audit_actor_type" AS ENUM ('USER', 'SYSTEM', 'ANONYMOUS');

-- CreateEnum
CREATE TYPE "audit_outcome" AS ENUM ('SUCCESS', 'DENIED', 'FAILURE');

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "actor_type" "audit_actor_type" NOT NULL,
    "system_actor_key" TEXT,
    "app_key" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "outcome" "audit_outcome" NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "request_id" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_coherence_check" CHECK (
    ("actor_type" = 'USER' AND "actor_user_id" IS NOT NULL AND "system_actor_key" IS NULL)
    OR ("actor_type" = 'SYSTEM' AND "actor_user_id" IS NULL AND "system_actor_key" IS NOT NULL AND BTRIM("system_actor_key") <> '')
    OR ("actor_type" = 'ANONYMOUS' AND "actor_user_id" IS NULL AND "system_actor_key" IS NULL)
);

-- AddCheckConstraint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_expires_after_occurred_check" CHECK (
    "expires_at" > "occurred_at"
);

-- AddCheckConstraint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_required_text_check" CHECK (
    BTRIM("app_key") <> '' AND BTRIM("event_name") <> '' AND BTRIM("request_id") <> ''
);

-- AddCheckConstraint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_target_coherence_check" CHECK (
    ("target_type" IS NULL AND "target_id" IS NULL)
    OR ("target_type" IS NOT NULL AND "target_id" IS NOT NULL AND BTRIM("target_type") <> '' AND BTRIM("target_id") <> '')
);

-- AddCheckConstraint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_metadata_object_check" CHECK (
    JSONB_TYPEOF("metadata") = 'object'
);

-- CreateIndex
CREATE INDEX "audit_events_expires_at_idx" ON "audit_events"("expires_at");

-- CreateIndex
CREATE INDEX "audit_events_occurred_at_idx" ON "audit_events"("occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_actor_user_id_occurred_at_idx" ON "audit_events"("actor_user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_app_key_occurred_at_idx" ON "audit_events"("app_key", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_event_name_occurred_at_idx" ON "audit_events"("event_name", "occurred_at");

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
