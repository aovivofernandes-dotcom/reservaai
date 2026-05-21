import { Router, type IRouter } from "express";
import { eq, count, desc, and, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  db,
  tenantsTable,
  subscriptionsTable,
  onboardingSubmissionsTable,
  whatsappSessionsTable,
  servicesTable,
  appointmentsTable,
  usersTable,
  platformSettingsTable,
  type Tenant,
} from "@workspace/db";
import { requireBusiness } from "../middlewares/business-auth";

const router: IRouter = Router();

interface QrSession {
  connectCode: string;
  status: "pending" | "connected" | "expired";
  createdAt: Date;
}

const qrStore = new Map<string, QrSession>();

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
    businessType: t.businessType ?? null,
    description: t.description ?? null,
    address: t.address ?? null,
    city: t.city ?? null,
    instagram: t.instagram ?? null,
    website: t.website ?? null,
    logoUrl: t.logoUrl ?? null,
    openingHours: t.openingHours ?? null,
    preferences: t.preferences ?? null,
    trialEndsAt: t.trialEndsAt?.toISOString() ?? null,
    onboardingStep: t.onboardingStep ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

router.get(
  "/business/dashboard",
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

    const [subscription] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.tenantId, tenantId))
      .orderBy(subscriptionsTable.createdAt)
      .limit(1);

    const [[submissionsCountRow], [waCountRow], [apptCountRow], [svcCountRow], recentAppts] =
      await Promise.all([
        db
          .select({ value: count() })
          .from(onboardingSubmissionsTable)
          .where(eq(onboardingSubmissionsTable.tenantId, tenantId)),
        db
          .select({ value: count() })
          .from(whatsappSessionsTable)
          .where(eq(whatsappSessionsTable.tenantId, tenantId)),
        db
          .select({ value: count() })
          .from(appointmentsTable)
          .where(eq(appointmentsTable.tenantId, tenantId)),
        db
          .select({ value: count() })
          .from(servicesTable)
          .where(and(eq(servicesTable.tenantId, tenantId), eq(servicesTable.isActive, true))),
        db
          .select({
            id: appointmentsTable.id,
            clientName: appointmentsTable.clientName,
            clientPhone: appointmentsTable.clientPhone,
            scheduledAt: appointmentsTable.scheduledAt,
            status: appointmentsTable.status,
            createdAt: appointmentsTable.createdAt,
            serviceName: servicesTable.name,
          })
          .from(appointmentsTable)
          .leftJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
          .where(eq(appointmentsTable.tenantId, tenantId))
          .orderBy(desc(appointmentsTable.createdAt))
          .limit(5),
      ]);

    const dashboard = {
      tenant: toTenantResponse(tenant),
      subscription: subscription
        ? {
            id: subscription.id,
            tenantId: subscription.tenantId,
            plan: subscription.plan,
            status: subscription.status,
            billingCycle: subscription.billingCycle,
            amount: subscription.amount ?? null,
            currency: subscription.currency,
            startedAt: subscription.startedAt.toISOString(),
            expiresAt: subscription.expiresAt?.toISOString() ?? null,
            createdAt: subscription.createdAt.toISOString(),
            failedPaymentsCount: subscription.failedPaymentsCount ?? 0,
          }
        : null,
      onboardingStep: tenant.onboardingStep,
      trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
      submissionsCount: submissionsCountRow?.value ?? 0,
      whatsappSessionsCount: waCountRow?.value ?? 0,
    };

    res.json({
      tenant: dashboard.tenant,
      subscription: dashboard.subscription,
      onboardingStep: dashboard.onboardingStep,
      trialEndsAt: dashboard.trialEndsAt,
      submissionsCount: dashboard.submissionsCount,
      whatsappSessionsCount: dashboard.whatsappSessionsCount,
      appointmentsCount: apptCountRow?.value ?? 0,
      servicesCount: svcCountRow?.value ?? 0,
      recentAppointments: recentAppts.map((a) => ({
        id: a.id,
        clientName: a.clientName,
        clientPhone: a.clientPhone,
        scheduledAt: a.scheduledAt.toISOString(),
        status: a.status,
        createdAt: a.createdAt.toISOString(),
        serviceName: a.serviceName ?? null,
      })),
    });
  },
);

