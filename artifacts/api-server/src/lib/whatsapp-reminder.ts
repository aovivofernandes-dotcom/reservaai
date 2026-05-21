/**
 * whatsapp-reminder.ts
 * Background job: sends WhatsApp reminders 24h before each appointment.
 *
 * Runs every 5 minutes. Finds appointments in the [now+22h, now+26h] window
 * that have no reminder sent yet and whose tenant's WhatsApp is connected.
 *
 * De-duplication: once `reminderSentAt` is set the row is never touched again.
 * If WhatsApp is not connected the appointment stays untouched — the next
 * run will retry automatically.
 *
 * Never throws — all errors are caught and logged.
 */
import { and, between, eq, isNull, notInArray, or } from "drizzle-orm";
import {
  db,
  tenantsTable,
  servicesTable,
  appointmentsTable,
  platformSettingsTable,
} from "@workspace/db";
import { logger } from "./logger";

// ── Helpers (self-contained — no shared state with whatsapp-notify) ────────────

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

function instanceName(tenantId: string): string {
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

function formatBrTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

// ── Core reminder function ─────────────────────────────────────────────────────

async function sendReminder(
  apptId: string,
  clientName: string,
  clientPhone: string,
  scheduledAt: Date,
  tenantName: string,
  tenantId: string,
  serviceName: string | null,
  cfg: { url: string; key: string },
): Promise<void> {
  const phone = normalisePhone(clientPhone);
  if (!phone) {
    logger.warn({ apptId }, "reminder: invalid phone, skipping");
    return;
  }

  const time = formatBrTime(scheduledAt);
  const firstName = clientName.split(" ")[0] ?? clientName;

  const lines: string[] = [
    `Olá, ${firstName}! Passando para lembrar do seu agendamento amanhã na *${tenantName}* ✅`,
    "",
  ];
  if (serviceName) lines.push(`📋 *Serviço:* ${serviceName}`);
  lines.push(`🕐 *Horário:* ${time}`);
  lines.push("");
  lines.push("Até lá!");

  const text = lines.join("\n");
  const instance = instanceName(tenantId);

  const res = await fetch(`${cfg.url}/message/sendText/${instance}`, {
    method: "POST",
    signal: AbortSignal.timeout(12_000),
    headers: {
      "Content-Type": "application/json",
      apikey: cfg.key,
    },
    body: JSON.stringify({ number: phone, text }),
  });

  if (!res.ok) {
    logger.warn({ apptId, status: res.status }, "reminder: Evolution API returned non-OK");
    return;
  }

  // Mark as sent (idempotent — write only after success)
  await db
    .update(appointmentsTable)
    .set({ reminderSentAt: new Date(), updatedAt: new Date() })
    .where(eq(appointmentsTable.id, apptId));

  logger.info({ apptId, phone }, "reminder: sent ✓");
}

// ── Main job tick ──────────────────────────────────────────────────────────────

async function runReminderTick(): Promise<void> {
  // Window: appointments scheduled between now+22h and now+26h
  const windowStart = new Date(Date.now() + 22 * 60 * 60 * 1000);
  const windowEnd   = new Date(Date.now() + 26 * 60 * 60 * 1000);

  // Fetch cfg once per tick (shared across all reminders in this run)
  const cfg = await getEvoCfg();
  if (!cfg.ok) {
    // Evolution API not configured — nothing to do this tick
    return;
  }

  // Single query: appointments + tenant WhatsApp state + service name
  const rows = await db
    .select({
      id: appointmentsTable.id,
      clientName: appointmentsTable.clientName,
      clientPhone: appointmentsTable.clientPhone,
      scheduledAt: appointmentsTable.scheduledAt,
      tenantId: appointmentsTable.tenantId,
      tenantName: tenantsTable.name,
      tenantPhoneId: tenantsTable.whatsappPhoneNumberId,
      serviceName: servicesTable.name,
    })
    .from(appointmentsTable)
    .innerJoin(tenantsTable, eq(appointmentsTable.tenantId, tenantsTable.id))
    .leftJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
    .where(
      and(
        between(appointmentsTable.scheduledAt, windowStart, windowEnd),
        isNull(appointmentsTable.reminderSentAt),
        notInArray(appointmentsTable.status, ["cancelled", "completed"]),
      ),
    );

  if (rows.length === 0) return;

  logger.info({ count: rows.length, windowStart, windowEnd }, "reminder: candidates found");

  for (const row of rows) {
    // Only send if tenant WhatsApp is connected
    if (!row.tenantPhoneId) {
      logger.debug({ apptId: row.id }, "reminder: tenant WhatsApp not connected, skipping");
      continue;
    }

    try {
      await sendReminder(
        row.id,
        row.clientName,
        row.clientPhone,
        row.scheduledAt,
        row.tenantName,
        row.tenantId,
        row.serviceName ?? null,
        cfg,
      );
    } catch (err) {
      logger.warn({ err, apptId: row.id }, "reminder: failed for appointment");
    }
  }
}

// ── Public: start the recurring job ───────────────────────────────────────────

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function startReminderJob(): void {
  logger.info({ intervalMs: INTERVAL_MS }, "reminder: job started");

  // Run immediately on startup, then on interval
  void runReminderTick().catch((err) =>
    logger.warn({ err }, "reminder: initial tick failed"),
  );

  setInterval(() => {
    void runReminderTick().catch((err) =>
      logger.warn({ err }, "reminder: tick failed"),
    );
  }, INTERVAL_MS);
}
