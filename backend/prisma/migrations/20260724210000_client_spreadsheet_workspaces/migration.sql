CREATE TYPE "bigu_app"."SpreadsheetProviderType" AS ENUM ('GOOGLE_SHEETS');
CREATE TYPE "bigu_app"."SpreadsheetResourceStatus" AS ENUM ('CREATING', 'ACTIVE', 'FAILED', 'ARCHIVED');
CREATE TYPE "bigu_app"."SpreadsheetSyncStatus" AS ENUM ('PENDING', 'PROCESSING', 'SYNCED', 'FAILED', 'CANCELLED');
CREATE TYPE "bigu_app"."SpreadsheetSyncOperation" AS ENUM ('PROVISION', 'SYNC_CLIENT', 'SYNC_PROJECT');

CREATE TABLE "bigu_app"."spreadsheet_workbooks" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "provider" "bigu_app"."SpreadsheetProviderType" NOT NULL,
  "external_workbook_id" VARCHAR(255),
  "workbook_name" VARCHAR(200) NOT NULL,
  "external_url" VARCHAR(2048),
  "overview_worksheet_id" VARCHAR(255),
  "sync_log_worksheet_id" VARCHAR(255),
  "status" "bigu_app"."SpreadsheetResourceStatus" NOT NULL DEFAULT 'CREATING',
  "active_client_key" TEXT,
  "last_synced_at" TIMESTAMP(3),
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "spreadsheet_workbooks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bigu_app"."project_worksheets" (
  "id" TEXT NOT NULL,
  "workbook_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "external_worksheet_id" VARCHAR(255),
  "worksheet_name" VARCHAR(100) NOT NULL,
  "worksheet_index" INTEGER NOT NULL,
  "status" "bigu_app"."SpreadsheetResourceStatus" NOT NULL DEFAULT 'CREATING',
  "last_synced_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_worksheets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bigu_app"."spreadsheet_sync_jobs" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "project_id" TEXT,
  "workbook_id" TEXT NOT NULL,
  "worksheet_id" TEXT,
  "source_type" VARCHAR(80) NOT NULL,
  "source_id" VARCHAR(255) NOT NULL,
  "operation" "bigu_app"."SpreadsheetSyncOperation" NOT NULL,
  "payload" JSONB,
  "idempotency_key" VARCHAR(255) NOT NULL,
  "status" "bigu_app"."SpreadsheetSyncStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "error_code" VARCHAR(120),
  "error_message" TEXT,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "spreadsheet_sync_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bigu_app"."spreadsheet_row_mappings" (
  "id" TEXT NOT NULL,
  "worksheet_id" TEXT NOT NULL,
  "entity_type" VARCHAR(80) NOT NULL,
  "entity_id" VARCHAR(255) NOT NULL,
  "section" VARCHAR(80) NOT NULL,
  "row_identifier" VARCHAR(80) NOT NULL,
  "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "spreadsheet_row_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "spreadsheet_workbooks_active_client_key_key" ON "bigu_app"."spreadsheet_workbooks"("active_client_key");
CREATE INDEX "spreadsheet_workbooks_client_id_status_idx" ON "bigu_app"."spreadsheet_workbooks"("client_id", "status");
CREATE INDEX "spreadsheet_workbooks_external_workbook_id_idx" ON "bigu_app"."spreadsheet_workbooks"("external_workbook_id");
CREATE UNIQUE INDEX "project_worksheets_project_id_key" ON "bigu_app"."project_worksheets"("project_id");
CREATE UNIQUE INDEX "project_worksheets_workbook_id_worksheet_name_key" ON "bigu_app"."project_worksheets"("workbook_id", "worksheet_name");
CREATE INDEX "project_worksheets_workbook_id_status_idx" ON "bigu_app"."project_worksheets"("workbook_id", "status");
CREATE UNIQUE INDEX "spreadsheet_sync_jobs_idempotency_key_key" ON "bigu_app"."spreadsheet_sync_jobs"("idempotency_key");
CREATE INDEX "spreadsheet_sync_jobs_status_requested_at_idx" ON "bigu_app"."spreadsheet_sync_jobs"("status", "requested_at");
CREATE INDEX "spreadsheet_sync_jobs_client_id_requested_at_idx" ON "bigu_app"."spreadsheet_sync_jobs"("client_id", "requested_at");
CREATE INDEX "spreadsheet_sync_jobs_project_id_requested_at_idx" ON "bigu_app"."spreadsheet_sync_jobs"("project_id", "requested_at");
CREATE UNIQUE INDEX "spreadsheet_row_mappings_worksheet_id_entity_type_entity_id_key" ON "bigu_app"."spreadsheet_row_mappings"("worksheet_id", "entity_type", "entity_id");
CREATE INDEX "spreadsheet_row_mappings_worksheet_id_section_idx" ON "bigu_app"."spreadsheet_row_mappings"("worksheet_id", "section");

ALTER TABLE "bigu_app"."spreadsheet_workbooks"
  ADD CONSTRAINT "spreadsheet_workbooks_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "bigu_app"."clients"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "spreadsheet_workbooks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "bigu_app"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bigu_app"."project_worksheets"
  ADD CONSTRAINT "project_worksheets_workbook_id_fkey" FOREIGN KEY ("workbook_id") REFERENCES "bigu_app"."spreadsheet_workbooks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "project_worksheets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "bigu_app"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bigu_app"."spreadsheet_sync_jobs"
  ADD CONSTRAINT "spreadsheet_sync_jobs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "bigu_app"."clients"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "spreadsheet_sync_jobs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "bigu_app"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "spreadsheet_sync_jobs_workbook_id_fkey" FOREIGN KEY ("workbook_id") REFERENCES "bigu_app"."spreadsheet_workbooks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "spreadsheet_sync_jobs_worksheet_id_fkey" FOREIGN KEY ("worksheet_id") REFERENCES "bigu_app"."project_worksheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bigu_app"."spreadsheet_row_mappings"
  ADD CONSTRAINT "spreadsheet_row_mappings_worksheet_id_fkey" FOREIGN KEY ("worksheet_id") REFERENCES "bigu_app"."project_worksheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