router.get(
  "/business/submissions",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId } = req.businessUser!;

    const submissions = await db
      .select()
      .from(onboardingSubmissionsTable)
      .where(eq(onboardingSubmissionsTable.tenantId, tenantId))
      .orderBy(desc(onboardingSubmissionsTable.createdAt))
      .limit(10);

    res.json(
      submissions.map((s) => ({
        id: s.id,
        businessName: s.businessName,
        contactName: s.contactName,
        email: s.email,
        phone: s.phone,
        industry: s.industry ?? null,
        status: s.status,
        createdAt: s.createdAt.toISOString(),
      })),
    );
  },
);

router.post(
  "/business/whatsapp/connect/start",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId } = req.businessUser!;

    const connectCode = `reservaai:connect:${tenantId}:${Date.now()}`;

    const session: QrSession = {
      connectCode,
      status: "pending",
      createdAt: new Date(),
    };
    qrStore.set(tenantId, session);

    setTimeout(() => {
      const s = qrStore.get(tenantId);
      if (s?.status === "pending") {
        s.status = "expired";
      }
    }, 60_000);

    req.log.info({ tenantId }, "WhatsApp QR session started");
    res.json({ connectCode, expiresIn: 60 });
  },
);

router.get(
  "/business/whatsapp/connect/status",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId } = req.businessUser!;

    const [tenant] = await db
      .select({ onboardingStep: tenantsTable.onboardingStep })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId));

    if (tenant?.onboardingStep === "complete") {
      res.json({ status: "connected" });
      return;
    }

    const s = qrStore.get(tenantId);
    res.json({ status: s?.status ?? "no_session" });
  },
);

router.post(
  "/business/whatsapp/connect/confirm",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId } = req.businessUser!;

    const s = qrStore.get(tenantId);
    if (!s || s.status !== "pending") {
      res.status(400).json({ error: "No active QR session" });
      return;
    }

    s.status = "connected";

    await db
      .update(tenantsTable)
      .set({ onboardingStep: "complete", updatedAt: new Date() })
      .where(eq(tenantsTable.id, tenantId));

    req.log.info({ tenantId }, "WhatsApp connected (demo confirm)");
    res.json({ status: "connected" });
  },
);

// ── Evolution API helpers (DB-first, env fallback) ────────────────────────────

const evoInstance = (tenantId: string) =>
  `reservaai_${tenantId.replace(/[^a-z0-9]/gi, "").slice(0, 20)}`;

async function getEvoConfig(): Promise<{ url: string; key: string; ok: boolean }> {
  try {
    const rows = await db
      .select()
      .from(platformSettingsTable)
      .where(
        or(
          eq(platformSettingsTable.key, "evolution_api_url"),
          eq(platformSettingsTable.key, "evolution_api_key"),
        ),
      );
    const m: Record<string, string> = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const url = (m["evolution_api_url"] ?? process.env.EVOLUTION_API_URL ?? "").replace(/\/$/, "");
    const key = m["evolution_api_key"] ?? process.env.EVOLUTION_API_KEY ?? "";
    return { url, key, ok: Boolean(url && key) };
  } catch {
    const url = (process.env.EVOLUTION_API_URL ?? "").replace(/\/$/, "");
    const key = process.env.EVOLUTION_API_KEY ?? "";
    return { url, key, ok: Boolean(url && key) };
  }
}

