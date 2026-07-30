-- Phase 5 evolves the existing payment table in place and preserves all rows.
-- CreateEnum
CREATE TYPE "LedgerAccountOwnerType" AS ENUM ('USER', 'PLATFORM', 'OPERATOR');

-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('USER_WALLET_AVAILABLE', 'USER_WALLET_RESERVED', 'PAYMENT_GATEWAY_CLEARING', 'OPERATOR_REVENUE', 'REFUND_CLEARING', 'PAYMENT_FEES', 'RECONCILIATION_CLEARING');

-- CreateEnum
CREATE TYPE "LedgerAccountStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'CLOSED');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "LedgerTransactionType" AS ENUM ('TOP_UP', 'AUTHORIZATION', 'CAPTURE', 'RELEASE', 'REFUND', 'ADJUSTMENT', 'AUTO_RECHARGE', 'REVERSAL');

-- CreateEnum
CREATE TYPE "LedgerTransactionStatus" AS ENUM ('PENDING', 'POSTED', 'REVERSED', 'FAILED');

-- CreateEnum
CREATE TYPE "WalletStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'CLOSED');

-- CreateEnum
CREATE TYPE "WalletReservationStatus" AS ENUM ('RESERVED', 'CAPTURED', 'RELEASED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentIntentType" AS ENUM ('WALLET_TOP_UP', 'CHARGING_AUTHORIZATION', 'CHARGING_CAPTURE', 'AUTO_RECHARGE', 'REFUND');

-- CreateEnum
CREATE TYPE "PaymentIntentStatus" AS ENUM ('CREATED', 'PENDING', 'REQUIRES_ACTION', 'AUTHORIZED', 'PROCESSING', 'CAPTURED', 'CANCELLED', 'EXPIRED', 'FAILED', 'REQUIRES_REVIEW', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('CARD', 'PIX', 'WALLET');

-- CreateEnum
CREATE TYPE "PaymentMethodStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'BLOCKED', 'REMOVED');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('ISSUED', 'PARTIALLY_REFUNDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REQUIRES_REVIEW');

-- CreateEnum
CREATE TYPE "PaymentWebhookProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'DUPLICATE', 'FAILED', 'REQUIRES_REVIEW');

-- CreateEnum
CREATE TYPE "PaymentReconciliationStatus" AS ENUM ('MATCHED', 'MISSING_LOCALLY', 'MISSING_AT_PROVIDER', 'AMOUNT_MISMATCH', 'STATUS_MISMATCH', 'REQUIRES_REVIEW');

-- Evolve PaymentTransaction into PaymentIntent without dropping financial history.
ALTER TABLE "payment_transactions" RENAME TO "payment_intents";
ALTER TABLE "payment_intents" RENAME COLUMN "amount" TO "legacy_amount";
ALTER TABLE "payment_intents" RENAME COLUMN "status" TO "legacy_status";

ALTER TABLE "payment_intents"
  ADD COLUMN "tenant_id" UUID,
  ADD COLUMN "type" "PaymentIntentType" NOT NULL DEFAULT 'WALLET_TOP_UP',
  ADD COLUMN "request_hash" TEXT NOT NULL DEFAULT 'legacy-migration',
  ADD COLUMN "amount_minor" BIGINT,
  ADD COLUMN "authorized_amount_minor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "captured_amount_minor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "refunded_amount_minor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "intent_status" "PaymentIntentStatus" NOT NULL DEFAULT 'CREATED',
  ADD COLUMN "expires_at" TIMESTAMP(3);

UPDATE "payment_intents" AS intent
SET
  "tenant_id" = users."tenant_id",
  "amount_minor" = round(intent."legacy_amount" * 100)::BIGINT,
  "intent_status" = CASE intent."legacy_status"::TEXT
    WHEN 'PENDING' THEN 'PENDING'::"PaymentIntentStatus"
    WHEN 'AUTHORIZED' THEN 'AUTHORIZED'::"PaymentIntentStatus"
    WHEN 'CAPTURED' THEN 'CAPTURED'::"PaymentIntentStatus"
    WHEN 'FAILED' THEN 'FAILED'::"PaymentIntentStatus"
    WHEN 'REFUNDED' THEN 'REFUNDED'::"PaymentIntentStatus"
    WHEN 'CANCELLED' THEN 'CANCELLED'::"PaymentIntentStatus"
    ELSE 'REQUIRES_REVIEW'::"PaymentIntentStatus"
  END
FROM "users"
WHERE users."id" = intent."user_id";

ALTER TABLE "payment_intents"
  ALTER COLUMN "tenant_id" SET NOT NULL,
  ALTER COLUMN "amount_minor" SET NOT NULL,
  DROP COLUMN "legacy_amount",
  DROP COLUMN "legacy_status";

ALTER TABLE "payment_intents" RENAME COLUMN "intent_status" TO "status";

DROP INDEX IF EXISTS "payment_transactions_idempotency_key_key";
DROP INDEX IF EXISTS "payment_transactions_user_id_status_created_at_idx";
DROP INDEX IF EXISTS "payment_transactions_charging_session_id_idx";
DROP TYPE "PaymentStatus";

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "owner_type" "LedgerAccountOwnerType" NOT NULL,
    "owner_id" UUID NOT NULL,
    "account_type" "LedgerAccountType" NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "status" "LedgerAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_transactions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "type" "LedgerTransactionType" NOT NULL,
    "status" "LedgerTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "external_reference" TEXT,
    "description" TEXT NOT NULL,
    "charging_session_id" UUID,
    "payment_intent_id" UUID,
    "metadata" JSONB,
    "reversal_of_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posted_at" TIMESTAMP(3),
    "reversed_at" TIMESTAMP(3),

    CONSTRAINT "ledger_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "available_balance_minor" BIGINT NOT NULL DEFAULT 0,
    "reserved_balance_minor" BIGINT NOT NULL DEFAULT 0,
    "status" "WalletStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_reservations" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "charging_session_id" UUID,
    "payment_intent_id" UUID,
    "amount_minor" BIGINT NOT NULL,
    "captured_minor" BIGINT NOT NULL DEFAULT 0,
    "released_minor" BIGINT NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "status" "WalletReservationStatus" NOT NULL DEFAULT 'RESERVED',
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "wallet_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_token" TEXT NOT NULL,
    "type" "PaymentMethodType" NOT NULL,
    "brand" TEXT,
    "last_four" CHAR(4),
    "expiration_month" INTEGER,
    "expiration_year" INTEGER,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "status" "PaymentMethodStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_policy_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "pre_authorization_amount_minor" BIGINT NOT NULL,
    "minimum_wallet_balance_minor" BIGINT NOT NULL,
    "maximum_session_amount_minor" BIGINT NOT NULL,
    "low_balance_warning_minor" BIGINT NOT NULL,
    "minimum_top_up_amount_minor" BIGINT NOT NULL,
    "maximum_top_up_amount_minor" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "payment_policy_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "charging_session_id" UUID NOT NULL,
    "payment_intent_id" UUID NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'ISSUED',
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "payment_intent_id" UUID NOT NULL,
    "provider_reference" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "reason" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auto_recharge_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "payment_method_id" UUID,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "minimum_balance_minor" BIGINT NOT NULL,
    "recharge_amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "last_triggered_at" TIMESTAMP(3),
    "last_failure_at" TIMESTAMP(3),
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "cooldown_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "auto_recharge_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_webhook_events" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "processing_status" "PaymentWebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "last_error" TEXT,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_reconciliations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "payment_intent_id" UUID NOT NULL,
    "status" "PaymentReconciliationStatus" NOT NULL,
    "provider_status" TEXT,
    "local_status" TEXT NOT NULL,
    "provider_amount_minor" BIGINT,
    "local_amount_minor" BIGINT NOT NULL,
    "details" JSONB,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ledger_accounts_tenant_id_owner_id_status_idx" ON "ledger_accounts"("tenant_id", "owner_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_tenant_id_owner_type_owner_id_account_type__key" ON "ledger_accounts"("tenant_id", "owner_type", "owner_id", "account_type", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_transactions_reversal_of_id_key" ON "ledger_transactions"("reversal_of_id");

-- CreateIndex
CREATE INDEX "ledger_transactions_tenant_id_created_at_id_idx" ON "ledger_transactions"("tenant_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "ledger_transactions_payment_intent_id_idx" ON "ledger_transactions"("payment_intent_id");

-- CreateIndex
CREATE INDEX "ledger_transactions_charging_session_id_idx" ON "ledger_transactions"("charging_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_transactions_tenant_id_idempotency_key_key" ON "ledger_transactions"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "ledger_entries_account_id_created_at_id_idx" ON "ledger_entries"("account_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "ledger_entries_transaction_id_idx" ON "ledger_entries"("transaction_id");

-- CreateIndex
CREATE INDEX "wallets_tenant_id_user_id_status_deleted_at_idx" ON "wallets"("tenant_id", "user_id", "status", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_tenant_id_user_id_currency_key" ON "wallets"("tenant_id", "user_id", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_reservations_charging_session_id_key" ON "wallet_reservations"("charging_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_reservations_payment_intent_id_key" ON "wallet_reservations"("payment_intent_id");

-- CreateIndex
CREATE INDEX "wallet_reservations_wallet_id_status_created_at_idx" ON "wallet_reservations"("wallet_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_reservations_wallet_id_idempotency_key_key" ON "wallet_reservations"("wallet_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "payment_intents_tenant_id_user_id_status_created_at_idx" ON "payment_intents"("tenant_id", "user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "payment_intents_charging_session_id_type_idx" ON "payment_intents"("charging_session_id", "type");

-- CreateIndex
CREATE INDEX "payment_intents_provider_provider_reference_idx" ON "payment_intents"("provider", "provider_reference");

-- CreateIndex
CREATE UNIQUE INDEX "payment_intents_tenant_id_idempotency_key_key" ON "payment_intents"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "payment_methods_tenant_id_user_id_status_deleted_at_idx" ON "payment_methods"("tenant_id", "user_id", "status", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_tenant_id_provider_provider_token_key" ON "payment_methods"("tenant_id", "provider", "provider_token");

-- CreateIndex
CREATE UNIQUE INDEX "payment_policy_configs_tenant_id_currency_key" ON "payment_policy_configs"("tenant_id", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_charging_session_id_key" ON "receipts"("charging_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_payment_intent_id_key" ON "receipts"("payment_intent_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_receipt_number_key" ON "receipts"("receipt_number");

-- CreateIndex
CREATE INDEX "receipts_tenant_id_user_id_issued_at_idx" ON "receipts"("tenant_id", "user_id", "issued_at");

-- CreateIndex
CREATE INDEX "refunds_status_created_at_idx" ON "refunds"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_payment_intent_id_idempotency_key_key" ON "refunds"("payment_intent_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "auto_recharge_rules_enabled_cooldown_until_idx" ON "auto_recharge_rules"("enabled", "cooldown_until");

-- CreateIndex
CREATE UNIQUE INDEX "auto_recharge_rules_tenant_id_user_id_currency_key" ON "auto_recharge_rules"("tenant_id", "user_id", "currency");

-- CreateIndex
CREATE INDEX "payment_webhook_events_processing_status_received_at_idx" ON "payment_webhook_events"("processing_status", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhook_events_provider_provider_event_id_key" ON "payment_webhook_events"("provider", "provider_event_id");

-- CreateIndex
CREATE INDEX "payment_reconciliations_tenant_id_status_checked_at_idx" ON "payment_reconciliations"("tenant_id", "status", "checked_at");

-- CreateIndex
CREATE INDEX "payment_reconciliations_payment_intent_id_checked_at_idx" ON "payment_reconciliations"("payment_intent_id", "checked_at");

-- AddForeignKey
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_reservations" ADD CONSTRAINT "wallet_reservations_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_reservations" ADD CONSTRAINT "wallet_reservations_charging_session_id_fkey" FOREIGN KEY ("charging_session_id") REFERENCES "charging_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_reservations" ADD CONSTRAINT "wallet_reservations_payment_intent_id_fkey" FOREIGN KEY ("payment_intent_id") REFERENCES "payment_intents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_policy_configs" ADD CONSTRAINT "payment_policy_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_charging_session_id_fkey" FOREIGN KEY ("charging_session_id") REFERENCES "charging_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_payment_intent_id_fkey" FOREIGN KEY ("payment_intent_id") REFERENCES "payment_intents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_intent_id_fkey" FOREIGN KEY ("payment_intent_id") REFERENCES "payment_intents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_recharge_rules" ADD CONSTRAINT "auto_recharge_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_recharge_rules" ADD CONSTRAINT "auto_recharge_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_recharge_rules" ADD CONSTRAINT "auto_recharge_rules_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reconciliations" ADD CONSTRAINT "payment_reconciliations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reconciliations" ADD CONSTRAINT "payment_reconciliations_payment_intent_id_fkey" FOREIGN KEY ("payment_intent_id") REFERENCES "payment_intents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ledger_transactions"
  ADD CONSTRAINT "ledger_transactions_charging_session_id_fkey" FOREIGN KEY ("charging_session_id") REFERENCES "charging_sessions"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "ledger_transactions_payment_intent_id_fkey" FOREIGN KEY ("payment_intent_id") REFERENCES "payment_intents"("id") ON DELETE RESTRICT;
ALTER TABLE "ledger_accounts"
  ADD CONSTRAINT "ledger_accounts_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_amount_positive_check" CHECK ("amount_minor" > 0),
  ADD CONSTRAINT "ledger_entries_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "wallets"
  ADD CONSTRAINT "wallets_balances_nonnegative_check" CHECK ("available_balance_minor" >= 0 AND "reserved_balance_minor" >= 0),
  ADD CONSTRAINT "wallets_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "wallet_reservations"
  ADD CONSTRAINT "wallet_reservations_amounts_check" CHECK ("amount_minor" > 0 AND "captured_minor" >= 0 AND "released_minor" >= 0 AND "captured_minor" + "released_minor" <= "amount_minor"),
  ADD CONSTRAINT "wallet_reservations_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "payment_intents"
  ADD CONSTRAINT "payment_intents_amounts_check" CHECK ("amount_minor" >= 0 AND "authorized_amount_minor" >= 0 AND "captured_amount_minor" >= 0 AND "refunded_amount_minor" >= 0 AND "refunded_amount_minor" <= "captured_amount_minor"),
  ADD CONSTRAINT "payment_intents_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "payment_policy_configs"
  ADD CONSTRAINT "payment_policy_amounts_check" CHECK ("pre_authorization_amount_minor" > 0 AND "minimum_wallet_balance_minor" >= 0 AND "maximum_session_amount_minor" >= "pre_authorization_amount_minor" AND "low_balance_warning_minor" >= 0 AND "minimum_top_up_amount_minor" > 0 AND "maximum_top_up_amount_minor" >= "minimum_top_up_amount_minor"),
  ADD CONSTRAINT "payment_policy_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "receipts"
  ADD CONSTRAINT "receipts_amount_check" CHECK ("amount_minor" >= 0),
  ADD CONSTRAINT "receipts_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "refunds"
  ADD CONSTRAINT "refunds_amount_check" CHECK ("amount_minor" > 0),
  ADD CONSTRAINT "refunds_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "auto_recharge_rules"
  ADD CONSTRAINT "auto_recharge_amounts_check" CHECK ("minimum_balance_minor" >= 0 AND "recharge_amount_minor" > 0),
  ADD CONSTRAINT "auto_recharge_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "payment_methods"
  ADD CONSTRAINT "payment_methods_expiration_check" CHECK (("expiration_month" IS NULL AND "expiration_year" IS NULL) OR ("expiration_month" BETWEEN 1 AND 12 AND "expiration_year" BETWEEN 2020 AND 2200)),
  ADD CONSTRAINT "payment_methods_last_four_check" CHECK ("last_four" IS NULL OR "last_four" ~ '^[0-9]{4}$');

CREATE UNIQUE INDEX "payment_methods_one_default_per_user"
  ON "payment_methods" ("tenant_id", "user_id")
  WHERE "is_default" = true AND "deleted_at" IS NULL AND "status" = 'ACTIVE';

CREATE OR REPLACE FUNCTION solis_validate_ledger_posting()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  debit_total BIGINT;
  credit_total BIGINT;
  currency_count INTEGER;
  foreign_account_count INTEGER;
BEGIN
  IF NEW.status = 'POSTED' AND OLD.status <> 'POSTED' THEN
    SELECT
      COALESCE(SUM(CASE WHEN direction = 'DEBIT' THEN amount_minor ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN direction = 'CREDIT' THEN amount_minor ELSE 0 END), 0),
      COUNT(DISTINCT currency)
    INTO debit_total, credit_total, currency_count
    FROM ledger_entries WHERE transaction_id = NEW.id;

    SELECT COUNT(*) INTO foreign_account_count
    FROM ledger_entries AS entry
    JOIN ledger_accounts AS account ON account.id = entry.account_id
    WHERE entry.transaction_id = NEW.id AND account.tenant_id <> NEW.tenant_id;

    IF debit_total <= 0 OR debit_total <> credit_total THEN
      RAISE EXCEPTION 'ledger transaction must be balanced and non-empty';
    END IF;
    IF currency_count <> 1 THEN
      RAISE EXCEPTION 'ledger transaction must use one currency';
    END IF;
    IF foreign_account_count <> 0 THEN
      RAISE EXCEPTION 'ledger transaction cannot cross tenants';
    END IF;
    NEW.posted_at = COALESCE(NEW.posted_at, CURRENT_TIMESTAMP);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ledger_transactions_validate_posting"
BEFORE UPDATE OF "status" ON "ledger_transactions"
FOR EACH ROW EXECUTE FUNCTION solis_validate_ledger_posting();

CREATE OR REPLACE FUNCTION solis_guard_ledger_entry()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ledger_status "LedgerTransactionStatus";
BEGIN
  SELECT status INTO ledger_status FROM ledger_transactions
  WHERE id = COALESCE(OLD.transaction_id, NEW.transaction_id);
  IF TG_OP = 'DELETE' OR ledger_status IN ('POSTED', 'REVERSED') THEN
    RAISE EXCEPTION 'posted ledger entries are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ledger_entries_immutable"
BEFORE UPDATE OR DELETE ON "ledger_entries"
FOR EACH ROW EXECUTE FUNCTION solis_guard_ledger_entry();

CREATE OR REPLACE FUNCTION solis_guard_ledger_transaction_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ledger transactions cannot be deleted';
END;
$$;

CREATE TRIGGER "ledger_transactions_no_delete"
BEFORE DELETE ON "ledger_transactions"
FOR EACH ROW EXECUTE FUNCTION solis_guard_ledger_transaction_delete();
