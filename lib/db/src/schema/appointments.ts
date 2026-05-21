import {
  pgTable,
  text,
  uuid,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { servicesTable } from "./services";

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
]);

export const whatsappNotifStatusEnum = pgEnum("whatsapp_notif_status", [
  "pending",
  "sent",
  "error",
  "not_connected",
]);

export const appointmentsTable = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  serviceId: uuid("service_id").references(() => servicesTable.id, {
    onDelete: "set null",
  }),
  clientName: text("client_name").notNull(),
  clientPhone: text("client_phone").notNull(),
  clientEmail: text("client_email"),
  scheduledAt: timestamp("scheduled_at").notNull(),
  notes: text("notes"),
  status: appointmentStatusEnum("status").notNull().default("pending"),
  whatsappStatus: whatsappNotifStatusEnum("whatsapp_status")
    .notNull()
    .default("pending"),
  reminderSentAt: timestamp("reminder_sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAppointmentSchema = createInsertSchema(
  appointmentsTable,
).omit({
  id: true,
  whatsappStatus: true,
  reminderSentAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointmentsTable.$inferSelect;
