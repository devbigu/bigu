-- Company-managed users and immediate access revocation.
-- This migration intentionally preserves every User row and every historical
-- foreign-key attribution to User.

ALTER TYPE "bigu_app"."Role" ADD VALUE IF NOT EXISTS 'MANAGER' BEFORE 'STAFF';

CREATE TYPE "bigu_app"."UserStatus" AS ENUM (
  'ACTIVE',
  'SUSPENDED',
  'DEACTIVATED'
);

CREATE TYPE "bigu_app"."UserProvisioningSource" AS ENUM (
  'BOOTSTRAP',
  'ADMIN'
);

CREATE TYPE "bigu_app"."AccountAuditAction" AS ENUM (
  'ADMIN_BOOTSTRAPPED',
  'USER_CREATED',
  'USER_PROFILE_CHANGED',
  'ROLE_CHANGED',
  'DESIGNATION_CHANGED',
  'PASSWORD_RESET',
  'INITIAL_PASSWORD_CHANGED',
  'SESSIONS_REVOKED',
  'USER_SUSPENDED',
  'USER_DEACTIVATED',
  'USER_REACTIVATED',
  'RESPONSIBILITIES_REASSIGNED',
  'LOGIN_SUCCEEDED',
  'LOGIN_FAILED',
  'ADMIN_ACCESS_DENIED',
  'LAST_ADMIN_OPERATION_BLOCKED'
);

ALTER TABLE "bigu_app"."User"
  ADD COLUMN "designation" VARCHAR(160),
  ADD COLUMN "status" "bigu_app"."UserStatus",
  ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_login_at" TIMESTAMP(3),
  ADD COLUMN "password_changed_at" TIMESTAMP(3),
  ADD COLUMN "deactivated_at" TIMESTAMP(3),
  ADD COLUMN "deactivated_by_id" TEXT,
  ADD COLUMN "deactivation_reason" TEXT,
  ADD COLUMN "suspension_reason" TEXT,
  ADD COLUMN "suspension_review_date" DATE,
  ADD COLUMN "created_by_id" TEXT,
  ADD COLUMN "provisioning_source" "bigu_app"."UserProvisioningSource" NOT NULL DEFAULT 'ADMIN';

UPDATE "bigu_app"."User"
SET "status" = CASE
  WHEN "isActive" THEN 'ACTIVE'::"bigu_app"."UserStatus"
  ELSE 'DEACTIVATED'::"bigu_app"."UserStatus"
END;

ALTER TABLE "bigu_app"."User"
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

DROP INDEX IF EXISTS "bigu_app"."User_isActive_idx";
ALTER TABLE "bigu_app"."User" DROP COLUMN "isActive";

CREATE UNIQUE INDEX "User_email_normalized_key"
  ON "bigu_app"."User" (LOWER("email"));
CREATE INDEX "User_status_idx" ON "bigu_app"."User"("status");
CREATE INDEX "User_designation_idx" ON "bigu_app"."User"("designation");
CREATE INDEX "User_created_by_id_idx" ON "bigu_app"."User"("created_by_id");
CREATE INDEX "User_deactivated_by_id_idx" ON "bigu_app"."User"("deactivated_by_id");

ALTER TABLE "bigu_app"."User"
  ADD CONSTRAINT "User_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "bigu_app"."User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "User_deactivated_by_id_fkey"
  FOREIGN KEY ("deactivated_by_id") REFERENCES "bigu_app"."User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "bigu_app"."account_audit_events" (
  "id" TEXT NOT NULL,
  "actor_user_id" TEXT,
  "target_user_id" TEXT,
  "action" "bigu_app"."AccountAuditAction" NOT NULL,
  "old_value" JSONB,
  "new_value" JSONB,
  "reason" TEXT,
  "ip_address" VARCHAR(64),
  "user_agent_summary" VARCHAR(512),
  "actor_name_snapshot" VARCHAR(120),
  "actor_email_snapshot" VARCHAR(255),
  "actor_role_snapshot" "bigu_app"."Role",
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "account_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "account_audit_events_target_user_id_created_at_idx"
  ON "bigu_app"."account_audit_events"("target_user_id", "created_at");
CREATE INDEX "account_audit_events_actor_user_id_created_at_idx"
  ON "bigu_app"."account_audit_events"("actor_user_id", "created_at");
CREATE INDEX "account_audit_events_action_created_at_idx"
  ON "bigu_app"."account_audit_events"("action", "created_at");

ALTER TABLE "bigu_app"."account_audit_events"
  ADD CONSTRAINT "account_audit_events_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "bigu_app"."User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "account_audit_events_target_user_id_fkey"
  FOREIGN KEY ("target_user_id") REFERENCES "bigu_app"."User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
