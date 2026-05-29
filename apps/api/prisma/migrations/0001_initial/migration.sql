CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'INVITED');
CREATE TYPE "IntegrationProvider" AS ENUM ('BLIP');
CREATE TYPE "RawEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED');
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'PENDING', 'CLOSED', 'CANCELED');
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'SYSTEM');
CREATE TYPE "AiAnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "tenants" (
  "id" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "key" VARCHAR(80) NOT NULL,
  "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "entra_object_id" VARCHAR(120),
  "email" VARCHAR(180) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "roles" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "description" VARCHAR(240),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_roles" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role_id" UUID NOT NULL,
  "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_configs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "provider" "IntegrationProvider" NOT NULL DEFAULT 'BLIP',
  "name" VARCHAR(120) NOT NULL,
  "tenant_key" VARCHAR(120),
  "external_id" VARCHAR(160),
  "secret_ref" VARCHAR(240),
  "settings" JSONB,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integration_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "raw_events" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "provider" "IntegrationProvider" NOT NULL DEFAULT 'BLIP',
  "provider_event_id" VARCHAR(180),
  "event_type" VARCHAR(120),
  "payload_hash" VARCHAR(64) NOT NULL,
  "payload" JSONB NOT NULL,
  "processing_status" "RawEventStatus" NOT NULL DEFAULT 'PENDING',
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),
  "error_message" TEXT,
  CONSTRAINT "raw_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contacts" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "external_id" VARCHAR(180) NOT NULL,
  "name" VARCHAR(180),
  "phone" VARCHAR(40),
  "email" VARCHAR(180),
  "document" VARCHAR(80),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "queues" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "external_id" VARCHAR(180),
  "name" VARCHAR(160) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "queues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agents" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "external_id" VARCHAR(180),
  "name" VARCHAR(160) NOT NULL,
  "email" VARCHAR(180),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tickets" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "external_id" VARCHAR(180),
  "contact_id" UUID,
  "queue_id" UUID,
  "agent_id" UUID,
  "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
  "channel" VARCHAR(80),
  "subject" VARCHAR(240),
  "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_at" TIMESTAMP(3),
  "first_response_at" TIMESTAMP(3),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "messages" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "ticket_id" UUID,
  "contact_id" UUID,
  "agent_id" UUID,
  "raw_event_id" UUID,
  "external_id" VARCHAR(180),
  "direction" "MessageDirection" NOT NULL,
  "sender_name" VARCHAR(160),
  "content" TEXT,
  "content_type" VARCHAR(80),
  "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ratings" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "ticket_id" UUID NOT NULL,
  "score" INTEGER NOT NULL,
  "comment" TEXT,
  "rated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tags" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "color" VARCHAR(20),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ticket_tags" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "ticket_id" UUID NOT NULL,
  "tag_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ticket_tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_analysis" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "ticket_id" UUID,
  "contact_id" UUID,
  "status" "AiAnalysisStatus" NOT NULL DEFAULT 'PENDING',
  "topics" JSONB,
  "sentiment" VARCHAR(80),
  "summary" TEXT,
  "risk_flags" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_analysis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "user_id" UUID,
  "action" VARCHAR(120) NOT NULL,
  "entity_type" VARCHAR(120) NOT NULL,
  "entity_id" VARCHAR(120),
  "metadata" JSONB,
  "ip_address" VARCHAR(80),
  "user_agent" VARCHAR(300),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_key_key" ON "tenants"("key");
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");
CREATE UNIQUE INDEX "users_tenant_id_entra_object_id_key" ON "users"("tenant_id", "entra_object_id");
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");
CREATE UNIQUE INDEX "roles_tenant_id_name_key" ON "roles"("tenant_id", "name");
CREATE INDEX "roles_tenant_id_idx" ON "roles"("tenant_id");
CREATE UNIQUE INDEX "user_roles_tenant_id_user_id_role_id_key" ON "user_roles"("tenant_id", "user_id", "role_id");
CREATE INDEX "user_roles_tenant_id_idx" ON "user_roles"("tenant_id");
CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");
CREATE UNIQUE INDEX "integration_configs_tenant_id_provider_name_key" ON "integration_configs"("tenant_id", "provider", "name");
CREATE INDEX "integration_configs_tenant_id_idx" ON "integration_configs"("tenant_id");
CREATE UNIQUE INDEX "raw_events_tenant_id_provider_payload_hash_key" ON "raw_events"("tenant_id", "provider", "payload_hash");
CREATE UNIQUE INDEX "raw_events_tenant_id_provider_provider_event_id_key" ON "raw_events"("tenant_id", "provider", "provider_event_id");
CREATE INDEX "raw_events_tenant_id_received_at_idx" ON "raw_events"("tenant_id", "received_at");
CREATE INDEX "raw_events_processing_status_idx" ON "raw_events"("processing_status");
CREATE UNIQUE INDEX "contacts_tenant_id_external_id_key" ON "contacts"("tenant_id", "external_id");
CREATE INDEX "contacts_tenant_id_idx" ON "contacts"("tenant_id");
CREATE UNIQUE INDEX "queues_tenant_id_external_id_key" ON "queues"("tenant_id", "external_id");
CREATE INDEX "queues_tenant_id_idx" ON "queues"("tenant_id");
CREATE UNIQUE INDEX "agents_tenant_id_external_id_key" ON "agents"("tenant_id", "external_id");
CREATE INDEX "agents_tenant_id_idx" ON "agents"("tenant_id");
CREATE UNIQUE INDEX "tickets_tenant_id_external_id_key" ON "tickets"("tenant_id", "external_id");
CREATE INDEX "tickets_tenant_id_opened_at_idx" ON "tickets"("tenant_id", "opened_at");
CREATE INDEX "tickets_tenant_id_status_idx" ON "tickets"("tenant_id", "status");
CREATE INDEX "tickets_contact_id_idx" ON "tickets"("contact_id");
CREATE INDEX "tickets_queue_id_idx" ON "tickets"("queue_id");
CREATE INDEX "tickets_agent_id_idx" ON "tickets"("agent_id");
CREATE UNIQUE INDEX "messages_tenant_id_external_id_key" ON "messages"("tenant_id", "external_id");
CREATE INDEX "messages_tenant_id_sent_at_idx" ON "messages"("tenant_id", "sent_at");
CREATE INDEX "messages_ticket_id_idx" ON "messages"("ticket_id");
CREATE INDEX "messages_contact_id_idx" ON "messages"("contact_id");
CREATE INDEX "messages_agent_id_idx" ON "messages"("agent_id");
CREATE INDEX "messages_raw_event_id_idx" ON "messages"("raw_event_id");
CREATE INDEX "ratings_tenant_id_rated_at_idx" ON "ratings"("tenant_id", "rated_at");
CREATE INDEX "ratings_ticket_id_idx" ON "ratings"("ticket_id");
CREATE UNIQUE INDEX "tags_tenant_id_name_key" ON "tags"("tenant_id", "name");
CREATE INDEX "tags_tenant_id_idx" ON "tags"("tenant_id");
CREATE UNIQUE INDEX "ticket_tags_tenant_id_ticket_id_tag_id_key" ON "ticket_tags"("tenant_id", "ticket_id", "tag_id");
CREATE INDEX "ticket_tags_tenant_id_idx" ON "ticket_tags"("tenant_id");
CREATE INDEX "ticket_tags_ticket_id_idx" ON "ticket_tags"("ticket_id");
CREATE INDEX "ticket_tags_tag_id_idx" ON "ticket_tags"("tag_id");
CREATE INDEX "ai_analysis_tenant_id_created_at_idx" ON "ai_analysis"("tenant_id", "created_at");
CREATE INDEX "ai_analysis_ticket_id_idx" ON "ai_analysis"("ticket_id");
CREATE INDEX "ai_analysis_contact_id_idx" ON "ai_analysis"("contact_id");
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_configs" ADD CONSTRAINT "integration_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "raw_events" ADD CONSTRAINT "raw_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "queues" ADD CONSTRAINT "queues_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agents" ADD CONSTRAINT "agents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_queue_id_fkey" FOREIGN KEY ("queue_id") REFERENCES "queues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_raw_event_id_fkey" FOREIGN KEY ("raw_event_id") REFERENCES "raw_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tags" ADD CONSTRAINT "tags_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_tags" ADD CONSTRAINT "ticket_tags_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_tags" ADD CONSTRAINT "ticket_tags_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_tags" ADD CONSTRAINT "ticket_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_analysis" ADD CONSTRAINT "ai_analysis_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_analysis" ADD CONSTRAINT "ai_analysis_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_analysis" ADD CONSTRAINT "ai_analysis_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
