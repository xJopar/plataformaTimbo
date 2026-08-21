-- CreateTable
CREATE TABLE "usage_events" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "app_key" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "visit_id" UUID NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "request_id" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usage_events_event_id_key" ON "usage_events"("event_id");

-- CreateIndex
CREATE INDEX "usage_events_expires_at_idx" ON "usage_events"("expires_at");

-- CreateIndex
CREATE INDEX "usage_events_occurred_at_idx" ON "usage_events"("occurred_at");

-- CreateIndex
CREATE INDEX "usage_events_actor_user_id_occurred_at_idx" ON "usage_events"("actor_user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "usage_events_app_key_occurred_at_idx" ON "usage_events"("app_key", "occurred_at");

-- CreateIndex
CREATE INDEX "usage_events_event_name_occurred_at_idx" ON "usage_events"("event_name", "occurred_at");

-- CreateIndex
CREATE INDEX "usage_events_visit_id_occurred_at_idx" ON "usage_events"("visit_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_expires_after_occurred_check" CHECK (
    "expires_at" > "occurred_at"
);

-- AddCheckConstraint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_required_text_check" CHECK (
    BTRIM("app_key") <> '' AND BTRIM("event_name") <> '' AND BTRIM("request_id") <> ''
);

-- AddCheckConstraint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_target_coherence_check" CHECK (
    ("target_type" IS NULL AND "target_id" IS NULL)
    OR ("target_type" IS NOT NULL AND "target_id" IS NOT NULL AND BTRIM("target_type") <> '' AND BTRIM("target_id") <> '')
);

-- AddCheckConstraint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_metadata_object_check" CHECK (
    JSONB_TYPEOF("metadata") = 'object'
);

-- AddCheckConstraint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_metadata_size_check" CHECK (
    pg_column_size("metadata") <= 4096
);
