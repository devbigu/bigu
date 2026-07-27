CREATE TYPE "bigu_app"."ThemePreference" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

ALTER TABLE "bigu_app"."User"
ADD COLUMN "avatar_url" VARCHAR(2048),
ADD COLUMN "theme_preference" "bigu_app"."ThemePreference" NOT NULL DEFAULT 'SYSTEM';
