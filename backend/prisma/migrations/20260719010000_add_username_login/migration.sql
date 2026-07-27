-- Add a nullable username first so existing rows can be backfilled safely.
ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- Existing users predate username login. Give each a deterministic, unique,
-- valid username that does not depend on email formatting.
UPDATE "User"
SET "username" = 'user_' || left(replace("id", '-', ''), 24)
WHERE "username" IS NULL;

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX "User_username_idx" ON "User"("username");