async function evoFetch(
  cfg: { url: string; key: string },
  path: string,
  opts: RequestInit = {},
) {
  return fetch(`${cfg.url}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      apikey: cfg.key,
      ...((opts.headers as Record<string, string>) ?? {}),
    },
  });
}

// POST /api/business/whatsapp/evo/connect — create instance + return QR
router.post(
  "/business/whatsapp/evo/connect",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId } = req.businessUser!;

    const cfg = await getEvoConfig();
    if (!cfg.ok) {
      res.json({ notConfigured: true });
      return;
    }

    const name = evoInstance(tenantId);

    // Create instance — if 409 (already exists) delete and recreate for fresh QR
    const createRes = await evoFetch(cfg, "/instance/create", {
      method: "POST",
      body: JSON.stringify({ instanceName: name, integration: "WHATSAPP-BAILEYS", qrcode: true }),
    });
    if (createRes.status === 409) {
      await evoFetch(cfg, `/instance/delete/${name}`, { method: "DELETE" }).catch(() => null);
      await evoFetch(cfg, "/instance/create", {
        method: "POST",
        body: JSON.stringify({ instanceName: name, integration: "WHATSAPP-BAILEYS", qrcode: true }),
      });
    }

    // Auto-configure Evolution API webhook for incoming message capture (survey responses)
    const domains = process.env.REPLIT_DOMAINS ?? "";
    const primaryDomain = domains.split(",")[0]?.trim();
    if (primaryDomain) {
      await evoFetch(cfg, `/webhook/set/${name}`, {
        method: "POST",
        body: JSON.stringify({
          url: `https://${primaryDomain}/api/evolution/webhook`,
          webhook_by_events: true,
          webhook_base64: false,
          events: ["MESSAGES_UPSERT"],
        }),
      }).catch(() => null);
      req.log.info({ tenantId, name, domain: primaryDomain }, "Evolution API webhook configured");
    }

    const qrRes = await evoFetch(cfg, `/instance/connect/${name}`);
    if (!qrRes.ok) {
      req.log.warn({ tenantId, status: qrRes.status }, "Evolution API QR failed");
      res.status(502).json({ error: "Erro ao gerar QR Code. Tente novamente." });
      return;
    }
    const qrData = (await qrRes.json()) as { code?: string; base64?: string };
    req.log.info({ tenantId, name }, "WhatsApp QR generated via Evolution API");
    res.json({ qr: qrData.base64 ?? null, instanceName: name });
  },
);

// GET /api/business/whatsapp/evo/qr — poll connection state + refresh QR
router.get(
  "/business/whatsapp/evo/qr",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId } = req.businessUser!;

    const cfg = await getEvoConfig();
    if (!cfg.ok) {
      res.json({ state: "notConfigured", qr: null });
      return;
    }

    const name = evoInstance(tenantId);

    const stateRes = await evoFetch(cfg, `/instance/connectionState/${name}`);
    if (!stateRes.ok) {
      res.json({ state: "close", qr: null });
      return;
    }

    const stateData = (await stateRes.json()) as { instance?: { state?: string } };
    const state = stateData.instance?.state ?? "close";

    if (state === "open") {
      // Fetch phone + profile and save to DB
      const fetchRes = await evoFetch(cfg, `/instance/fetchInstances?instanceName=${name}`);
      if (fetchRes.ok) {
        const instances = (await fetchRes.json()) as Array<{
          instance?: { owner?: string; profileName?: string; profilePictureUrl?: string };
        }>;
        const inst = instances[0]?.instance;
        const owner = inst?.owner ?? null;
        const phone = owner ? owner.replace(/@.*/, "") : null;
        if (phone) {
          await db
            .update(tenantsTable)
            .set({
              whatsappPhoneNumberId: name,
              whatsappPhoneNumber: phone,
              whatsappConnectedAt: new Date(),
              whatsappProfileName: inst?.profileName ?? null,
              whatsappProfilePhoto: inst?.profilePictureUrl ?? null,
              automationsEnabled: true,
              updatedAt: new Date(),
            })
            .where(eq(tenantsTable.id, tenantId));
          req.log.info({ tenantId, phone }, "WhatsApp connected via Evolution API");
        }
      }
      res.json({ state: "open", qr: null });
      return;
    }

    // Still waiting — refresh QR
    const qrRes = await evoFetch(cfg, `/instance/connect/${name}`);
    let qr: string | null = null;
    if (qrRes.ok) {
      const qrData = (await qrRes.json()) as { base64?: string };
      qr = qrData.base64 ?? null;
    }
    res.json({ state, qr });
  },
);

