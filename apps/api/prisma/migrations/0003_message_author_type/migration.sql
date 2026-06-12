-- CreateEnum
CREATE TYPE "MessageAuthorType" AS ENUM ('CUSTOMER', 'AGENT', 'BOT', 'SYSTEM');

-- AlterTable
ALTER TABLE "messages" ADD COLUMN "author_type" "MessageAuthorType" NOT NULL DEFAULT 'SYSTEM';

-- Backfill existing rows. Only BLiP has a bot concept: an OUTBOUND message
-- without an attendant name is treated as bot. GLPI/Teams OUTBOUND is always human.
UPDATE "messages"
SET "author_type" = CASE
  WHEN "direction" = 'INBOUND' THEN 'CUSTOMER'::"MessageAuthorType"
  WHEN "direction" = 'OUTBOUND'
       AND COALESCE("metadata"->>'provider', "metadata"->>'source') = 'BLIP'
       AND COALESCE(TRIM("metadata"->>'agentName'), '') = '' THEN 'BOT'::"MessageAuthorType"
  WHEN "direction" = 'OUTBOUND' THEN 'AGENT'::"MessageAuthorType"
  ELSE 'SYSTEM'::"MessageAuthorType"
END;

-- CreateIndex
CREATE INDEX "messages_tenant_id_author_type_idx" ON "messages"("tenant_id", "author_type");
