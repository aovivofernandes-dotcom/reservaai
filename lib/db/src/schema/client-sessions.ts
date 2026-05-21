import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";

export const convStepEnum = pgEnum("conv_step", [
  "cancel_confirm",
  "reschedule_date",
  "reschedule_slot",
  "reschedule_confirm",
]);

export const clientConversationSessionsTable = pgTable(
  "client_conversation_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    clientPhone: text("client_phone").notNull(),
    step: convStepEnum("step").notNull(),
    data: jsonb("data")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
);

export type ClientConversationSession =
  typeof clientConversationSessionsTable.$inferSelect;
