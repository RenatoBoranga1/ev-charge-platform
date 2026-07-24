-- Minimal OCPP 1.6J adapter persistence. Protocol details stay outside the charging domain.
CREATE TYPE "ChargerProtocol" AS ENUM ('SIMULATOR', 'OCPP16');
CREATE TYPE "ChargePointConnectionStatus" AS ENUM ('DISCONNECTED', 'CONNECTED');
CREATE TYPE "OcppTransactionStatus" AS ENUM (
  'REMOTE_START_PENDING',
  'ACTIVE',
  'STOPPING',
  'COMPLETED',
  'FAILED'
);
CREATE TYPE "OcppMessageDirection" AS ENUM ('CHARGE_POINT_TO_CSMS', 'CSMS_TO_CHARGE_POINT');

ALTER TABLE "charge_points"
  ADD COLUMN "protocol" "ChargerProtocol" NOT NULL DEFAULT 'SIMULATOR',
  ADD COLUMN "ocpp_identity" TEXT,
  ADD COLUMN "ocpp_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ocpp_auth_secret_hash" TEXT,
  ADD COLUMN "connection_status" "ChargePointConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
  ADD COLUMN "last_seen_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "charge_points_ocpp_identity_key" ON "charge_points"("ocpp_identity");
CREATE INDEX "charge_points_protocol_connection_status_idx"
  ON "charge_points"("protocol", "connection_status")
  WHERE "deleted_at" IS NULL;

CREATE TABLE "ocpp_transactions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "charge_point_id" UUID NOT NULL,
  "connector_id" UUID NOT NULL,
  "charging_session_id" UUID NOT NULL,
  "protocol_transaction_id" SERIAL NOT NULL,
  "authorization_token_hash" TEXT NOT NULL,
  "status" "OcppTransactionStatus" NOT NULL DEFAULT 'REMOTE_START_PENDING',
  "meter_start_wh" BIGINT,
  "last_meter_wh" BIGINT,
  "meter_stop_wh" BIGINT,
  "started_at" TIMESTAMP(3),
  "stopped_at" TIMESTAMP(3),
  "failure_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "ocpp_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ocpp_transactions_charge_point_id_fkey"
    FOREIGN KEY ("charge_point_id") REFERENCES "charge_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ocpp_transactions_connector_id_fkey"
    FOREIGN KEY ("connector_id") REFERENCES "connectors"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ocpp_transactions_charging_session_id_fkey"
    FOREIGN KEY ("charging_session_id") REFERENCES "charging_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ocpp_transactions_meter_nonnegative" CHECK (
    ("meter_start_wh" IS NULL OR "meter_start_wh" >= 0)
    AND ("last_meter_wh" IS NULL OR "last_meter_wh" >= 0)
    AND ("meter_stop_wh" IS NULL OR "meter_stop_wh" >= 0)
  ),
  CONSTRAINT "ocpp_transactions_meter_monotonic" CHECK (
    ("last_meter_wh" IS NULL OR "meter_start_wh" IS NULL OR "last_meter_wh" >= "meter_start_wh")
    AND ("meter_stop_wh" IS NULL OR "meter_start_wh" IS NULL OR "meter_stop_wh" >= "meter_start_wh")
  )
);

CREATE UNIQUE INDEX "ocpp_transactions_charging_session_id_key"
  ON "ocpp_transactions"("charging_session_id");
CREATE UNIQUE INDEX "ocpp_transactions_protocol_transaction_id_key"
  ON "ocpp_transactions"("protocol_transaction_id");
CREATE INDEX "ocpp_transactions_charge_point_id_status_idx"
  ON "ocpp_transactions"("charge_point_id", "status");
CREATE INDEX "ocpp_transactions_connector_id_status_idx"
  ON "ocpp_transactions"("connector_id", "status");
CREATE INDEX "ocpp_transactions_authorization_token_hash_status_idx"
  ON "ocpp_transactions"("authorization_token_hash", "status");

CREATE TABLE "ocpp_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "charge_point_id" UUID NOT NULL,
  "direction" "OcppMessageDirection" NOT NULL,
  "unique_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "response" JSONB,
  "correlation_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ocpp_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ocpp_messages_charge_point_id_fkey"
    FOREIGN KEY ("charge_point_id") REFERENCES "charge_points"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ocpp_messages_charge_point_id_direction_unique_id_key"
  ON "ocpp_messages"("charge_point_id", "direction", "unique_id");
CREATE INDEX "ocpp_messages_charge_point_id_created_at_idx"
  ON "ocpp_messages"("charge_point_id", "created_at");