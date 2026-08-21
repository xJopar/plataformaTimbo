-- CreateEnum
CREATE TYPE "access_profile_key" AS ENUM ('PLATFORM_ADMIN');

-- CreateTable
CREATE TABLE "access_profiles" (
    "id" UUID NOT NULL,
    "key" "access_profile_key" NOT NULL,

    CONSTRAINT "access_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profile_assignments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_profile_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "access_profiles_key_key" ON "access_profiles"("key");

-- CreateIndex
CREATE INDEX "user_profile_assignments_profile_id_idx" ON "user_profile_assignments"("profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_profile_assignments_user_id_profile_id_key" ON "user_profile_assignments"("user_id", "profile_id");

-- AddForeignKey
ALTER TABLE "user_profile_assignments" ADD CONSTRAINT "user_profile_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profile_assignments" ADD CONSTRAINT "user_profile_assignments_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "access_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
