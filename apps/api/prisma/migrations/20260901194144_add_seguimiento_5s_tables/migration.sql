-- CreateEnum
CREATE TYPE "five_s_indicator_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "five_s_entry_value" AS ENUM ('MET', 'NOT_MET', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "five_s_indicators" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "controlled_since" DATE NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "status" "five_s_indicator_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deactivated_at" TIMESTAMPTZ(6),

    CONSTRAINT "five_s_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "five_s_daily_entries" (
    "id" UUID NOT NULL,
    "entry_date" DATE NOT NULL,
    "user_id" UUID NOT NULL,
    "indicator_id" UUID NOT NULL,
    "value" "five_s_entry_value" NOT NULL,
    "recorded_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "five_s_daily_entries_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraint
ALTER TABLE "five_s_indicators" ADD CONSTRAINT "five_s_indicators_key_check" CHECK (
    "key" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND LENGTH("key") <= 64
);

-- AddCheckConstraint
ALTER TABLE "five_s_indicators" ADD CONSTRAINT "five_s_indicators_name_check" CHECK (
    BTRIM("name") <> '' AND LENGTH("name") <= 120
);

-- AddCheckConstraint
ALTER TABLE "five_s_indicators" ADD CONSTRAINT "five_s_indicators_display_order_check" CHECK (
    "display_order" >= 0
);

-- AddCheckConstraint
ALTER TABLE "five_s_indicators" ADD CONSTRAINT "five_s_indicators_status_coherence_check" CHECK (
    ("status" = 'ACTIVE' AND "deactivated_at" IS NULL)
    OR ("status" = 'INACTIVE' AND "deactivated_at" IS NOT NULL)
);

-- CreateIndex
CREATE UNIQUE INDEX "five_s_indicators_key_key" ON "five_s_indicators"("key");

-- CreateIndex
CREATE INDEX "five_s_indicators_status_display_order_name_idx" ON "five_s_indicators"("status", "display_order", "name");

-- CreateIndex
CREATE INDEX "five_s_daily_entries_entry_date_idx" ON "five_s_daily_entries"("entry_date");

-- CreateIndex
CREATE INDEX "five_s_daily_entries_user_id_entry_date_idx" ON "five_s_daily_entries"("user_id", "entry_date");

-- CreateIndex
CREATE UNIQUE INDEX "five_s_daily_entries_entry_date_user_id_indicator_id_key" ON "five_s_daily_entries"("entry_date", "user_id", "indicator_id");

-- AddForeignKey
ALTER TABLE "five_s_daily_entries" ADD CONSTRAINT "five_s_daily_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "five_s_daily_entries" ADD CONSTRAINT "five_s_daily_entries_indicator_id_fkey" FOREIGN KEY ("indicator_id") REFERENCES "five_s_indicators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "five_s_daily_entries" ADD CONSTRAINT "five_s_daily_entries_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
