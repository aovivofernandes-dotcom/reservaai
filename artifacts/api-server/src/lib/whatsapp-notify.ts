/**
 * whatsapp-notify.ts
 * Fire-and-forget WhatsApp confirmation message for new appointments.
 * Never throws — all errors are caught and recorded on the appointment row.
 */
import { eq, or } from "drizzle-orm";
import {
  db,
  tenantsTable,
  servicesTable,
  appointmentsTable,
  platformSettingsTable,
} from "@workspace/db";

// ── Evolution API config (DB-first, env fallback) ──────────────────────────────

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

// ── Helpers ────────────────────────────────────────────────────────────────────

function instanceName(tenantId: string): string {
  return `reservaai_${tenantId.replace(/[^a-z0-9]/gi, "").slice(0, 20)}`;
}

/**
 * Normalises a Brazilian phone number to Evolution API format:
 * pure digits, with country code 55 prepended if absent.
 * Returns null if the result is implausible.
 */
function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;
  // Already has country code 55
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  // Starts with local 0 (old BR format)
  const stripped = digits.startsWith("0") ? digits.slice(1) : digits;
  // 10-11 digit local number → prepend 55
  if (stripped.length >= 10 && stripped.length <= 11) return `55${stripped}`;
  // Already has 55 but short — still prepend just in case length is ok
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

function formatBrDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

function formatBrTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Sends a WhatsApp confirmation message to the client.
 * Must be called AFTER the appointment row is already committed.
 * Updates `whatsappStatus` on the appointment row to reflect the outcome.
 * Never rejects — safe to call with void.
 */
export async function sendAppointmentConfirmation(
  appointmentId: string,
): Promise<void> {
  try {
    // ── 1. Fetch appointment + tenant + service in parallel ──────────────────
    const [apptRows, cfg] = await Promise.all([
      db
        .select({
          id: appointmentsTable.id,
          tenantId: appointmentsTable.tenantId,
          clientName: appointmentsTable.clientName,
          clientPhone: appointmentsTable.clientPhone,
          scheduledAt: appointmentsTable.scheduledAt,
          serviceId: appointmentsTable.serviceId,
        })
        .from(appointmentsTable)
        .where(eq(appointmentsTable.id, appointmentId))
        .limit(1),
      getEvoCfg(),
    ]);

    const appt = apptRows[0];
    if (!appt) return; // appointment disappeared — nothing to do

    // ── 2. Fetch tenant and service concurrently ─────────────────────────────
    const [tenantRows, serviceRows] = await Promise.all([
      db
        .select({
          name: tenantsTable.name,
          whatsappPhoneNumberId: tenantsTable.whatsappPhoneNumberId,
        })
        .from(tenantsTable)
        .where(eq(tenantsTable.id, appt.tenantId))
        .limit(1),
      appt.serviceId
        ? db
            .select({ name: servicesTable.name })
            .from(servicesTable)
            .where(eq(servicesTable.id, appt.serviceId))
            .limit(1)
        : Promise.resolve([]),
    ]);

    const tenant = tenantRows[0];
    const serviceName = serviceRows[0]?.name ?? null;

    // ── 3. Check WhatsApp connection ─────────────────────────────────────────
    const isConnected = Boolean(tenant?.whatsappPhoneNumberId);

    if (!isConnected || !cfg.ok) {
      await db
        .update(appointmentsTable)
        .set({ whatsappStatus: "not_connected", updatedAt: new Date() })
        .where(eq(appointmentsTable.id, appointmentId));
      return;
    }

    // ── 4. Normalise client phone ────────────────────────────────────────────
    const phone = normalisePhone(appt.clientPhone);
    if (!phone) {
      await db
        .update(appointmentsTable)
        .set({ whatsappStatus: "error", updatedAt: new Date() })
        .where(eq(appointmentsTable.id, appointmentId));
      return;
    }

    // ── 5. Build message ─────────────────────────────────────────────────────
    const date = formatBrDate(appt.scheduledAt);
    const time = formatBrTime(appt.scheduledAt);
    const firstName = appt.clientName.split(" ")[0] ?? appt.clientName;
    const businessName = tenant!.name;

    const lines: string[] = [
      `Olá, ${firstName}! Seu agendamento na *${businessName}* foi recebido ✅`,
      "",
    ];
    if (serviceName) lines.push(`📋 *Serviço:* ${serviceName}`);
    lines.push(`📅 *Data:* ${date}`);
    lines.push(`🕐 *Horário:* ${time}`);
    lines.push("");
    lines.push("Em breve confirmaremos seu atendimento.");

    const text = lines.join("\n");

    // ── 6. Send via Evolution API ────────────────────────────────────────────
    const instance = instanceName(appt.tenantId);
    const sendRes = await fetch(
      `${cfg.url}/message/sendText/${instance}`,
      {
        method: "POST",
        signal: AbortSignal.timeout(12_000),
        headers: {
          "Content-Type": "application/json",
          apikey: cfg.key,
        },
        body: JSON.stringify({ number: phone, text }),
      },
    );

    const newStatus = sendRes.ok ? "sent" : "error";
    await db
      .update(appointmentsTable)
      .set({ whatsappStatus: newStatus, updatedAt: new Date() })
      .where(eq(appointmentsTable.id, appointmentId));
  } catch {
    // Best-effort update — ignore further errors
    try {
      await db
        .update(appointmentsTable)
        .set({ whatsappStatus: "error", updatedAt: new Date() })
        .where(eq(appointmentsTable.id, appointmentId));
    } catch {
      // swallow
    }
  }
}
