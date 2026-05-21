import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import crypto from "crypto";
import {
  db,
  tenantsTable,
  subscriptionsTable,
  paymentEventsTable,
  type Subscription,
  type PaymentEvent,
} from "@workspace/db";
import {
  CreateMpSubscriptionBody,
  GetBillingStatusResponse,
  GetPaymentHistoryResponse,
  CancelBillingSubscriptionResponse,
  CreateMpSubscriptionResponse,
} from "@workspace/api-zod";
import { requireBusiness } from "../middlewares/business-auth";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Plan config
// ---------------------------------------------------------------------------

const PLAN_PRICES: Record<string, Record<string, number>> = {
  pro: { monthly: 97, yearly: 970 },
  premium: { monthly: 197, yearly: 1970 },
};

const PLAN_NAMES: Record<string, string> = {
  pro: "ReservaAI Pro",
  premium: "ReservaAI Premium",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function buildBillingStatus(sub: Subscription | undefined, trialEndsAt: Date | null) {
  const now = new Date();
  const isTrialing = sub?.status === "trialing";
  const isActive = sub?.status === "active";
  const isPastDue = sub?.status === "past_due";

  let trialDaysLeft: number | null = null;
  if (isTrialing && trialEndsAt) {
    const diff = trialEndsAt.getTime() - now.getTime();
    trialDaysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  const planLocked =
    (!isActive && !isTrialing) ||
    (isTrialing && trialDaysLeft !== null && trialDaysLeft <= 0);

  return {
    subscription: sub ? toSubscriptionResponse(sub) : null,
    trialEndsAt: trialEndsAt?.toISOString() ?? null,
    trialDaysLeft,
    isTrialing,
    isActive,
    isPastDue,
    planLocked,
  };
}

// ---------------------------------------------------------------------------
// GET /billing/status
// ---------------------------------------------------------------------------

router.get(
  "/billing/status",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId } = req.businessUser!;

    const [tenant] = await db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId));

    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    const [sub] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.tenantId, tenantId))
      .orderBy(desc(subscriptionsTable.createdAt))
      .limit(1);

    const status = buildBillingStatus(sub, tenant.trialEndsAt ?? null);
    res.json(GetBillingStatusResponse.parse(status));
  },
);

// ---------------------------------------------------------------------------
// GET /billing/payment-history
// ---------------------------------------------------------------------------

router.get(
  "/billing/payment-history",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId } = req.businessUser!;

    const events = await db
      .select()
      .from(paymentEventsTable)
      .where(eq(paymentEventsTable.tenantId, tenantId))
      .orderBy(desc(paymentEventsTable.createdAt))
      .limit(50);

    res.json(GetPaymentHistoryResponse.parse(events.map(toPaymentEventResponse)));
  },
);

// ---------------------------------------------------------------------------
// POST /billing/create-subscription
// ---------------------------------------------------------------------------

