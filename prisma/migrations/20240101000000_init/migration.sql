-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('STARTER', 'PROFESSIONAL', 'ENTERPRISE');
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED_WON', 'CLOSED_LOST');

-- CreateTable: leads
CREATE TABLE "leads" (
    "id"               TEXT        NOT NULL,
    "business_name"    TEXT        NOT NULL,
    "business_address" TEXT        NOT NULL,
    "contact_name"     TEXT        NOT NULL,
    "phone"            TEXT        NOT NULL,
    "email"            TEXT        NOT NULL,
    "current_provider" TEXT        NOT NULL,
    "interested_plan"  "Plan",
    "employee_count"   INTEGER,
    "comments"         TEXT,
    "status"           "LeadStatus" NOT NULL DEFAULT 'NEW',
    "ip_address"       TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable: admin_users
CREATE TABLE "admin_users" (
    "id"            TEXT         NOT NULL,
    "email"         TEXT         NOT NULL,
    "password_hash" TEXT         NOT NULL,
    "name"          TEXT         NOT NULL,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable: email_logs
CREATE TABLE "email_logs" (
    "id"            TEXT         NOT NULL,
    "lead_id"       TEXT         NOT NULL,
    "type"          TEXT         NOT NULL,
    "recipient"     TEXT         NOT NULL,
    "status"        TEXT         NOT NULL DEFAULT 'sent',
    "error_message" TEXT,
    "sent_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "leads_status_idx"          ON "leads"("status");
CREATE INDEX "leads_created_at_idx"      ON "leads"("created_at");
CREATE INDEX "leads_interested_plan_idx" ON "leads"("interested_plan");
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");
CREATE INDEX "email_logs_lead_id_idx"    ON "email_logs"("lead_id");

-- Foreign key
ALTER TABLE "email_logs"
    ADD CONSTRAINT "email_logs_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
