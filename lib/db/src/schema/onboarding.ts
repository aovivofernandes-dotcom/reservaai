import { pgTable, text, uuid, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const onboardingStatusEnum = pgEnum("onboarding_status", [
  "pending",
  "reviewed",
  "approved",
  "rejected",
]);

export const onboardingSubmissionsTable = pgTable("onboarding_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  businessName: text("business_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  address: text("address"),
  industry: text("industry"),
  notes: text("notes"),
  status: onboardingStatusEnum("status").notNull().default("pending"),
  extraData: jsonb("extra_data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertOnboardingSubmissionSchema = createInsertSchema(
  onboardingSubmissionsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOnboardingSubmission = z.infer<
  typeof insertOnboardingSubmissionSchema
>;
export type OnboardingSubmission =
  typeof onboardingSubmissionsTable.$inferSelect;