router.post(
  "/billing/create-subscription",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId } = req.businessUser!;

    const parsed = CreateMpSubscriptionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { plan, billingCycle } = parsed.data;
    const amount = PLAN_PRICES[plan]?.[billingCycle] ?? 0;

    const [tenant] = await db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId));

    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

    if (!accessToken) {
      req.log.warn("MERCADOPAGO_ACCESS_TOKEN not set — returning mock init_point");

      // Upsert local subscription record even without MP
      const [sub] = await db
        .insert(subscriptionsTable)
        .values({
          tenantId,
          plan,
          status: "trialing",
          billingCycle: billingCycle as Subscription["billingCycle"],
          amount: String(amount),
          currency: "BRL",
          startedAt: new Date(),
        })
        .onConflictDoNothing()
        .returning();

      res.json(
        CreateMpSubscriptionResponse.parse({
          initPoint: `/billing?plan=${plan}&status=pending_mp_config`,
          subscriptionId: sub?.id ?? tenantId,
          preapprovalId: null,
        }),
      );
      return;
    }

    try {
      const { MercadoPagoConfig, PreApproval } = await import("mercadopago");
      const mpClient = new MercadoPagoConfig({ accessToken });
      const preApprovalApi = new PreApproval(mpClient);

      const origin = process.env.PUBLIC_URL ?? "https://reservaai.replit.app";
      const backUrl = `${origin}/billing?status=success`;

      const frequencyType = billingCycle === "monthly" ? "months" : "years";
      const frequencyValue = 1;

      const payerEmail = tenant.email ?? `tenant-${tenant.id}@reservaai.app`;

      const preapprovalData = await preApprovalApi.create({
        body: {
          reason: `${PLAN_NAMES[plan] ?? plan} - ${billingCycle === "monthly" ? "Mensal" : "Anual"}`,
          auto_recurring: {
            frequency: frequencyValue,
            frequency_type: frequencyType,
            transaction_amount: amount,
            currency_id: "BRL",
          },
          payer_email: payerEmail,
          back_url: backUrl,
          status: "pending",
        },
      });

      const pa0 = preapprovalData as unknown as Record<string, unknown>;
      const initPoint = pa0.init_point as string | undefined;
      const preapprovalId = pa0.id as string | undefined;

      if (!initPoint) {
        req.log.error({ preapprovalData }, "Mercado Pago did not return init_point");
        res.status(502).json({ error: "Mercado Pago não retornou URL de pagamento" });
        return;
      }

      // Create or update subscription record
      const now = new Date();
      const periodEnd =
        billingCycle === "monthly"
          ? new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())
          : new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

      const [sub] = await db
        .insert(subscriptionsTable)
        .values({
          tenantId,
          plan,
          status: "trialing",
          billingCycle: billingCycle as Subscription["billingCycle"],
          amount: String(amount),
          currency: "BRL",
          startedAt: now,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          mercadoPagoPreapprovalId: preapprovalId,
          nextBillingAt: periodEnd,
        })
        .returning();

      req.log.info(
        { tenantId, plan, preapprovalId },
        "MP preapproval created",
      );

      res.json(
        CreateMpSubscriptionResponse.parse({
          initPoint,
          subscriptionId: sub.id,
          preapprovalId: preapprovalId ?? null,
        }),
      );
    } catch (err) {
      req.log.error({ err }, "Mercado Pago create subscription failed — falling back to pending");

      // Graceful degradation: create local pending subscription so the
      // tenant is not left stranded. The payment link will be provided
      // manually by the support team.
      try {
        const now = new Date();
        const periodEnd =
          billingCycle === "monthly"
            ? new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())
            : new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

        const [sub] = await db
          .insert(subscriptionsTable)
          .values({
            tenantId,
            plan,
            status: "trialing",
            billingCycle: billingCycle as Subscription["billingCycle"],
            amount: String(amount),
            currency: "BRL",
            startedAt: now,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          })
          .onConflictDoNothing()
          .returning();

        res.json(
          CreateMpSubscriptionResponse.parse({
            initPoint: `/billing?plan=${plan}&cycle=${billingCycle}&status=pending_payment`,
            subscriptionId: sub?.id ?? tenantId,
            preapprovalId: null,
          }),
        );
      } catch (dbErr) {
        req.log.error({ dbErr }, "Fallback DB insert also failed");
        res.status(503).json({
          error: "Pagamento temporariamente indisponível. Tente novamente em alguns instantes.",
          retryable: true,
        });
      }
    }
  },
);

// ---------------------------------------------------------------------------
// POST /billing/cancel
// ---------------------------------------------------------------------------

