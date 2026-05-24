import { Router, type IRouter } from "express";
import { eq, and, ne, gte, lt } from "drizzle-orm";
import {
  db,
  tenantsTable,
  onboardingSubmissionsTable,
  servicesTable,
  appointmentsTable,
} from "@workspace/db";
import {
  GetPublicTenantParams,
  GetPublicTenantResponse,
  SubmitOnboardingParams,
  SubmitOnboardingBody,
} from "@workspace/api-zod";
import { generateOgPng } from "../lib/og-image";
import { sendAppointmentConfirmation } from "../lib/whatsapp-notify";

const router: IRouter = Router();

router.get(
  "/public/tenants/:slug",
  async (req, res): Promise<void> => {
    const params = GetPublicTenantParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [tenant] = await db
      .select({
        id: tenantsTable.id,
        name: tenantsTable.name,
        slug: tenantsTable.slug,
        status: tenantsTable.status,
      })
      .from(tenantsTable)
      .where(eq(tenantsTable.slug, params.data.slug));

    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    res.json(GetPublicTenantResponse.parse(tenant));
  },
);

router.post(
  "/public/tenants/:slug/onboarding",
  async (req, res): Promise<void> => {
    const params = SubmitOnboardingParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = SubmitOnboardingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [tenant] = await db
      .select({ id: tenantsTable.id })
      .from(tenantsTable)
      .where(eq(tenantsTable.slug, params.data.slug));

    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    const [submission] = await db
      .insert(onboardingSubmissionsTable)
      .values({
        tenantId: tenant.id,
        businessName: parsed.data.businessName,
        contactName: parsed.data.contactName,
        email: parsed.data.email,
        phone: parsed.data.phone,
        address: parsed.data.address ?? null,
        industry: parsed.data.industry ?? null,
        notes: parsed.data.notes ?? null,
      })
      .returning();

    req.log.info(
      { submissionId: submission.id, tenantId: tenant.id },
      "Onboarding submission created",
    );

    res.status(201).json({
      id: submission.id,
      tenantId: submission.tenantId,
      businessName: submission.businessName,
      contactName: submission.contactName,
      email: submission.email,
      phone: submission.phone,
      address: submission.address ?? null,
      industry: submission.industry ?? null,
      notes: submission.notes ?? null,
      status: submission.status,
      createdAt: submission.createdAt.toISOString(),
      updatedAt: submission.updatedAt.toISOString(),
    });
  },
);

// ── Dynamic OG image per business — PNG 1200×630 ─────────────────────────────

router.get(
  "/og/:slug.png",
  async (req, res): Promise<void> => {
    const { slug } = req.params as { slug: string };

    const [tenant] = await db
      .select({ name: tenantsTable.name })
      .from(tenantsTable)
      .where(eq(tenantsTable.slug, slug));

    const businessName = tenant?.name ?? "Seu negócio";
    const png = generateOgPng(businessName);

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
    res.send(png);
  },
);

// ── Social share page — returns real HTML with per-business OG meta tags ──────
// Bots (WhatsApp, Telegram, Facebook…) hit this URL and get correct OG.
// Human browsers are immediately JS-redirected to /:slug.

