-- AlterTable
ALTER TABLE "project_sop_states" ALTER COLUMN "active_overrides" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sop_versions" ALTER COLUMN "updated_at" DROP DEFAULT;
