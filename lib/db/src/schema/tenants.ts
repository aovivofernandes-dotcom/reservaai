import { pgTable, text, uuid, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tenantStatusEnum = pgEnum("tenant_status", [
  "active",
  "inactive",
  "suspended",
]);

export const tenantPlanEnum = pgEnum("tenant_plan", [
  "free",
  "starter",
  "pro",
  "enterprise",
]);

export const tenantOnboardingStepEnum = pgEnum("tenant_onboarding_step", [
  "profile",
  "whatsapp",
  "launch",
  "complete",
]);

export const tenantsTable = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  subdomain: text("subdomain").notNull().unique(),
  email: text("email").notNull(),
  phone: text("phone"),
  plan: tenantPlanEnum("plan").notNull().default("free"),
  status: tenantStatusEnum("status").notNull().default("active"),
  whatsappPhoneNumberId: text("whatsapp_phone_number_id"),
  whatsappAccessToken: text("whatsapp_access_token"),
  whatsappAccountId: text("whatsapp_account_id"),
  whatsappPhoneNumber: text("whatsapp_phone_number"),
  whatsappConnectedAt: timestamp("whatsapp_connected_at"),
  whatsappProfileName: text("whatsapp_profile_name"),
  whatsappProfilePhoto: text("whatsapp_profile_photo"),
  automationsEnabled: boolean("automations_enabled").notNull().default(false),
  businessType: text("business_type"),
  description: text("description"),
  address: text("address"),
  city: text("city"),
  instagram: text("instagram"),
  website: text("website"),
  logoUrl: text("logo_url"),
  openingHours: text("opening_hours"),
  preferences: text("preferences"),
  trialEndsAt: timestamp("trial_ends_at"),
  onboardingStep: tenantOnboardingStepEnum("onboarding_step")
    .notNull()
    .default("profile"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTenantSchema = createInsertSchema(tenantsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenantsTable.$inferSelect;
