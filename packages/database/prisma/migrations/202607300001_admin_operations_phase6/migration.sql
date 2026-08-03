CREATE TYPE "OperatorMembershipStatus" AS ENUM (
  'ACTIVE',
  'INVITED',
  'DISABLED'
);

CREATE TYPE "OperatorRole" AS ENUM (
  'TENANT_ADMIN',
  'OPERATIONS_MANAGER',
  'STATION_OPERATOR',
  'FINANCE_ANALYST',
  'SUPPORT_AGENT',
  'VIEWER'
);

CREATE TYPE "TariffPublicationStatus" AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED'
);

CREATE TYPE "RemoteCommandType" AS ENUM (
  'REMOTE_START',
  'REMOTE_STOP',
  'RESET',
  'UNLOCK_CONNECTOR',
  'CHANGE_AVAILABILITY',
  'GET_CONFIGURATION'
);

CREATE TYPE "RemoteCommandStatus" AS ENUM (
  'CREATED',
  'QUEUED',
  'SENT',
  'ACCEPTED',
  'REJECTED',
  'TIMED_OUT',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'DENIED', 'FAILED');

ALTER TABLE "users"
  ADD COLUMN "blocked_at" TIMESTAMP(3),
  ADD COLUMN "blocked_reason" TEXT,
  ADD COLUMN "is_blocked" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "tariffs"
  ADD COLUMN "archived_at" TIMESTAMP(3),
  ADD COLUMN "publication_status" "TariffPublicationStatus" NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN "published_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "audit_logs"
  ADD COLUMN "actor_type" TEXT NOT NULL DEFAULT 'USER',
  ADD COLUMN "ip_address" TEXT,
  ADD COLUMN "justification" TEXT,
  ADD COLUMN "outcome" "AuditOutcome" NOT NULL DEFAULT 'SUCCESS',
  ADD COLUMN "result" JSONB,
  ADD COLUMN "user_agent" TEXT;

CREATE TABLE "operator_memberships" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "user_id" UUID,
  "email" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "status" "OperatorMembershipStatus" NOT NULL DEFAULT 'INVITED',
  "invitation_token_hash" TEXT,
  "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "invitation_expires_at" TIMESTAMP(3),
  "accepted_at" TIMESTAMP(3),
  "disabled_at" TIMESTAMP(3),
  "disabled_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "operator_memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "operator_role_assignments" (
  "id" UUID NOT NULL,
  "membership_id" UUID NOT NULL,
  "role" "OperatorRole" NOT NULL,
  "assigned_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "operator_role_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tariff_versions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "tariff_id" UUID NOT NULL,
  "version_number" INTEGER NOT NULL,
  "status" "TariffPublicationStatus" NOT NULL,
  "snapshot" JSONB NOT NULL,
  "effective_at" TIMESTAMP(3) NOT NULL,
  "published_at" TIMESTAMP(3),
  "archived_at" TIMESTAMP(3),
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tariff_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "remote_commands" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "station_id" UUID,
  "charge_point_id" UUID,
  "connector_id" UUID,
  "charging_session_id" UUID,
  "created_by_user_id" UUID NOT NULL,
  "type" "RemoteCommandType" NOT NULL,
  "status" "RemoteCommandStatus" NOT NULL DEFAULT 'CREATED',
  "idempotency_key" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "payload" JSONB,
  "result" JSONB,
  "error_code" TEXT,
  "error_message" TEXT,
  "correlation_id" TEXT NOT NULL,
  "timeout_at" TIMESTAMP(3) NOT NULL,
  "queued_at" TIMESTAMP(3),
  "sent_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "remote_commands_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "operator_memberships_invitation_token_hash_key"
  ON "operator_memberships"("invitation_token_hash");
CREATE INDEX "operator_memberships_tenant_id_status_deleted_at_idx"
  ON "operator_memberships"("tenant_id", "status", "deleted_at");
CREATE UNIQUE INDEX "operator_memberships_tenant_id_email_key"
  ON "operator_memberships"("tenant_id", "email");
CREATE UNIQUE INDEX "operator_memberships_tenant_id_user_id_key"
  ON "operator_memberships"("tenant_id", "user_id");
CREATE INDEX "operator_role_assignments_role_created_at_idx"
  ON "operator_role_assignments"("role", "created_at");
CREATE UNIQUE INDEX "operator_role_assignments_membership_id_role_key"
  ON "operator_role_assignments"("membership_id", "role");
CREATE INDEX "tariff_versions_tenant_id_status_effective_at_idx"
  ON "tariff_versions"("tenant_id", "status", "effective_at");
CREATE UNIQUE INDEX "tariff_versions_tariff_id_version_number_key"
  ON "tariff_versions"("tariff_id", "version_number");
CREATE INDEX "remote_commands_tenant_id_status_created_at_idx"
  ON "remote_commands"("tenant_id", "status", "created_at");
CREATE INDEX "remote_commands_charge_point_id_status_created_at_idx"
  ON "remote_commands"("charge_point_id", "status", "created_at");
CREATE INDEX "remote_commands_charging_session_id_created_at_idx"
  ON "remote_commands"("charging_session_id", "created_at");
CREATE UNIQUE INDEX "remote_commands_tenant_id_idempotency_key_key"
  ON "remote_commands"("tenant_id", "idempotency_key");

ALTER TABLE "operator_memberships"
  ADD CONSTRAINT "operator_memberships_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operator_memberships"
  ADD CONSTRAINT "operator_memberships_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "operator_role_assignments"
  ADD CONSTRAINT "operator_role_assignments_membership_id_fkey"
  FOREIGN KEY ("membership_id") REFERENCES "operator_memberships"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tariff_versions"
  ADD CONSTRAINT "tariff_versions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tariff_versions"
  ADD CONSTRAINT "tariff_versions_tariff_id_fkey"
  FOREIGN KEY ("tariff_id") REFERENCES "tariffs"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "remote_commands"
  ADD CONSTRAINT "remote_commands_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "remote_commands"
  ADD CONSTRAINT "remote_commands_station_id_fkey"
  FOREIGN KEY ("station_id") REFERENCES "stations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "remote_commands"
  ADD CONSTRAINT "remote_commands_charge_point_id_fkey"
  FOREIGN KEY ("charge_point_id") REFERENCES "charge_points"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "remote_commands"
  ADD CONSTRAINT "remote_commands_connector_id_fkey"
  FOREIGN KEY ("connector_id") REFERENCES "connectors"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "remote_commands"
  ADD CONSTRAINT "remote_commands_charging_session_id_fkey"
  FOREIGN KEY ("charging_session_id") REFERENCES "charging_sessions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "remote_commands"
  ADD CONSTRAINT "remote_commands_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
