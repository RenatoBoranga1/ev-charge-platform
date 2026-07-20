-- PostGIS is required before creating the geography column.
CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('DRIVER', 'OPERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('BEV', 'PHEV');

-- CreateEnum
CREATE TYPE "StationStatus" AS ENUM ('AVAILABLE', 'PARTIAL', 'OCCUPIED', 'RESERVED', 'OFFLINE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "ConnectorStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'OFFLINE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "PlugType" AS ENUM ('CCS2', 'TYPE_2', 'CHADEMO', 'GB_T');

-- CreateEnum
CREATE TYPE "CurrentType" AS ENUM ('AC', 'DC');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('CONFIRMED', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ChargingSessionStatus" AS ENUM ('PREPARING', 'STARTING', 'CHARGING', 'VEHICLE_SUSPENDED', 'CHARGER_SUSPENDED', 'FINISHING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'DRIVER',
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "total_energy_kwh" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "avoided_co2_kg" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "estimated_savings" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by_token_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "trim" TEXT,
    "year" INTEGER,
    "license_plate" TEXT,
    "vehicle_type" "VehicleType" NOT NULL,
    "battery_capacity_kwh" DECIMAL(8,2) NOT NULL,
    "estimated_range_km" INTEGER,
    "average_consumption_kwh_per_100_km" DECIMAL(8,2),
    "supported_plug_types" "PlugType"[],
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operators" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "operators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "operator_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'BR',
    "postal_code" TEXT,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "location" geography(Point, 4326),
    "status" "StationStatus" NOT NULL DEFAULT 'AVAILABLE',
    "opening_hours" TEXT NOT NULL DEFAULT 'Aberta 24 horas',
    "is_open_24_hours" BOOLEAN NOT NULL DEFAULT true,
    "has_parking" BOOLEAN NOT NULL DEFAULT false,
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charge_points" (
    "id" UUID NOT NULL,
    "station_id" UUID NOT NULL,
    "external_code" TEXT NOT NULL,
    "name" TEXT,
    "status" "StationStatus" NOT NULL DEFAULT 'AVAILABLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "charge_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evses" (
    "id" UUID NOT NULL,
    "charge_point_id" UUID NOT NULL,
    "uid" TEXT NOT NULL,
    "status" "ConnectorStatus" NOT NULL DEFAULT 'AVAILABLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "evses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connectors" (
    "id" UUID NOT NULL,
    "evse_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "plug_type" "PlugType" NOT NULL,
    "current_type" "CurrentType" NOT NULL,
    "maximum_power_kw" DECIMAL(8,2) NOT NULL,
    "status" "ConnectorStatus" NOT NULL DEFAULT 'AVAILABLE',
    "external_identifier" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tariffs" (
    "id" UUID NOT NULL,
    "station_id" UUID NOT NULL,
    "operator_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "price_per_kwh" DECIMAL(10,4) NOT NULL,
    "activation_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "parking_fee_hour" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tariffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "station_id" UUID NOT NULL,
    "connector_id" UUID NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charging_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "connector_id" UUID NOT NULL,
    "tariff_id" UUID NOT NULL,
    "idempotency_key" TEXT,
    "status" "ChargingSessionStatus" NOT NULL DEFAULT 'PREPARING',
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "energy_kwh" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "current_power_kw" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "estimated_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "charging_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meter_values" (
    "id" UUID NOT NULL,
    "charging_session_id" UUID NOT NULL,
    "sampled_at" TIMESTAMP(3) NOT NULL,
    "energy_kwh" DECIMAL(12,3) NOT NULL,
    "power_kw" DECIMAL(8,2),
    "battery_percent" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meter_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "charging_session_id" UUID,
    "idempotency_key" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_reference" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "correlation_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_deleted_at_idx" ON "tenants"("deleted_at");

-- CreateIndex
CREATE INDEX "users_tenant_id_deleted_at_idx" ON "users"("tenant_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_replaced_by_token_id_key" ON "refresh_tokens"("replaced_by_token_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_family_id_idx" ON "refresh_tokens"("user_id", "family_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_revoked_at_idx" ON "refresh_tokens"("expires_at", "revoked_at");

-- CreateIndex
CREATE INDEX "vehicles_user_id_deleted_at_idx" ON "vehicles"("user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "vehicles_user_id_is_default_idx" ON "vehicles"("user_id", "is_default");

-- CreateIndex
CREATE INDEX "operators_tenant_id_deleted_at_idx" ON "operators"("tenant_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "operators_tenant_id_code_key" ON "operators"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "stations_tenant_id_status_deleted_at_idx" ON "stations"("tenant_id", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "stations_operator_id_idx" ON "stations"("operator_id");

-- CreateIndex
CREATE INDEX "charge_points_station_id_deleted_at_idx" ON "charge_points"("station_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "charge_points_station_id_external_code_key" ON "charge_points"("station_id", "external_code");

-- CreateIndex
CREATE INDEX "evses_charge_point_id_deleted_at_idx" ON "evses"("charge_point_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "evses_charge_point_id_uid_key" ON "evses"("charge_point_id", "uid");

-- CreateIndex
CREATE UNIQUE INDEX "connectors_code_key" ON "connectors"("code");

-- CreateIndex
CREATE INDEX "connectors_evse_id_status_deleted_at_idx" ON "connectors"("evse_id", "status", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "connectors_evse_id_number_key" ON "connectors"("evse_id", "number");

-- CreateIndex
CREATE INDEX "tariffs_station_id_valid_from_valid_until_idx" ON "tariffs"("station_id", "valid_from", "valid_until");

-- CreateIndex
CREATE INDEX "tariffs_operator_id_deleted_at_idx" ON "tariffs"("operator_id", "deleted_at");

-- CreateIndex
CREATE INDEX "reservations_user_id_status_starts_at_idx" ON "reservations"("user_id", "status", "starts_at");

-- CreateIndex
CREATE INDEX "reservations_connector_id_starts_at_expires_at_idx" ON "reservations"("connector_id", "starts_at", "expires_at");

-- CreateIndex
CREATE INDEX "charging_sessions_user_id_status_created_at_idx" ON "charging_sessions"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "charging_sessions_connector_id_status_idx" ON "charging_sessions"("connector_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "charging_sessions_user_id_idempotency_key_key" ON "charging_sessions"("user_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "meter_values_charging_session_id_sampled_at_idx" ON "meter_values"("charging_session_id", "sampled_at");

-- CreateIndex
CREATE UNIQUE INDEX "meter_values_charging_session_id_sampled_at_key" ON "meter_values"("charging_session_id", "sampled_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_idempotency_key_key" ON "payment_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "payment_transactions_user_id_status_created_at_idx" ON "payment_transactions"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "payment_transactions_charging_session_id_idx" ON "payment_transactions"("charging_session_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_entity_type_entity_id_created_at_idx" ON "audit_logs"("tenant_id", "entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_correlation_id_idx" ON "audit_logs"("correlation_id");

-- CreateIndex
CREATE INDEX "outbox_events_status_occurred_at_idx" ON "outbox_events"("status", "occurred_at");

-- CreateIndex
CREATE INDEX "outbox_events_tenant_id_aggregate_type_aggregate_id_idx" ON "outbox_events"("tenant_id", "aggregate_type", "aggregate_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_replaced_by_token_id_fkey" FOREIGN KEY ("replaced_by_token_id") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operators" ADD CONSTRAINT "operators_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stations" ADD CONSTRAINT "stations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stations" ADD CONSTRAINT "stations_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge_points" ADD CONSTRAINT "charge_points_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evses" ADD CONSTRAINT "evses_charge_point_id_fkey" FOREIGN KEY ("charge_point_id") REFERENCES "charge_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connectors" ADD CONSTRAINT "connectors_evse_id_fkey" FOREIGN KEY ("evse_id") REFERENCES "evses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tariffs" ADD CONSTRAINT "tariffs_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tariffs" ADD CONSTRAINT "tariffs_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_connector_id_fkey" FOREIGN KEY ("connector_id") REFERENCES "connectors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charging_sessions" ADD CONSTRAINT "charging_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charging_sessions" ADD CONSTRAINT "charging_sessions_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charging_sessions" ADD CONSTRAINT "charging_sessions_connector_id_fkey" FOREIGN KEY ("connector_id") REFERENCES "connectors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charging_sessions" ADD CONSTRAINT "charging_sessions_tariff_id_fkey" FOREIGN KEY ("tariff_id") REFERENCES "tariffs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meter_values" ADD CONSTRAINT "meter_values_charging_session_id_fkey" FOREIGN KEY ("charging_session_id") REFERENCES "charging_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_charging_session_id_fkey" FOREIGN KEY ("charging_session_id") REFERENCES "charging_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain constraints and geospatial index maintained outside Prisma.
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_version_positive" CHECK ("version" > 0);
ALTER TABLE "users" ADD CONSTRAINT "users_version_positive" CHECK ("version" > 0);
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_battery_positive" CHECK ("battery_capacity_kwh" > 0);
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_version_positive" CHECK ("version" > 0);
ALTER TABLE "stations" ADD CONSTRAINT "stations_latitude_range" CHECK ("latitude" BETWEEN -90 AND 90);
ALTER TABLE "stations" ADD CONSTRAINT "stations_longitude_range" CHECK ("longitude" BETWEEN -180 AND 180);
ALTER TABLE "stations" ADD CONSTRAINT "stations_version_positive" CHECK ("version" > 0);
ALTER TABLE "charge_points" ADD CONSTRAINT "charge_points_version_positive" CHECK ("version" > 0);
ALTER TABLE "evses" ADD CONSTRAINT "evses_version_positive" CHECK ("version" > 0);
ALTER TABLE "connectors" ADD CONSTRAINT "connectors_number_positive" CHECK ("number" > 0);
ALTER TABLE "connectors" ADD CONSTRAINT "connectors_power_positive" CHECK ("maximum_power_kw" > 0);
ALTER TABLE "connectors" ADD CONSTRAINT "connectors_version_positive" CHECK ("version" > 0);
ALTER TABLE "tariffs" ADD CONSTRAINT "tariffs_prices_nonnegative" CHECK ("price_per_kwh" >= 0 AND "activation_fee" >= 0 AND "parking_fee_hour" >= 0);
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_valid_window" CHECK ("expires_at" > "starts_at");
ALTER TABLE "meter_values" ADD CONSTRAINT "meter_values_battery_range" CHECK ("battery_percent" IS NULL OR "battery_percent" BETWEEN 0 AND 100);
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_amount_nonnegative" CHECK ("amount" >= 0);
CREATE INDEX "stations_location_gist_idx" ON "stations" USING GIST ("location");