router.post(
  "/billing/cancel",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId } = req.businessUser!;

    const [sub] = await db
      .select()
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.tenantId, tenantId),
          eq(subscriptionsTable.status, "active"),
        ),
      )
      .orderBy(desc(subscriptionsTable.createdAt))
      .limit(1);

    if (!sub) {
      // try trialing
      const [trialSub] = await db
        .select()
        .from(subscriptionsTable)
        .where(
          and(
            eq(subscriptionsTable.tenantId, tenantId),
            eq(subscriptionsTable.status, "trialing"),
          ),
        )
        .orderBy(desc(subscriptionsTable.createdAt))
        .limit(1);

      if (!trialSub) {
        res.status(404).json({ error: "No active subscription found" });
        return;
      }

      await db
        .update(subscriptionsTable)
        .set({ status: "cancelled", cancelledAt: new Date() })
        .where(eq(subscriptionsTable.id, trialSub.id));

      const [tenant] = await db
        .select()
        .from(tenantsTable)
        .where(eq(tenantsTable.id, tenantId));

      const updated = { ...trialSub, status: "cancelled" as const, cancelledAt: new Date() };
      const status = buildBillingStatus(updated, tenant?.trialEndsAt ?? null);
      res.json(CancelBillingSubscriptionResponse.parse(status));
      return;
    }

    // Cancel in MP if configured
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (accessToken && sub.mercadoPagoPreapprovalId) {
      try {
        const { MercadoPagoConfig, PreApproval } = await import("mercadopago");
        const mpClient = new MercadoPagoConfig({ accessToken });
        const preApprovalApi = new PreApproval(mpClient);
        await preApprovalApi.update({
          id: sub.mercadoPagoPreapprovalId,
          body: { status: "cancelled" },
        });
      } catch (err) {
        req.log.warn({ err }, "Failed to cancel MP preapproval — continuing with local cancel");
      }
    }

    const [updated] = await db
      .update(subscriptionsTable)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(eq(subscriptionsTable.id, sub.id))
      .returning();

    const [tenant] = await db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId));

    const status = buildBillingStatus(updated, tenant?.trialEndsAt ?? null);
    req.log.info({ tenantId, subscriptionId: sub.id }, "Subscription cancelled");
    res.json(CancelBillingSubscriptionResponse.parse(status));
  },
);

// ---------------------------------------------------------------------------
// POST /billing/webhook  (public — HMAC-verified)
// ---------------------------------------------------------------------------

