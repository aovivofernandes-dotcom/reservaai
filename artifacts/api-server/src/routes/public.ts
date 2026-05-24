import { Router, type IRouter } from "express";
import { eq, and, ne, gte, lt, sql } from "drizzle-orm";

/**
 * Convert a UUID string to a stable int64 for pg_advisory_xact_lock.
 * We take the first 15 hex digits (60 bits) to stay safely within bigint range.
 */
function uuidToLockId(uuid: string): bigint {
  const hex = uuid.replace(/-/g, "").slice(0, 15);
  return BigInt("0x" + hex);
}
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
    const dayStart = new Date(`${body.scheduledAt.slice(0, 10)}T00:00:00.000Z`);
    const dayEnd = new Date(`${body.scheduledAt.slice(0, 10)}T23:59:59.999Z`);

    // ── Atomic: advisory lock + conflict check + insert in one transaction ─────
    // pg_advisory_xact_lock serialises concurrent requests for the same tenant,
    // eliminating the check-then-insert race condition entirely.
    let appointment: typeof appointmentsTable.$inferSelect;
    try {
      appointment = await db.transaction(async (tx) => {
        // Lock scoped to this tenant — released automatically when tx ends
        const lockId = uuidToLockId(tenant.id);
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockId}::bigint)`);

        // Re-check conflicts inside the lock
        const existing = await tx
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

        for (const appt of existing) {
          if (appt.clientPhone === body.clientPhone!.trim()) continue; // same session
          const existEnd =
            appt.endTime ??
            new Date(
              appt.scheduledAt.getTime() +
                (appt.totalDurationMinutes ?? appt.serviceDuration ?? 60) * 60_000,
            );
          // Overlap: newStart < existEnd AND existStart < newEnd
          if (newStart < existEnd && appt.scheduledAt < newEnd) {
            throw Object.assign(new Error("conflict"), { isConflict: true });
          }
        }

        const [inserted] = await tx
          .insert(appointmentsTable)
          .values({
            tenantId: tenant.id,
            serviceId: body.serviceId ?? null,
            clientName: body.clientName!.trim(),
            clientPhone: body.clientPhone!.trim(),
            clientEmail: body.clientEmail?.trim() ?? null,
            scheduledAt: newStart,
            endTime: newEnd,
            totalDurationMinutes: newDuration,
            notes: body.notes?.trim() ?? null,
          })
          .returning();

        return inserted;
      });
    } catch (err) {
      if ((err as { isConflict?: boolean }).isConflict) {
        res.status(409).json({
          error: "Este horário já foi reservado. Escolha outro horário disponível.",
        });
        return;
      }
      throw err;
    }

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