router.get(
  "/share/:slug",
  async (req, res): Promise<void> => {
    const { slug } = req.params as { slug: string };

    const [tenant] = await db
      .select({
        id: tenantsTable.id,
        name: tenantsTable.name,
        slug: tenantsTable.slug,
        businessType: tenantsTable.businessType,
        phone: tenantsTable.phone,
      })
      .from(tenantsTable)
      .where(eq(tenantsTable.slug, slug));

    if (!tenant) {
      res.status(404).send("<h1>Empresa não encontrada</h1>");
      return;
    }

    const services = await db
      .select({ name: servicesTable.name, price: servicesTable.price })
      .from(servicesTable)
      .where(
        and(
          eq(servicesTable.tenantId, tenant.id),
          eq(servicesTable.isActive, true),
        ),
      )
      .limit(5);

    const proto = req.get("x-forwarded-proto") ?? req.protocol ?? "https";
    const host = req.get("host") ?? "admin-password.replit.app";
    const origin = `${proto}://${host}`;

    const businessName = tenant.name;
    const initial = businessName.charAt(0).toUpperCase();
    const businessType = tenant.businessType ?? "Agendamentos online";
    const bookingUrl = `${origin}/${slug}`;
    const shareUrl = `${origin}/api/share/${slug}`;
    const imageUrl = `${origin}/api/og/${slug}.png`;

    const servicesDesc =
      services.length > 0
        ? services.map((s) => s.name).join(", ")
        : "Agende seu horário online";

    const ogTitle = `${businessName} — Agende seu horário`;
    const ogDescription =
      services.length > 0
        ? `${servicesDesc}. Agendamento rápido e fácil, sem precisar ligar.`
        : `Agende com ${businessName} de forma rápida e fácil.`;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${ogTitle} | ReservaAI</title>
  <meta name="description" content="${ogDescription}">
  <meta http-equiv="refresh" content="0; url=${bookingUrl}">

  <!-- Open Graph -->
  <meta property="og:site_name" content="ReservaAI">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${shareUrl}">
  <meta property="og:title" content="${ogTitle}">
  <meta property="og:description" content="${ogDescription}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:secure_url" content="${imageUrl}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${businessName}">
  <meta property="og:locale" content="pt_BR">

  <!-- Twitter / WhatsApp -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${ogTitle}">
  <meta name="twitter:description" content="${ogDescription}">
  <meta name="twitter:image" content="${imageUrl}">

  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      background:#f5f3ff;min-height:100vh;display:flex;align-items:center;
      justify-content:center;padding:24px}
    .card{background:#fff;border-radius:24px;padding:32px 28px;
      max-width:360px;width:100%;text-align:center;
      box-shadow:0 8px 40px rgba(124,58,237,.12)}
    .logo{width:56px;height:56px;border-radius:16px;
      background:linear-gradient(135deg,#7c3aed,#6d28d9);
      display:flex;align-items:center;justify-content:center;
      margin:0 auto 16px;color:#fff;font-weight:700;font-size:22px}
    h1{color:#111827;font-size:19px;font-weight:700;margin-bottom:6px}
    .type{color:#6b7280;font-size:13px;margin-bottom:20px}
    .services{background:#f5f3ff;border-radius:12px;padding:12px 16px;
      margin-bottom:20px;text-align:left}
    .services p{color:#7c3aed;font-size:11px;font-weight:700;
      text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px}
    .services li{color:#374151;font-size:13px;list-style:none;
      padding:3px 0;border-bottom:1px solid #ede9fe}
    .services li:last-child{border:none}
    .btn{display:inline-block;background:#7c3aed;color:#fff;
      padding:13px 28px;border-radius:14px;text-decoration:none;
      font-weight:700;font-size:14px;width:100%}
    .brand{color:#9ca3af;font-size:11px;margin-top:16px}
  </style>
</head>
<body>
  <script>window.location.replace("${bookingUrl}");</script>
  <div class="card">
    <div class="logo">${initial}</div>
    <h1>${businessName}</h1>
    <p class="type">${businessType}</p>
    ${
      services.length > 0
        ? `<div class="services">
      <p>Serviços disponíveis</p>
      <ul>${services.map((s) => `<li>${s.name}</li>`).join("")}</ul>
    </div>`
        : ""
    }
    <a class="btn" href="${bookingUrl}">Ver serviços e agendar →</a>
    <p class="brand">Powered by ReservaAI</p>
  </div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
    res.send(html);
  },
);

// ── Public booking page ───────────────────────────────────────────────────────

router.get(
  "/public/booking/:slug",
  async (req, res): Promise<void> => {
    const { slug } = req.params as { slug: string };
    const [tenant] = await db
      .select({
        id: tenantsTable.id,
        name: tenantsTable.name,
        slug: tenantsTable.slug,
        businessType: tenantsTable.businessType,
        phone: tenantsTable.phone,
        address: tenantsTable.address,
      })
      .from(tenantsTable)
      .where(eq(tenantsTable.slug, slug));

    if (!tenant) {
      res.status(404).json({ error: "Empresa não encontrada" });
      return;
    }

    const services = await db
      .select()
      .from(servicesTable)
      .where(
        and(
          eq(servicesTable.tenantId, tenant.id),
          eq(servicesTable.isActive, true),
        ),
      )
      .orderBy(servicesTable.createdAt);

    res.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        businessType: tenant.businessType ?? null,
        phone: tenant.phone ?? null,
        address: tenant.address ?? null,
      },
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description ?? null,
        price: String(s.price),
        durationMinutes: s.durationMinutes,
      })),
    });
  },
);

// ── Availability ──────────────────────────────────────────────────────────────

router.get(
  "/public/booking/:slug/availability",
  async (req, res): Promise<void> => {
    const { slug } = req.params as { slug: string };
    const { date } = req.query as { date?: string };

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: "date param required (YYYY-MM-DD)" });
      return;
    }

    const [tenant] = await db
      .select({ id: tenantsTable.id })
      .from(tenantsTable)
      .where(eq(tenantsTable.slug, slug));

    if (!tenant) {
      res.status(404).json({ error: "Empresa não encontrada" });
      return;
    }

    // Cover the full UTC day — works for all BR timezones (UTC-2 to UTC-5)
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    const rows = await db
      .select({
        scheduledAt: appointmentsTable.scheduledAt,
        endTime: appointmentsTable.endTime,
        totalDurationMinutes: appointmentsTable.totalDurationMinutes,
        serviceDuration: servicesTable.durationMinutes,
      })
      .from(appointmentsTable)
      .leftJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
      .where(
        and(
          eq(appointmentsTable.tenantId, tenant.id),
          ne(appointmentsTable.status, "cancelled"),
          gte(appointmentsTable.scheduledAt, dayStart),
          lt(appointmentsTable.scheduledAt, dayEnd),
        ),
      );

    res.json({
      appointments: rows.map((r) => {
        // Prefer stored end_time; fall back to computing from stored/service duration
        const dur = r.totalDurationMinutes ?? r.serviceDuration ?? 60;
        const endTime =
          r.endTime?.toISOString() ??
          new Date(r.scheduledAt.getTime() + dur * 60 * 1000).toISOString();
        return {
          scheduledAt: r.scheduledAt.toISOString(),
          endTime,
          durationMinutes: dur,
        };
      }),
    });
  },
);