router.post("/billing/webhook", async (req, res): Promise<void> => {
  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

  // Verify signature if secret is set
  if (webhookSecret) {
    const signature = req.headers["x-signature"] as string | undefined;
    const requestId = req.headers["x-request-id"] as string | undefined;

    if (signature) {
      const parts = signature.split(",");
      const tsEntry = parts.find((p) => p.startsWith("ts="));
      const v1Entry = parts.find((p) => p.startsWith("v1="));
      const ts = tsEntry?.split("=")[1];
      const v1 = v1Entry?.split("=")[1];
      const bodyData = (req.body as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
      const dataId = (req.query["data.id"] as string | undefined) ?? bodyData?.id;

      if (ts && v1 && dataId) {
        const manifest = `id:${dataId};request-id:${requestId ?? ""};ts:${ts};`;
        const expected = crypto
          .createHmac("sha256", webhookSecret)
          .update(manifest)
          .digest("hex");

        if (expected !== v1) {
          req.log.warn({ signature }, "MP webhook signature mismatch");
          res.status(401).json({ error: "Invalid signature" });
          return;
        }
      }
    }
  }

  const body = req.body as Record<string, unknown>;
  const topic = (req.query.topic as string | undefined) ?? (body.type as string | undefined);
  const resourceId = (body.data as Record<string, unknown>)?.id as string | undefined;

  req.log.info({ topic, resourceId }, "MP webhook received");

  // Handle payment notifications
  if (topic === "payment" && resourceId) {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (accessToken) {
      try {
        const { MercadoPagoConfig, Payment } = await import("mercadopago");
        const mpClient = new MercadoPagoConfig({ accessToken });
        const paymentApi = new Payment(mpClient);
        const payment = await paymentApi.get({ id: resourceId });

        const p = payment as unknown as Record<string, unknown>;
        const metadata = (p.metadata as Record<string, string> | undefined) ?? {};
        const externalRef = (p.external_reference as string | undefined) ?? "";

        // Try to match tenant by external_reference (tenantId) or metadata
        const tenantId = metadata.tenant_id ?? externalRef;

        if (tenantId) {
          const [tenant] = await db
            .select()
            .from(tenantsTable)
            .where(eq(tenantsTable.id, tenantId));

          if (tenant) {
            const mpStatus = p.status as string;
            const validStatuses = [
              "approved",
              "pending",
              "in_process",
              "rejected",
              "cancelled",
              "refunded",
              "charged_back",
            ] as const;
            type EventStatus = (typeof validStatuses)[number];
            const eventStatus: EventStatus = validStatuses.includes(mpStatus as EventStatus)
              ? (mpStatus as EventStatus)
              : "pending";

            const transactionAmount = p.transaction_amount as number | undefined;
            const paymentMethodId = p.payment_method_id as string | undefined;
            const paymentTypeId = p.payment_type_id as string | undefined;

            const paymentMethod =
              paymentTypeId === "pix"
                ? ("pix" as const)
                : paymentTypeId === "credit_card" || paymentMethodId
                  ? ("credit_card" as const)
                  : null;

            // Get latest subscription for tenant
            const [sub] = await db
              .select()
              .from(subscriptionsTable)
              .where(eq(subscriptionsTable.tenantId, tenantId))
              .orderBy(desc(subscriptionsTable.createdAt))
              .limit(1);

            // Record payment event
            await db.insert(paymentEventsTable).values({
              tenantId,
              subscriptionId: sub?.id ?? null,
              mercadoPagoPaymentId: String(resourceId),
              status: eventStatus,
              paymentMethod,
              amount: String(transactionAmount ?? 0),
              currency: "BRL",
              description: `Pagamento MP #${resourceId}`,
              rawPayload: JSON.stringify(body),
            });

            // Update subscription status on approved/rejected
            if (sub) {
              if (eventStatus === "approved") {
                const now = new Date();
                const periodEnd =
                  sub.billingCycle === "monthly"
                    ? new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())
                    : new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

                await db
                  .update(subscriptionsTable)
                  .set({
                    status: "active",
                    lastPaymentAt: now,
                    currentPeriodStart: now,
                    currentPeriodEnd: periodEnd,
                    nextBillingAt: periodEnd,
                    failedPaymentsCount: 0,
                    ...(paymentMethod ? { paymentMethod } : {}),
                  })
                  .where(eq(subscriptionsTable.id, sub.id));

                // Update tenant plan
                const plan = sub.plan as "pro" | "premium" | "free" | "starter" | "enterprise";
                const validPlans = ["free", "starter", "pro", "enterprise"] as const;
                type TenantPlan = (typeof validPlans)[number];
                const tenantPlan: TenantPlan = validPlans.includes(plan as TenantPlan)
                  ? (plan as TenantPlan)
                  : "pro";

                await db
                  .update(tenantsTable)
                  .set({ plan: tenantPlan, updatedAt: now })
                  .where(eq(tenantsTable.id, tenantId));

                req.log.info({ tenantId, plan }, "Subscription activated via webhook");
              } else if (eventStatus === "rejected") {
                await db
                  .update(subscriptionsTable)
                  .set({
                    status: "past_due",
                    failedPaymentsCount: (sub.failedPaymentsCount ?? 0) + 1,
                  })
                  .where(eq(subscriptionsTable.id, sub.id));

                req.log.warn({ tenantId, resourceId }, "Payment rejected — marked past_due");
              }
            }
          }
        }
      } catch (err) {
        req.log.error({ err, resourceId }, "Error processing MP webhook payment");
      }
    }
  }

  // Handle preapproval (subscription) notifications
  if ((topic === "preapproval" || topic === "subscription_preapproval") && resourceId) {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (accessToken) {
      try {
        const { MercadoPagoConfig, PreApproval } = await import("mercadopago");
        const mpClient = new MercadoPagoConfig({ accessToken });
        const preApprovalApi = new PreApproval(mpClient);
        const preApproval = await preApprovalApi.get({ id: resourceId });

        const pa = preApproval as unknown as Record<string, unknown>;
        const mpStatus = pa.status as string;

        // Find matching subscription by preapproval id
        const [sub] = await db
          .select()
          .from(subscriptionsTable)
          .where(eq(subscriptionsTable.mercadoPagoPreapprovalId, String(resourceId)))
          .limit(1);

        if (sub) {
          const statusMap: Record<string, Subscription["status"]> = {
            authorized: "active",
            pending: "trialing",
            paused: "paused",
            cancelled: "cancelled",
          };
          const newStatus = statusMap[mpStatus] ?? sub.status;

          await db
            .update(subscriptionsTable)
            .set({ status: newStatus, mercadoPagoSubscriptionId: String(resourceId) })
            .where(eq(subscriptionsTable.id, sub.id));

          req.log.info({ subscriptionId: sub.id, mpStatus, newStatus }, "Preapproval status updated");
        }
      } catch (err) {
        req.log.error({ err, resourceId }, "Error processing MP preapproval webhook");
      }
    }
  }

  res.json({ received: true });
});

export default router;