// POST /api/business/whatsapp/disconnect
router.post(
  "/business/whatsapp/disconnect",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId } = req.businessUser!;
    const name = evoInstance(tenantId);

    const cfg = await getEvoConfig();
    if (cfg.ok) {
      await evoFetch(cfg, `/instance/delete/${name}`, { method: "DELETE" }).catch(() => null);
    }

    await db
      .update(tenantsTable)
      .set({
        whatsappPhoneNumberId: null,
        whatsappPhoneNumber: null,
        whatsappConnectedAt: null,
        whatsappProfileName: null,
        whatsappProfilePhoto: null,
        automationsEnabled: false,
        updatedAt: new Date(),
      })
      .where(eq(tenantsTable.id, tenantId));

    req.log.info({ tenantId }, "WhatsApp disconnected");
    res.json({ success: true });
  },
);

router.get(
  "/business/conversations",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId } = req.businessUser!;

    const sessions = await db
      .select()
      .from(whatsappSessionsTable)
      .where(eq(whatsappSessionsTable.tenantId, tenantId))
      .orderBy(desc(whatsappSessionsTable.updatedAt))
      .limit(50);

    res.json(
      sessions.map((s) => ({
        id: s.id,
        phone: s.phone,
        flowStep: s.flowStep,
        status: s.status,
        sessionData: s.sessionData,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      })),
    );
  },
);

router.post(
  "/business/clients",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId } = req.businessUser!;
    const body = req.body as {
      contactName?: string;
      businessName?: string;
      phone?: string;
      email?: string;
      industry?: string;
    };

    if (!body.contactName?.trim()) {
      res.status(400).json({ error: "Nome é obrigatório" });
      return;
    }

    const [submission] = await db
      .insert(onboardingSubmissionsTable)
      .values({
        tenantId,
        contactName: body.contactName.trim(),
        businessName: body.businessName?.trim() ?? body.contactName.trim(),
        phone: body.phone?.trim() ?? "",
        email: body.email?.trim() ?? "",
        industry: body.industry?.trim() ?? null,
        status: "pending",
      })
      .returning();

    req.log.info({ tenantId, submissionId: submission.id }, "Client added manually");
    res.status(201).json({
      id: submission.id,
      businessName: submission.businessName,
      contactName: submission.contactName,
      email: submission.email,
      phone: submission.phone,
      industry: submission.industry ?? null,
      status: submission.status,
      createdAt: submission.createdAt.toISOString(),
    });
  },
);

router.post(
  "/business/whatsapp/phone-request",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId } = req.businessUser!;

    const phone = (req.body as { phone?: string }).phone?.trim();
    if (!phone || phone.replace(/\D/g, "").length < 7) {
      res.status(400).json({ error: "Número de WhatsApp inválido" });
      return;
    }

    await db
      .update(tenantsTable)
      .set({
        phone,
        onboardingStep: "complete",
        updatedAt: new Date(),
      })
      .where(eq(tenantsTable.id, tenantId));

    req.log.info({ tenantId, phone }, "WhatsApp phone saved via manual entry");
    res.json({ success: true });
  },
);

// ── WhatsApp real status ───────────────────────────────────────────────────────

