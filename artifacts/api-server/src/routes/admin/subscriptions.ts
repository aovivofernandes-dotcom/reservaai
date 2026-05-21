import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, subscriptionsTable, type Subscription } from "@workspace/db";
import {
  CreateSubscriptionParams,
  CreateSubscriptionBody,
  ListSubscriptionsResponse,
  UpdateSubscriptionParams,
  UpdateSubscriptionBody,
  UpdateSubscriptionResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../../middlewares/auth";

const router: IRouter = Router();

function toSubscriptionResponse(s: Subscription) {
  return {
    id: s.id,
    tenantId: s.tenantId,
    plan: s.plan,
    status: s.status,
    billingCycle: s.billingCycle,
    amount: s.amount ?? null,
    currency: s.currency,
    startedAt: s.startedAt.toISOString(),
    expiresAt: s.expiresAt?.toISOString() ?? null,
    currentPeriodStart: s.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
    mercadoPagoSubscriptionId: s.mercadoPagoSubscriptionId ?? null,
    paymentMethod: s.paymentMethod ?? null,
    nextBillingAt: s.nextBillingAt?.toISOString() ?? null,
    failedPaymentsCount: s.failedPaymentsCount,
    createdAt: s.createdAt.toISOString(),
  };
}

router.get(
  "/admin/subscriptions",
  requireAdmin,
  async (_req, res): Promise<void> => {
    const subs = await db
      .select()
      .from(subscriptionsTable)
      .orderBy(desc(subscriptionsTable.createdAt));
    res.json(ListSubscriptionsResponse.parse(subs.map(toSubscriptionResponse)));
  },
);

router.post(
  "/admin/tenants/:tenantId/subscriptions",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = CreateSubscriptionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = CreateSubscriptionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [sub] = await db
      .insert(subscriptionsTable)
      .values({
        tenantId: params.data.tenantId,
        plan: parsed.data.plan,
        billingCycle:
          (parsed.data.billingCycle as Subscription["billingCycle"]) ??
          "monthly",
        amount: parsed.data.amount ?? null,
        currency: parsed.data.currency ?? "BRL",
        startedAt: parsed.data.startedAt
          ? new Date(parsed.data.startedAt)
          : new Date(),
        expiresAt: parsed.data.expiresAt
          ? new Date(parsed.data.expiresAt)
          : null,
      })
      .returning();

    req.log.info(
      { subscriptionId: sub.id, tenantId: params.data.tenantId },
      "Subscription created",
    );
    res.status(201).json(toSubscriptionResponse(sub));
  },
);

router.patch(
  "/admin/subscriptions/:subscriptionId",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = UpdateSubscriptionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdateSubscriptionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const updates: Partial<typeof subscriptionsTable.$inferInsert> = {};
    if (parsed.data.plan != null) updates.plan = parsed.data.plan;
    if (parsed.data.status != null)
      updates.status = parsed.data.status as Subscription["status"];
    if (parsed.data.billingCycle != null)
      updates.billingCycle =
        parsed.data.billingCycle as Subscription["billingCycle"];
    if (parsed.data.amount != null) updates.amount = parsed.data.amount;
    if (parsed.data.expiresAt != null)
      updates.expiresAt = new Date(parsed.data.expiresAt);

    const [sub] = await db
      .update(subscriptionsTable)
      .set(updates)
      .where(eq(subscriptionsTable.id, params.data.subscriptionId))
      .returning();

    if (!sub) {
      res.status(404).json({ error: "Subscription not found" });
      return;
    }

    res.json(UpdateSubscriptionResponse.parse(toSubscriptionResponse(sub)));
  },
);

export default router;
