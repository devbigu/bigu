ALTER TABLE "bigu_app"."projects"
ADD COLUMN "project_type" VARCHAR(120),
ADD COLUMN "growth_objective" TEXT,
ADD COLUMN "platforms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "start_date" DATE,
ADD COLUMN "end_date" DATE,
ADD COLUMN "assigned_user_id" TEXT,
ADD COLUMN "content_target" INTEGER;

ALTER TABLE "bigu_app"."conversations"
ADD COLUMN "project_id" TEXT;

ALTER TABLE "bigu_app"."context_change_requests"
ADD COLUMN "project_id" TEXT;

ALTER TABLE "bigu_app"."client_instructions"
ADD COLUMN "project_id" TEXT;

ALTER TABLE "bigu_app"."client_files"
ADD COLUMN "project_id" TEXT;

DROP INDEX "bigu_app"."conversations_client_id_is_primary_key";

CREATE UNIQUE INDEX "conversations_project_id_key"
ON "bigu_app"."conversations"("project_id");

CREATE INDEX "projects_assigned_user_id_idx"
ON "bigu_app"."projects"("assigned_user_id");

CREATE INDEX "context_change_requests_project_id_status_idx"
ON "bigu_app"."context_change_requests"("project_id", "status");

CREATE INDEX "client_instructions_project_id_status_idx"
ON "bigu_app"."client_instructions"("project_id", "status");

CREATE INDEX "client_files_project_id_processing_status_idx"
ON "bigu_app"."client_files"("project_id", "processing_status");

ALTER TABLE "bigu_app"."projects"
ADD CONSTRAINT "projects_assigned_user_id_fkey"
FOREIGN KEY ("assigned_user_id") REFERENCES "bigu_app"."User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bigu_app"."conversations"
ADD CONSTRAINT "conversations_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "bigu_app"."projects"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bigu_app"."context_change_requests"
ADD CONSTRAINT "context_change_requests_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "bigu_app"."projects"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bigu_app"."client_instructions"
ADD CONSTRAINT "client_instructions_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "bigu_app"."projects"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bigu_app"."client_files"
ADD CONSTRAINT "client_files_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "bigu_app"."projects"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
