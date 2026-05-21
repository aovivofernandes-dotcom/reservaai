import {
  pgTable,
  text,
  uuid,
  timestamp,
  pgEnum,
  numeric,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "cancelled",
  "expired",
  "trialing",
  "past_due",
  "paused",
]);

export const billingCycleEnum = pgEnum("billing_cycle", ["monthly", "yearly"]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "credit_card",
  "pix",
  "boleto",
]);

export const subscriptionsTable = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  plan: text("plan").notNull(),
  status: subscriptionStatusEnum("status").notNull().default("trialing"),
  billingCycle: billingCycleEnum("billing_cycle").notNull().default("monthly"),
  amount: text("amount"),
  currency: text("currency").notNull().default("BRL"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  mercadoPagoSubscriptionId: text("mercadopago_subscription_id"),
  mercadoPagoPayerId: text("mercadopago_payer_id"),
  mercadoPagoPreapprovalId: text("mercadopago_preapproval_id"),
  paymentMethod: paymentMethodEnum("payment_method"),
  lastPaymentAt: timestamp("last_payment_at"),
  nextBillingAt: timestamp("next_billing_at"),
  failedPaymentsCount: integer("failed_payments_count").notNull().default(0),
  cancelledAt: timestamp("cancelled_at"),
  cancelReason: text("cancel_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const paymentEventStatusEnum = pgEnum("payment_event_status", [
  "approved",
  "pending",
  "in_process",
  "rejected",
  "cancelled",
  "refunded",
  "charged_back",
]);

export const paymentEventsTable = pgTable("payment_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  subscriptionId: uuid("subscription_id").references(
    () => subscriptionsTable.id,
    { onDelete: "set null" },
  ),
  mercadoPagoPaymentId: text("mercadopago_payment_id"),
  mercadoPagoOrderId: text("mercadopago_order_id"),
  status: paymentEventStatusEnum("status").notNull(),
  paymentMethod: paymentMethodEnum("payment_method"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("BRL"),
  description: text("description"),
  rawPayload: text("raw_payload"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSubscriptionSchema = createInsertSchema(
  subscriptionsTable,
).omit({
  id: true,
  createdAt: true,
});

export const insertPaymentEventSchema = createInsertSchema(
  paymentEventsTable,
).omit({
  id: true,
  createdAt: true,
});

export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptionsTable.$inferSelect;
export type InsertPaymentEvent = z.infer<typeof insertPaymentEventSchema>;
export type PaymentEvent = typeof paymentEventsTable.$inferSelect;
