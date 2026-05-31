-- Add source column to leads (default 'form' for existing rows)
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'form';
CREATE INDEX IF NOT EXISTS "leads_source_idx" ON "leads"("source");

-- Add subject column to email_logs
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "subject" TEXT;
