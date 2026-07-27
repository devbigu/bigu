CREATE TYPE "bigu_app"."ProjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

CREATE TABLE "bigu_app"."projects" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "status" "bigu_app"."ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "month" INTEGER,
    "year" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "projects_client_id_status_updated_at_idx"
ON "bigu_app"."projects"("client_id", "status", "updated_at");

ALTER TABLE "bigu_app"."projects"
ADD CONSTRAINT "projects_client_id_fkey"
FOREIGN KEY ("client_id") REFERENCES "bigu_app"."clients"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
