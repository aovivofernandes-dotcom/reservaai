import { Router, type IRouter } from "express";
import { eq, count, desc, and, inArray } from "drizzle-orm";
import {
  db,
  tenantsTable,
  subscriptionsTable,
  onboardingSubmissionsTable,
  whatsappSessionsTable,
  whatsappMessagesTable,
  usersTable,
  type Tenant,
} from "@workspace/db";
import {
  GetTenantAnalyticsParams,
  GetAdminAnalyticsResponse,
  GetTenantAnalyticsResponse,
  GetSignupAnalyticsResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../../middlewares/auth";

const router: IRouter = Router();

function toTenantResponse(t: Tenant) {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    subdomain: t.subdomain,
    email: t.email,
    phone: t.phone ?? null,
    plan: t.plan,
    status: t.status,
    whatsappPhoneNumberId: t.whatsappPhoneNumberId ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

router.get(
  "/admin/analytics",
  requireAdmin,
  async (_req, res): Promise<void> => {
    const [[totalTenantsRow], [activeTenantsRow]] = await Promise.all([
      db.select({ value: count() }).from(tenantsTable),
      db
        .select({ value: count() })
        .from(tenantsTable)
        .where(eq(tenantsTable.status, "active")),
    ]);

    const [[totalSubsRow], [activeSubsRow]] = await Promise.all([
      db.select({ value: count() }).from(subscriptionsTable),
      db
        .select({ value: count() })
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.status, "active")),
    ]);

    const [[totalOnboardingRow], [pendingOnboardingRow]] = await Promise.all([
      db.select({ value: count() }).from(onboardingSubmissionsTable),
      db
        .select({ value: count() })
        .from(onboardingSubmissionsTable)
        .where(eq(onboardingSubmissionsTable.status, "pending")),
    ]);

    const [totalWaRow] = await db
      .select({ value: count() })
      .from(whatsappSessionsTable);

    const recentTenants = await db
      .select()
      .from(tenantsTable)
      .orderBy(desc(tenantsTable.createdAt))
      .limit(5);

    const analytics = {
      totalTenants: totalTenantsRow?.value ?? 0,
      activeTenants: activeTenantsRow?.value ?? 0,
      totalSubscriptions: totalSubsRow?.value ?? 0,
      activeSubscriptions: activeSubsRow?.value ?? 0,
      totalOnboardingSubmissions: totalOnboardingRow?.value ?? 0,
      pendingOnboardingSubmissions: pendingOnboardingRow?.value ?? 0,
      totalWhatsappSessions: totalWaRow?.value ?? 0,
      recentTenants: recentTenants.map(toTenantResponse),
    };

    res.json(GetAdminAnalyticsResponse.parse(analytics));
  },
);

router.get(
  "/admin/tenants/:tenantId/analytics",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = GetTenantAnalyticsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [tenant] = await db
      .select({ id: tenantsTable.id })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, params.data.tenantId));

    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    const [
      [onboardingCountRow],
      [pendingRow],
      [approvedRow],
      [sessionCountRow],
    ] = await Promise.all([
      db
        .select({ value: count() })
        .from(onboardingSubmissionsTable)
        .where(eq(onboardingSubmissionsTable.tenantId, params.data.tenantId)),
      db
        .select({ value: count() })
        .from(onboardingSubmissionsTable)
        .where(
          and(
            eq(onboardingSubmissionsTable.tenantId, params.data.tenantId),
            eq(onboardingSubmissionsTable.status, "pending"),
          ),
        ),
      db
        .select({ value: count() })
        .from(onboardingSubmissionsTable)
        .where(
          and(
            eq(onboardingSubmissionsTable.tenantId, params.data.tenantId),
            eq(onboardingSubmissionsTable.status, "approved"),
          ),
        ),
      db
        .select({ value: count() })
        .from(whatsappSessionsTable)
        .where(eq(whatsappSessionsTable.tenantId, params.data.tenantId)),
    ]);

    const sessions = await db
      .select({ id: whatsappSessionsTable.id })
      .from(whatsappSessionsTable)
      .where(eq(whatsappSessionsTable.tenantId, params.data.tenantId));

    let messageCount = 0;
    if (sessions.length > 0) {
      const [msgRow] = await db
        .select({ value: count() })
        .from(whatsappMessagesTable);
      messageCount = msgRow?.value ?? 0;
    }

    res.json(
      GetTenantAnalyticsResponse.parse({
        tenantId: params.data.tenantId,
        onboardingCount: onboardingCountRow?.value ?? 0,
        whatsappSessionCount: sessionCountRow?.value ?? 0,
        whatsappMessageCount: messageCount,
        pendingSubmissions: pendingRow?.value ?? 0,
        approvedSubmissions: approvedRow?.value ?? 0,
      }),
    );
  },
);

router.get(
  "/admin/signup-analytics",
  requireAdmin,
  async (_req, res): Promise<void> => {
    const [[totalSignupsRow], [trialCountRow], [activeCountRow]] =
      await Promise.all([
        db.select({ value: count() }).from(usersTable),
        db
          .select({ value: count() })
          .from(subscriptionsTable)
          .where(eq(subscriptionsTable.status, "trialing")),
        db
          .select({ value: count() })
          .from(subscriptionsTable)
          .where(eq(subscriptionsTable.status, "active")),
      ]);

    const totalSignups = totalSignupsRow?.value ?? 0;
    const trialCount = trialCountRow?.value ?? 0;
    const activeCount = activeCountRow?.value ?? 0;
    const conversionRate =
      totalSignups > 0 ? activeCount / totalSignups : 0;

    const recentTenants = await db
      .select()
      .from(tenantsTable)
      .orderBy(desc(tenantsTable.createdAt))
      .limit(20);

    // Fetch latest subscription for each tenant in one query
    const tenantIds = recentTenants.map((t) => t.id);
    const subs =
      tenantIds.length > 0
        ? await db
            .select({
              tenantId: subscriptionsTable.tenantId,
              status: subscriptionsTable.status,
              createdAt: subscriptionsTable.createdAt,
            })
            .from(subscriptionsTable)
            .where(inArray(subscriptionsTable.tenantId, tenantIds))
        : [];

    // Map each tenant to its latest subscription status
    const latestSubByTenant: Record<string, string> = {};
    for (const sub of subs) {
      const existing = latestSubByTenant[sub.tenantId];
      if (!existing) {
        latestSubByTenant[sub.tenantId] = sub.status;
      }
    }

    const recentSignups = recentTenants.map((t) => ({
      id: t.id,
      name: t.name,
      email: t.email,
      businessType: t.businessType ?? null,
      plan: t.plan,
      status: t.status,
      trialEndsAt: t.trialEndsAt?.toISOString() ?? null,
      onboardingStep: t.onboardingStep ?? null,
      whatsappConnected: !!t.whatsappPhoneNumberId,
      subscriptionStatus: latestSubByTenant[t.id] ?? null,
      createdAt: t.createdAt.toISOString(),
    }));

    res.json(
      GetSignupAnalyticsResponse.parse({
        totalSignups,
        trialCount,
        activeCount,
        conversionRate,
        recentSignups,
      }),
    );
  },
);

export default router;