router.get(
  "/business/whatsapp/status",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId } = req.businessUser!;

    const hasToken = Boolean(process.env.WHATSAPP_TOKEN);
    const hasPhoneNumberId = Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID);
    const hasVerifyToken = Boolean(process.env.WHATSAPP_VERIFY_TOKEN);

    const [cfg, [tenant]] = await Promise.all([
      getEvoConfig(),
      db
        .select({
          phone: tenantsTable.phone,
          whatsappPhoneNumberId: tenantsTable.whatsappPhoneNumberId,
          whatsappPhoneNumber: tenantsTable.whatsappPhoneNumber,
          whatsappConnectedAt: tenantsTable.whatsappConnectedAt,
          whatsappProfileName: tenantsTable.whatsappProfileName,
          whatsappProfilePhoto: tenantsTable.whatsappProfilePhoto,
          automationsEnabled: tenantsTable.automationsEnabled,
          onboardingStep: tenantsTable.onboardingStep,
        })
        .from(tenantsTable)
        .where(eq(tenantsTable.id, tenantId)),
    ]);

    const [totalRow] = await db
      .select({ value: count() })
      .from(whatsappSessionsTable)
      .where(eq(whatsappSessionsTable.tenantId, tenantId));

    const [activeRow] = await db
      .select({ value: count() })
      .from(whatsappSessionsTable)
      .where(
        and(
          eq(whatsappSessionsTable.tenantId, tenantId),
          eq(whatsappSessionsTable.status, "active"),
        ),
      );

    const [completedRow] = await db
      .select({ value: count() })
      .from(whatsappSessionsTable)
      .where(
        and(
          eq(whatsappSessionsTable.tenantId, tenantId),
          eq(whatsappSessionsTable.status, "completed"),
        ),
      );

    const recentSessions = await db
      .select({
        id: whatsappSessionsTable.id,
        phone: whatsappSessionsTable.phone,
        status: whatsappSessionsTable.status,
        flowStep: whatsappSessionsTable.flowStep,
        updatedAt: whatsappSessionsTable.updatedAt,
      })
      .from(whatsappSessionsTable)
      .where(eq(whatsappSessionsTable.tenantId, tenantId))
      .orderBy(desc(whatsappSessionsTable.updatedAt))
      .limit(5);

    const lastSession = recentSessions[0];

    const apiConfigured = hasToken && hasPhoneNumberId;
    const tenantPhoneNumberId = tenant?.whatsappPhoneNumberId ?? null;

    res.json({
      connectionType: "meta_api" as const,
      apiConfigured,
      webhookConfigured: hasVerifyToken,
      evoConfigured: cfg.ok,
      tenantPhone: tenant?.phone ?? null,
      tenantPhoneNumberId,
      tenantWhatsappPhone: tenant?.whatsappPhoneNumber ?? null,
      tenantWhatsappConnectedAt: tenant?.whatsappConnectedAt?.toISOString() ?? null,
      whatsappProfileName: tenant?.whatsappProfileName ?? null,
      whatsappProfilePhoto: tenant?.whatsappProfilePhoto ?? null,
      automationsEnabled: tenant?.automationsEnabled ?? false,
      onboardingCompleted: tenant?.onboardingStep === "complete",
      totalSessions: totalRow?.value ?? 0,
      activeSessions: activeRow?.value ?? 0,
      completedSessions: completedRow?.value ?? 0,
      lastActivityAt: lastSession?.updatedAt?.toISOString() ?? null,
      recentSessions: recentSessions.map((s) => ({
        id: s.id,
        phone: s.phone,
        status: s.status,
        flowStep: s.flowStep,
        updatedAt: s.updatedAt.toISOString(),
      })),
    });
  },
);

// POST /api/business/whatsapp/test-message — send a test WhatsApp message
router.post(
  "/business/whatsapp/test-message",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId } = req.businessUser!;
    const { to } = req.body as { to?: string };

    if (!to?.trim()) {
      res.status(400).json({ error: "Número de destino obrigatório" });
      return;
    }

    const cfg = await getEvoConfig();
    if (!cfg.ok) {
      res.status(503).json({ error: "Evolution API não configurada" });
      return;
    }

    const name = evoInstance(tenantId);
    const number = to.replace(/\D/g, "");

    const msgRes = await evoFetch(cfg, `/message/sendText/${name}`, {
      method: "POST",
      body: JSON.stringify({
        number,
        text: "✅ Olá! Esta é uma mensagem de teste do *ReservaAI*.\n\nSeu WhatsApp está conectado e funcionando perfeitamente! 🎉\n\nSuas automações já estão ativas.",
      }),
    });

    if (!msgRes.ok) {
      const errData = (await msgRes.json().catch(() => ({}))) as { error?: string };
      req.log.warn({ tenantId, status: msgRes.status, errData }, "WhatsApp test message failed");
      res.status(502).json({ error: "Erro ao enviar mensagem. Verifique se o número está conectado." });
      return;
    }

    req.log.info({ tenantId, to: number }, "WhatsApp test message sent");
    res.json({ success: true });
  },
);

// ── Services CRUD ─────────────────────────────────────────────────────────────

