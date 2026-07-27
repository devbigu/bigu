ALTER TYPE "bigu_app"."MessageStatus" ADD VALUE IF NOT EXISTS 'STREAMING';
ALTER TYPE "bigu_app"."MessageStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "bigu_app"."User"
ADD COLUMN "avatar_public_id" VARCHAR(512),
ADD COLUMN "avatar_resource_type" VARCHAR(20);

ALTER TABLE "bigu_app"."client_files"
ADD COLUMN "storage_provider" VARCHAR(40),
ADD COLUMN "storage_public_id" VARCHAR(512),
ADD COLUMN "storage_resource_type" VARCHAR(20);
