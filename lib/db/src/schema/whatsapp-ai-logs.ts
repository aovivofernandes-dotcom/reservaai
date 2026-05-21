import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";

export const aiResponseStatusEnum = pgEnum("ai_response_status", [
  "answered_by_ai",
  "waiting_human",
  "error",
]);

export const whatsappAiLogsTable = pgTable("whatsapp_ai_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  clientPhone: text("client_phone").notNull(),
  clientName: text("client_name").notNull().default(""),
  userMessage: text("user_message").notNull(),
  aiReply: text("ai_reply"),
  status: aiResponseStatusEnum("status").notNull().default("answered_by_ai"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type WhatsappAiLog = typeof whatsappAiLogsTable.$inferSelect;