router.get(
  "/business/services",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId } = req.businessUser!;
    const services = await db
      .select()
      .from(servicesTable)
      .where(eq(servicesTable.tenantId, tenantId))
      .orderBy(servicesTable.createdAt);
    res.json(services.map((s) => ({ ...s, price: String(s.price) })));
  },
);

router.post(
  "/business/services",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId } = req.businessUser!;
    const body = req.body as {
      name?: string;
      description?: string;
      price?: number;
      durationMinutes?: number;
    };
    if (!body.name?.trim()) {
      res.status(400).json({ error: "Nome é obrigatório" });
      return;
    }
    const [service] = await db
      .insert(servicesTable)
      .values({
        tenantId,
        name: body.name.trim(),
        description: body.description?.trim() ?? null,
        price: String(body.price ?? 0),
        durationMinutes: body.durationMinutes ?? 60,
      })
      .returning();
    req.log.info({ tenantId, serviceId: service.id }, "Service created");
    res.status(201).json({ ...service, price: String(service.price) });
  },
);

router.put(
  "/business/services/:id",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId } = req.businessUser!;
    const body = req.body as {
      name?: string;
      description?: string;
      price?: number;
      durationMinutes?: number;
    };
    const [service] = await db
      .update(servicesTable)
      .set({
        name: body.name?.trim(),
        description: body.description?.trim() ?? null,
        price: body.price !== undefined ? String(body.price) : undefined,
        durationMinutes: body.durationMinutes,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(servicesTable.id, req.params.id as string),
          eq(servicesTable.tenantId, tenantId),
        ),
      )
      .returning();
    if (!service) {
      res.status(404).json({ error: "Serviço não encontrado" });
      return;
    }
    res.json({ ...service, price: String(service.price) });
  },
);

router.delete(
  "/business/services/:id",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId } = req.businessUser!;
    await db
      .delete(servicesTable)
      .where(
        and(
          eq(servicesTable.id, req.params.id as string),
          eq(servicesTable.tenantId, tenantId),
        ),
      );
    res.status(204).end();
  },
);

// ── Appointments ──────────────────────────────────────────────────────────────

router.get(
  "/business/appointments",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId } = req.businessUser!;
    const rows = await db
      .select({
        id: appointmentsTable.id,
        clientName: appointmentsTable.clientName,
        clientPhone: appointmentsTable.clientPhone,
        clientEmail: appointmentsTable.clientEmail,
        scheduledAt: appointmentsTable.scheduledAt,
        status: appointmentsTable.status,
        whatsappStatus: appointmentsTable.whatsappStatus,
        reminderSentAt: appointmentsTable.reminderSentAt,
        notes: appointmentsTable.notes,
        createdAt: appointmentsTable.createdAt,
        serviceName: servicesTable.name,
        servicePrice: servicesTable.price,
        serviceDuration: servicesTable.durationMinutes,
      })
      .from(appointmentsTable)
      .leftJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
      .where(eq(appointmentsTable.tenantId, tenantId))
      .orderBy(desc(appointmentsTable.scheduledAt))
      .limit(100);

    res.json(
      rows.map((r) => ({
        id: r.id,
        clientName: r.clientName,
        clientPhone: r.clientPhone,
        clientEmail: r.clientEmail ?? null,
        scheduledAt: r.scheduledAt.toISOString(),
        status: r.status,
        whatsappStatus: r.whatsappStatus,
        reminderSentAt: r.reminderSentAt?.toISOString() ?? null,
        notes: r.notes ?? null,
        createdAt: r.createdAt.toISOString(),
        service: r.serviceName
          ? {
              name: r.serviceName,
              price: String(r.servicePrice ?? "0"),
              durationMinutes: r.serviceDuration ?? 60,
            }
          : null,
      })),
    );
  },
);

// ── Appointment status update ──────────────────────────────────────────────────

