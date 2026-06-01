CREATE INDEX IF NOT EXISTS "leads_created_at_id_idx"
  ON "leads"("created_at" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "leads_status_created_at_id_idx"
  ON "leads"("status", "created_at" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "leads_source_created_at_id_idx"
  ON "leads"("source", "created_at" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "leads_interested_plan_created_at_id_idx"
  ON "leads"("interested_plan", "created_at" DESC, "id" DESC);
