-- Auth hardening
ALTER TABLE "admin_users"
  ADD COLUMN IF NOT EXISTS "token_version" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id"            TEXT NOT NULL,
  "admin_user_id" TEXT NOT NULL,
  "token_hash"    TEXT NOT NULL,
  "expires_at"    TIMESTAMP(3) NOT NULL,
  "used_at"       TIMESTAMP(3),
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_hash_key"
  ON "password_reset_tokens"("token_hash");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_admin_user_id_idx"
  ON "password_reset_tokens"("admin_user_id");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_expires_at_idx"
  ON "password_reset_tokens"("expires_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'password_reset_tokens_admin_user_id_fkey'
  ) THEN
    ALTER TABLE "password_reset_tokens"
      ADD CONSTRAINT "password_reset_tokens_admin_user_id_fkey"
      FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Search performance for existing ILIKE/contains filters.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "leads_business_name_trgm_idx"
  ON "leads" USING GIN ("business_name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "leads_contact_name_trgm_idx"
  ON "leads" USING GIN ("contact_name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "leads_email_trgm_idx"
  ON "leads" USING GIN ("email" gin_trgm_ops);
