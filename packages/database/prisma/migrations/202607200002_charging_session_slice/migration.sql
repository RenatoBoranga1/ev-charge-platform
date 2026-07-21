-- Charging-session lifecycle required by the simulator vertical slice.
ALTER TYPE "ChargingSessionStatus" RENAME TO "ChargingSessionStatus_legacy";
CREATE TYPE "ChargingSessionStatus" AS ENUM (
  'PENDING',
  'AUTHORIZED',
  'STARTING',
  'CHARGING',
  'STOPPING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

ALTER TABLE "charging_sessions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "charging_sessions"
  ALTER COLUMN "status" TYPE "ChargingSessionStatus"
  USING (
    CASE "status"::text
      WHEN 'PREPARING' THEN 'PENDING'
      WHEN 'VEHICLE_SUSPENDED' THEN 'CHARGING'
      WHEN 'CHARGER_SUSPENDED' THEN 'CHARGING'
      WHEN 'FINISHING' THEN 'STOPPING'
      ELSE "status"::text
    END
  )::"ChargingSessionStatus";
ALTER TABLE "charging_sessions" ALTER COLUMN "status" SET DEFAULT 'PENDING';
DROP TYPE "ChargingSessionStatus_legacy";

ALTER TABLE "charging_sessions" RENAME COLUMN "ended_at" TO "stopped_at";
ALTER TABLE "charging_sessions"
  ADD COLUMN "station_id" UUID,
  ADD COLUMN "charge_point_id" UUID,
  ADD COLUMN "evse_id" UUID,
  ADD COLUMN "meter_start_wh" BIGINT,
  ADD COLUMN "meter_stop_wh" BIGINT,
  ADD COLUMN "completed_at" TIMESTAMP(3),
  ADD COLUMN "failure_reason" TEXT,
  ADD COLUMN "tariff_snapshot" JSONB,
  ADD COLUMN "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE "charging_sessions" AS session
SET
  "evse_id" = connector."evse_id",
  "charge_point_id" = evse."charge_point_id",
  "station_id" = charge_point."station_id",
  "tariff_snapshot" = jsonb_build_object(
    'currency', tariff."currency",
    'pricePerKwh', tariff."price_per_kwh",
    'activationFee', tariff."activation_fee",
    'parkingFeeHour', tariff."parking_fee_hour",
    'initialBatteryPercent', 30
  )
FROM "connectors" AS connector
JOIN "evses" AS evse ON evse."id" = connector."evse_id"
JOIN "charge_points" AS charge_point ON charge_point."id" = evse."charge_point_id",
"tariffs" AS tariff
WHERE connector."id" = session."connector_id"
  AND tariff."id" = session."tariff_id";

ALTER TABLE "charging_sessions"
  ALTER COLUMN "station_id" SET NOT NULL,
  ALTER COLUMN "charge_point_id" SET NOT NULL,
  ALTER COLUMN "evse_id" SET NOT NULL,
  ALTER COLUMN "tariff_snapshot" SET NOT NULL;

ALTER TABLE "meter_values" ADD COLUMN "meter_wh" BIGINT;
UPDATE "meter_values" SET "meter_wh" = ROUND("energy_kwh" * 1000)::BIGINT;
ALTER TABLE "meter_values" ALTER COLUMN "meter_wh" SET NOT NULL;

ALTER TABLE "charging_sessions"
  ADD CONSTRAINT "charging_sessions_station_id_fkey"
    FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "charging_sessions_charge_point_id_fkey"
    FOREIGN KEY ("charge_point_id") REFERENCES "charge_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "charging_sessions_evse_id_fkey"
    FOREIGN KEY ("evse_id") REFERENCES "evses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "charging_sessions_energy_nonnegative" CHECK ("energy_kwh" >= 0),
  ADD CONSTRAINT "charging_sessions_amount_nonnegative" CHECK ("total_amount" >= 0),
  ADD CONSTRAINT "charging_sessions_meter_order" CHECK (
    "meter_stop_wh" IS NULL OR "meter_start_wh" IS NULL OR "meter_stop_wh" >= "meter_start_wh"
  ),
  ADD CONSTRAINT "charging_sessions_timestamp_order" CHECK (
    ("stopped_at" IS NULL OR "started_at" IS NULL OR "stopped_at" >= "started_at")
    AND ("completed_at" IS NULL OR "stopped_at" IS NULL OR "completed_at" >= "stopped_at")
  );

CREATE UNIQUE INDEX "charging_sessions_connector_active_key"
  ON "charging_sessions"("connector_id")
  WHERE "deleted_at" IS NULL
    AND "status" IN ('PENDING', 'AUTHORIZED', 'STARTING', 'CHARGING', 'STOPPING');
CREATE INDEX "charging_sessions_station_id_status_created_at_idx"
  ON "charging_sessions"("station_id", "status", "created_at");
CREATE INDEX "charging_sessions_vehicle_id_created_at_idx"
  ON "charging_sessions"("vehicle_id", "created_at");
ALTER TABLE "meter_values"
  ADD CONSTRAINT "meter_values_meter_nonnegative" CHECK ("meter_wh" >= 0);
