-- Profile and garage extensions are additive to preserve existing API contracts.
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'HEV';
ALTER TYPE "PlugType" ADD VALUE IF NOT EXISTS 'NACS';

CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SOLD');
CREATE TYPE "ProfileTheme" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

ALTER TABLE "users"
  ADD COLUMN "first_name" TEXT,
  ADD COLUMN "last_name" TEXT,
  ADD COLUMN "avatar_url" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "state" TEXT,
  ADD COLUMN "country" TEXT NOT NULL DEFAULT 'BR',
  ADD COLUMN "language" TEXT NOT NULL DEFAULT 'pt-BR',
  ADD COLUMN "theme" "ProfileTheme" NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN "preferences" JSONB,
  ADD COLUMN "notification_preferences" JSONB,
  ADD COLUMN "privacy_preferences" JSONB,
  ADD COLUMN "account_deletion_requested_at" TIMESTAMP(3);

UPDATE "users"
SET
  "first_name" = split_part(trim("name"), ' ', 1),
  "last_name" = NULLIF(
    trim(substr(trim("name"), length(split_part(trim("name"), ' ', 1)) + 1)),
    ''
  )
WHERE "first_name" IS NULL;

ALTER TABLE "vehicles"
  ADD COLUMN "nickname" TEXT,
  ADD COLUMN "color" TEXT,
  ADD COLUMN "vin" TEXT,
  ADD COLUMN "maximum_ac_power_kw" DECIMAL(8,2),
  ADD COLUMN "maximum_dc_power_kw" DECIMAL(8,2),
  ADD COLUMN "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "image_url" TEXT,
  ADD COLUMN "notes" TEXT;

UPDATE "vehicles"
SET "nickname" = concat("brand", ' ', "model")
WHERE "nickname" IS NULL;

ALTER TABLE "vehicles"
  ALTER COLUMN "nickname" SET NOT NULL,
  ALTER COLUMN "nickname" SET DEFAULT 'Meu veículo';

ALTER TABLE "vehicles"
  ADD CONSTRAINT "vehicles_year_check"
    CHECK ("year" IS NULL OR "year" BETWEEN 1886 AND 2100),
  ADD CONSTRAINT "vehicles_battery_capacity_check"
    CHECK ("battery_capacity_kwh" > 0 AND "battery_capacity_kwh" <= 500),
  ADD CONSTRAINT "vehicles_estimated_range_check"
    CHECK ("estimated_range_km" IS NULL OR "estimated_range_km" BETWEEN 0 AND 3000),
  ADD CONSTRAINT "vehicles_consumption_check"
    CHECK (
      "average_consumption_kwh_per_100_km" IS NULL
      OR "average_consumption_kwh_per_100_km" > 0
    ),
  ADD CONSTRAINT "vehicles_maximum_ac_power_check"
    CHECK ("maximum_ac_power_kw" IS NULL OR "maximum_ac_power_kw" > 0),
  ADD CONSTRAINT "vehicles_maximum_dc_power_check"
    CHECK ("maximum_dc_power_kw" IS NULL OR "maximum_dc_power_kw" > 0),
  ADD CONSTRAINT "vehicles_vin_check"
    CHECK ("vin" IS NULL OR length("vin") = 17);

CREATE UNIQUE INDEX "vehicles_one_default_per_user"
  ON "vehicles" ("user_id")
  WHERE "is_default" = true AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX "vehicles_user_active_license_plate_unique"
  ON "vehicles" ("user_id", upper("license_plate"))
  WHERE "license_plate" IS NOT NULL AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX "vehicles_user_active_vin_unique"
  ON "vehicles" ("user_id", upper("vin"))
  WHERE "vin" IS NOT NULL AND "deleted_at" IS NULL;

CREATE INDEX "vehicles_user_status_created_at_idx"
  ON "vehicles" ("user_id", "status", "created_at");

CREATE INDEX "users_account_deletion_requested_at_idx"
  ON "users" ("account_deletion_requested_at")
  WHERE "account_deletion_requested_at" IS NOT NULL;
