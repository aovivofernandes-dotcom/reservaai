/**
 * whatsapp-survey.ts
 * Background job: sends satisfaction surveys 1 hour after each appointment ends.
 *
 * Each tick (every 5 min):
 *   1. Creates `pending_send` survey rows for completed appointments with no survey yet.
 *   2. Sends all `pending_send` surveys where the tenant's WhatsApp is connected.
 *
 * De-duplication: the `appointmentId` column is UNIQUE — one survey per appointment.
 * If WhatsApp is not connected, the row stays `pending_send` and retries next tick.
 */
import { and, eq, isNull, lt, isNotNull, notInArray, or } from "drizzle-orm";
import {
  db,
  tenantsTable,
  appointmentsTable,
  satisfactionSurveysTable,
  platformSettingsTable,
} from "@workspace/db";
import { logger } from "./logger";

// ── Shared helpers ─────────────────────────────────────────────────────────────

async function getEvoCfg(): Promise<{ url: string; key: string; ok: boolean }> {
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
    const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const url = (m["evolution_api_url"] ?? process.env.EVOLUTION_API_URL ?? "").replace(/\/$/, "");
    const key = m["evolution_api_key"] ?? process.env.EVOLUTION_API_KEY ?? "";
    return { url, key, ok: Boolean(url && key) };
  } catch {
    const url = (process.env.EVOLUTION_API_URL ?? "").replace(/\/$/, "");
    const key = process.env.EVOLUTION_API_KEY ?? "";
    return { url, key, ok: Boolean(url && key) };
  }
}

function evoInstance(tenantId: string): string {
  return `reservaai_${tenantId.replace(/[^a-z0-9]/gi, "").slice(0, 20)}`;
}

function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  const stripped = digits.startsWith("0") ? digits.slice(1) : digits;
  if (stripped.length >= 10 && stripped.length <= 11) return `55${stripped}`;
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

// ── Job tick ───────────────────────────────────────────────────────────────────

async function runSurveyTick(): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // ── 1. Create pending_send rows for appointments that don't have one yet ─────
  const needSurvey = await db
    .select({
      id: appointmentsTable.id,
      tenantId: appointmentsTable.tenantId,
      clientName: appointmentsTable.clientName,
      clientPhone: appointmentsTable.clientPhone,
    })
    .from(appointmentsTable)
    .leftJoin(
      satisfactionSurveysTable,
      eq(satisfactionSurveysTable.appointmentId, appointmentsTable.id),
    )
    .where(
      and(
        lt(appointmentsTable.scheduledAt, oneHourAgo),
        isNull(satisfactionSurveysTable.id),
        notInArray(appointmentsTable.status, ["cancelled"]),
      ),
    );

  if (needSurvey.length > 0) {
    logger.info({ count: needSurvey.length }, "survey: creating pending rows");
    for (const appt of needSurvey) {
      await db
        .insert(satisfactionSurveysTable)
        .values({
          appointmentId: appt.id,
          tenantId: appt.tenantId,
          clientName: appt.clientName,
          clientPhone: appt.clientPhone,
        })
        .onConflictDoNothing();
    }
  }

  // ── 2. Send pending_send surveys where tenant WhatsApp is connected ──────────
  const pending = await db
    .select({
      id: satisfactionSurveysTable.id,
      clientName: satisfactionSurveysTable.clientName,
      clientPhone: satisfactionSurveysTable.clientPhone,
      tenantId: satisfactionSurveysTable.tenantId,
      tenantName: tenantsTable.name,
      tenantPhoneId: tenantsTable.whatsappPhoneNumberId,
    })
    .from(satisfactionSurveysTable)
    .innerJoin(tenantsTable, eq(satisfactionSurveysTable.tenantId, tenantsTable.id))
    .where(
      and(
        eq(satisfactionSurveysTable.status, "pending_send"),
        isNotNull(tenantsTable.whatsappPhoneNumberId),
      ),
    );

  if (pending.length === 0) return;

  const cfg = await getEvoCfg();
  if (!cfg.ok) return;

  for (const survey of pending) {
    try {
      const phone = normalisePhone(survey.clientPhone);
      if (!phone) {
        await db
          .update(satisfactionSurveysTable)
          .set({ status: "error", updatedAt: new Date() })
          .where(eq(satisfactionSurveysTable.id, survey.id));
        continue;
      }

      const firstName = survey.clientName.split(" ")[0] ?? survey.clientName;
      const text = [
        `Olá, ${firstName}! Como foi seu atendimento na *${survey.tenantName}*? 😊`,
        "",
        "De *1 a 5*, qual nota você dá para sua experiência?",
        "_(1 = Ruim · 2 = Regular · 3 = Bom · 4 = Ótimo · 5 = Excelente)_",
      ].join("\n");

      const res = await fetch(
        `${cfg.url}/message/sendText/${evoInstance(survey.tenantId)}`,
        {
          method: "POST",
          signal: AbortSignal.timeout(12_000),
          headers: { "Content-Type": "application/json", apikey: cfg.key },
          body: JSON.stringify({ number: phone, text }),
        },
      );

      if (res.ok) {
        await db
          .update(satisfactionSurveysTable)
          .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
          .where(eq(satisfactionSurveysTable.id, survey.id));
        logger.info({ surveyId: survey.id }, "survey: sent ✓");
      } else {
        await db
          .update(satisfactionSurveysTable)
          .set({ status: "error", updatedAt: new Date() })
          .where(eq(satisfactionSurveysTable.id, survey.id));
        logger.warn({ surveyId: survey.id, status: res.status }, "survey: send failed");
      }
    } catch (err) {
      logger.warn({ err, surveyId: survey.id }, "survey: exception during send");
      await db
        .update(satisfactionSurveysTable)
        .set({ status: "error", updatedAt: new Date() })
        .where(eq(satisfactionSurveysTable.id, survey.id))
        .catch(() => null);
    }
  }
}

// ── Public export ──────────────────────────────────────────────────────────────

const INTERVAL_MS = 5 * 60 * 1000;

export function startSurveyJob(): void {
  logger.info({ intervalMs: INTERVAL_MS }, "survey: job started");

  void runSurveyTick().catch((err) =>
    logger.warn({ err }, "survey: initial tick failed"),
  );

  setInterval(() => {
    void runSurveyTick().catch((err) =>
      logger.warn({ err }, "survey: tick failed"),
    );
  }, INTERVAL_MS);
}
