import { pgTable, text, uuid, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const sessionStatusEnum = pgEnum("session_status", [
  "active",
  "completed",
  "abandoned",
]);

export const messageDirectionEnum = pgEnum("message_direction", [
  "inbound",
  "outbound",
]);

export const whatsappSessionsTable = pgTable("whatsapp_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenantsTable.id, {
    onDelete: "set null",
  }),
  phone: text("phone").notNull(),
  status: sessionStatusEnum("status").notNull().default("active"),
  flowStep: text("flow_step").notNull().default("welcome"),
  sessionData: jsonb("session_data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const whatsappMessagesTable = pgTable("whatsapp_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => whatsappSessionsTable.id, { onDelete: "cascade" }),
  direction: messageDirectionEnum("direction").notNull(),
  content: text("content").notNull(),
  messageType: text("message_type").notNull().default("text"),
  whatsappMessageId: text("whatsapp_message_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWhatsappSessionSchema = createInsertSchema(
  whatsappSessionsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWhatsappMessageSchema = createInsertSchema(
  whatsappMessagesTable,
).omit({
  id: true,
  createdAt: true,
});

export type InsertWhatsappSession = z.infer<typeof insertWhatsappSessionSchema>;
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;
export type WhatsappSession = typeof whatsappSessionsTable.$inferSelect;
export type WhatsappMessage = typeof whatsappMessagesTable.$inferSelect;
