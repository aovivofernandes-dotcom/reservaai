import { Router, type IRouter } from "express";
import { eq, count, sum, and, gte, lt, desc } from "drizzle-orm";
import {
  db,
  subscriptionsTable,
  paymentEventsTable,
  type PaymentEvent,
} from "@workspace/db";
import { GetRevenueAnalyticsResponse } from "@workspace/api-zod";
import { requireAdmin } from "../../middlewares/auth";

const router: IRouter = Router();

const PLAN_MONTHLY_PRICES: Record<string, number> = {
  pro: 97,
  premium: 197,
};

function toPaymentEventResponse(e: PaymentEvent) {
  return {
    id: e.id,
    tenantId: e.tenantId,
    subscriptionId: e.subscriptionId ?? null,
    mercadoPagoPaymentId: e.mercadoPagoPaymentId ?? null,
    status: e.status,
    paymentMethod: e.paymentMethod ?? null,
    amount: String(e.amount),
    currency: e.currency,
    description: e.description ?? null,
    createdAt: e.createdAt.toISOString(),
  };
}

router.get(
  "/admin/revenue",
  requireAdmin,
  async (_req, res): Promise<void> => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [
      activeSubs,
      trialingSubs,
      pastDueSubs,
    ] = await Promise.all([
      db
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.status, "active")),
      db
        .select({ value: count() })
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.status, "trialing")),
      db
        .select({ value: count() })
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.status, "past_due")),
    ]);

    // Compute MRR from active subscriptions
    let mrr = 0;
    for (const sub of activeSubs) {
      const planPrice = PLAN_MONTHLY_PRICES[sub.plan] ?? (sub.amount ? parseFloat(sub.amount) : 0);
      if (sub.billingCycle === "yearly") {
        mrr += planPrice / 12;
      } else {
        mrr += planPrice;
      }
    }
    const arr = mrr * 12;

    // Cancelled this month
    const [cancelledRow] = await db
      .select({ value: count() })
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.status, "cancelled"),
          gte(subscriptionsTable.cancelledAt, startOfMonth),
          lt(subscriptionsTable.cancelledAt, startOfNextMonth),
        ),
      );

    // Total revenue from approved payments
    const [totalRevenueRow] = await db
      .select({ value: sum(paymentEventsTable.amount) })
      .from(paymentEventsTable)
      .where(eq(paymentEventsTable.status, "approved"));

    // Failed payments count
    const [failedRow] = await db
      .select({ value: count() })
      .from(paymentEventsTable)
      .where(eq(paymentEventsTable.status, "rejected"));

    // Recent payments (last 20)
    const recentPayments = await db
      .select()
      .from(paymentEventsTable)
      .orderBy(desc(paymentEventsTable.createdAt))
      .limit(20);

    res.json(
      GetRevenueAnalyticsResponse.parse({
        mrr: Math.round(mrr * 100) / 100,
        arr: Math.round(arr * 100) / 100,
        activeSubscriptions: activeSubs.length,
        trialingSubscriptions: trialingSubs[0]?.value ?? 0,
        pastDueSubscriptions: pastDueSubs[0]?.value ?? 0,
        cancelledThisMonth: cancelledRow?.value ?? 0,
        totalRevenue: parseFloat(String(totalRevenueRow?.value ?? 0)),
        failedPaymentsCount: failedRow?.value ?? 0,
        recentPayments: recentPayments.map(toPaymentEventResponse),
      }),
    );
  },
);

export default router;
