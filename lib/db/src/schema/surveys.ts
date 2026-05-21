import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { appointmentsTable } from "./appointments";

export const surveyStatusEnum = pgEnum("survey_status", [
  "pending_send",
  "sent",
  "responded",
  "error",
]);

export const satisfactionSurveysTable = pgTable("satisfaction_surveys", {
  id: uuid("id").primaryKey().defaultRandom(),
  appointmentId: uuid("appointment_id")
    .notNull()
    .unique()
    .references(() => appointmentsTable.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  clientName: text("client_name").notNull(),
  clientPhone: text("client_phone").notNull(),
  status: surveyStatusEnum("status").notNull().default("pending_send"),
  sentAt: timestamp("sent_at"),
  rating: integer("rating"),
  comment: text("comment"),
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type SatisfactionSurvey = typeof satisfactionSurveysTable.$inferSelect;