router.patch(
  "/business/appointments/:id/status",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId } = req.businessUser!;
    const { status } = req.body as { status?: string };
    const validStatuses = ["pending", "confirmed", "cancelled", "completed"];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ error: "Status inválido" });
      return;
    }
    const [appt] = await db
      .update(appointmentsTable)
      .set({ status: status as "pending" | "confirmed" | "cancelled" | "completed", updatedAt: new Date() })
      .where(
        and(
          eq(appointmentsTable.id, req.params.id as string),
          eq(appointmentsTable.tenantId, tenantId),
        ),
      )
      .returning();
    if (!appt) {
      res.status(404).json({ error: "Agendamento não encontrado" });
      return;
    }
    res.json({ id: appt.id, status: appt.status });
  },
);

// ── Profile GET ────────────────────────────────────────────────────────────────

router.get(
  "/business/profile",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId, userId } = req.businessUser!;

    const [[tenant], [user]] = await Promise.all([
      db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId)),
      db
        .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, whatsapp: usersTable.whatsapp })
        .from(usersTable)
        .where(eq(usersTable.id, userId)),
    ]);

    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

    res.json({ tenant: toTenantResponse(tenant), user: user ?? null });
  },
);

// ── Profile PUT ────────────────────────────────────────────────────────────────

router.put(
  "/business/profile",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId, userId } = req.businessUser!;
    const body = req.body as Record<string, string | undefined>;

    const tenantUpdate: Record<string, string | null> = {};
    const allowed = ["name","phone","email","businessType","description","address","city","instagram","website","logoUrl","openingHours","preferences","slug"] as const;
    for (const k of allowed) {
      if (k in body) tenantUpdate[k] = body[k] ?? null;
    }

    if (tenantUpdate.slug) {
      const slug = (tenantUpdate.slug as string).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      const [existing] = await db.select({ id: tenantsTable.id }).from(tenantsTable).where(eq(tenantsTable.slug, slug));
      if (existing && existing.id !== tenantId) {
        res.status(409).json({ error: "Este link já está em uso. Escolha outro." });
        return;
      }
      tenantUpdate.slug = slug;
      tenantUpdate.subdomain = slug;
    }

    const userUpdate: Record<string, string> = {};
    if (body.userName) userUpdate.name = body.userName;

    await Promise.all([
      Object.keys(tenantUpdate).length > 0
        ? db.update(tenantsTable).set({ ...tenantUpdate, updatedAt: new Date() }).where(eq(tenantsTable.id, tenantId))
        : Promise.resolve(),
      Object.keys(userUpdate).length > 0
        ? db.update(usersTable).set({ ...userUpdate, updatedAt: new Date() }).where(eq(usersTable.id, userId))
        : Promise.resolve(),
    ]);

    const [[tenant], [user]] = await Promise.all([
      db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId)),
      db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, whatsapp: usersTable.whatsapp }).from(usersTable).where(eq(usersTable.id, userId)),
    ]);

    req.log.info({ tenantId }, "Profile updated");
    res.json({ tenant: toTenantResponse(tenant!), user: user ?? null });
  },
);

// ── Password change ────────────────────────────────────────────────────────────

router.put(
  "/business/password",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { userId } = req.businessUser!;
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Preencha a senha atual e a nova senha" });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: "A nova senha deve ter pelo menos 6 caracteres" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) { res.status(404).json({ error: "Usuário não encontrado" }); return; }

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) { res.status(400).json({ error: "Senha atual incorreta" }); return; }

    const hash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash: hash, updatedAt: new Date() }).where(eq(usersTable.id, userId));

    req.log.info({ userId }, "Password changed");
    res.json({ success: true });
  },
);

// ── Delete account ─────────────────────────────────────────────────────────────

router.delete(
  "/business/account",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId, userId } = req.businessUser!;
    const { password } = req.body as { password?: string };

    if (!password) { res.status(400).json({ error: "Confirme sua senha para excluir a conta" }); return; }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) { res.status(404).json({ error: "Usuário não encontrado" }); return; }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) { res.status(400).json({ error: "Senha incorreta" }); return; }

    await db.update(tenantsTable).set({ status: "inactive", updatedAt: new Date() }).where(eq(tenantsTable.id, tenantId));

    req.log.info({ tenantId, userId }, "Account deactivated");
    res.json({ success: true });
  },
);

export default router;