// ── Create appointment ────────────────────────────────────────────────────────

router.post(
  "/public/booking/:slug/appointments",
  async (req, res): Promise<void> => {
    const { slug } = req.params as { slug: string };
    const [tenant] = await db
      .select({ id: tenantsTable.id })
      .from(tenantsTable)
      .where(eq(tenantsTable.slug, slug));

    if (!tenant) {
      res.status(404).json({ error: "Empresa não encontrada" });
      return;
    }

    const body = req.body as {
      clientName?: string;
      clientPhone?: string;
      clientEmail?: string;
      serviceId?: string;
      scheduledAt?: string;
      notes?: string;
      totalDurationMinutes?: number;
    };

    if (!body.clientName?.trim() || !body.clientPhone?.trim() || !body.scheduledAt) {
      res.status(400).json({ error: "Nome, telefone e horário são obrigatórios" });
      return;
    }

    const newStart = new Date(body.scheduledAt);

    // Resolve duration: prefer explicit totalDurationMinutes, else look up service
    let newDuration = body.totalDurationMinutes ?? 0;
    if (!newDuration && body.serviceId) {
      const [svc] = await db
        .select({ durationMinutes: servicesTable.durationMinutes })
        .from(servicesTable)
        .where(eq(servicesTable.id, body.serviceId));
      newDuration = svc?.durationMinutes ?? 60;
    }
    if (!newDuration) newDuration = 60;

    const newEnd = new Date(newStart.getTime() + newDuration * 60 * 1000);

    // Query all non-cancelled appointments on the same UTC day
    const dayStart = new Date(`${body.scheduledAt.slice(0, 10)}T00:00:00.000Z`);
    const dayEnd = new Date(`${body.scheduledAt.slice(0, 10)}T23:59:59.999Z`);

    const existing = await db
      .select({
        scheduledAt: appointmentsTable.scheduledAt,
        endTime: appointmentsTable.endTime,
        clientPhone: appointmentsTable.clientPhone,
        totalDurationMinutes: appointmentsTable.totalDurationMinutes,
        serviceDuration: servicesTable.durationMinutes,
      })
      .from(appointmentsTable)
      .leftJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
      .where(
        and(
          eq(appointmentsTable.tenantId, tenant.id),
          ne(appointmentsTable.status, "cancelled"),
          gte(appointmentsTable.scheduledAt, dayStart),
          lt(appointmentsTable.scheduledAt, dayEnd),
        ),
      );

    // Check overlap with appointments from a DIFFERENT client
    for (const appt of existing) {
      if (appt.clientPhone === body.clientPhone.trim()) continue; // same session (multi-service)
      // Use stored end_time first, fall back to duration join, then default 60 min
      const existEnd =
        appt.endTime ??
        new Date(
          appt.scheduledAt.getTime() +
            ((appt.totalDurationMinutes ?? appt.serviceDuration ?? 60) * 60 * 1000),
        );
      // Two intervals overlap: newStart < existEnd AND existStart < newEnd
      if (newStart < existEnd && appt.scheduledAt < newEnd) {
        res.status(409).json({
          error: "Este horário já foi reservado. Escolha outro horário disponível.",
        });
        return;
      }
    }

    const [appointment] = await db
      .insert(appointmentsTable)
      .values({
        tenantId: tenant.id,
        serviceId: body.serviceId ?? null,
        clientName: body.clientName.trim(),
        clientPhone: body.clientPhone.trim(),
        clientEmail: body.clientEmail?.trim() ?? null,
        scheduledAt: newStart,
        endTime: newEnd,
        totalDurationMinutes: newDuration,
        notes: body.notes?.trim() ?? null,
      })
      .returning();

    // Fire-and-forget — never blocks the client response
    void sendAppointmentConfirmation(appointment.id);

    res.status(201).json({
      id: appointment.id,
      clientName: appointment.clientName,
      scheduledAt: appointment.scheduledAt.toISOString(),
      status: appointment.status,
      whatsappStatus: appointment.whatsappStatus,
    });
  },
);

export default router;
