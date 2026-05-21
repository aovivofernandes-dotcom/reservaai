/**
 * evolution-webhook.ts
 * Handles ALL incoming WhatsApp messages from the Evolution API.
 *
 * Priority per message:
 *   1. Active cancel/reschedule session  → continue that flow
 *   2. Cancel/reschedule intent detected → start new flow
 *   3. AI assistant                      → answer common questions
 *   4. Open satisfaction survey          → capture rating / comment
 *   5. Otherwise                         → ignore
 */
import { Router, type IRouter } from "express";
import { and, desc, eq, gt, isNotNull, lt, or } from "drizzle-orm";
import OpenAI from "openai";
import {
  db,
  tenantsTable,
  satisfactionSurveysTable,
  platformSettingsTable,
  clientConversationSessionsTable,
  appointmentsTable,
  servicesTable,
  whatsappAiLogsTable,
} from "@workspace/db";

const router: IRouter = Router();

// ── OpenAI client (lazy init) ──────────────────────────────────────────────────
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (_openai) return _openai;
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  _openai = new OpenAI({ apiKey: key });
  return _openai;
}

// ── Constants ──────────────────────────────────────────────────────────────────
// Brazil is UTC-3 (no DST since 2019)
const BRAZIL_UTC_OFFSET_H = 3;
// Work hours in Brazil local time
const WORK_START_H = 8;
const WORK_END_H = 18;
const SESSION_TTL_MS = 30 * 60 * 1000;

// ── Helpers ────────────────────────────────────────────────────────────────────

function evoInstance(tenantId: string): string {
  return `reservaai_${tenantId.replace(/[^a-z0-9]/gi, "").slice(0, 20)}`;
}

function normalisePhone(raw: string): string {
  return raw.replace(/\D/g, "").replace(/@.*/, "");
}

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

async function sendReply(
  cfg: { url: string; key: string },
  instance: string,
  phone: string,
  text: string,
): Promise<void> {
  await fetch(`${cfg.url}/message/sendText/${instance}`, {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { "Content-Type": "application/json", apikey: cfg.key },
    body: JSON.stringify({ number: phone, text }),
  }).catch(() => null);
}

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function detectIntent(text: string): "cancel" | "reschedule" | null {
  const lower = stripAccents(text.toLowerCase());
  const cancelWords = [
    "cancelar", "cancela", "cancelo", "cancelamento",
    "desmarcar", "desmarco", "desmarca",
    "nao quero mais", "nao vou", "nao consigo ir",
  ];
  const rescheduleWords = [
    "reagendar", "reagendo", "reagendamento",
    "remarcar", "remarca",
    "mudar horario", "trocar horario", "outro horario",
    "mudar data", "trocar data", "outra data",
    "outra hora", "outro dia", "novo horario",
  ];
  if (cancelWords.some((w) => lower.includes(w))) return "cancel";
  if (rescheduleWords.some((w) => lower.includes(w))) return "reschedule";
  return null;
}

function isYes(text: string): boolean {
  const t = stripAccents(text.toLowerCase().trim());
  return ["sim", "s", "yes", "y", "confirmar", "confirmo", "ok", "pode", "isso", "claro"].includes(t);
}

function isNo(text: string): boolean {
  const t = stripAccents(text.toLowerCase().trim());
  return ["nao", "n", "no", "nope", "voltar", "nao quero", "cancela"].includes(t);
}

/** Parse DD/MM or DD/MM/YYYY → Date (Brazil local midnight) */
function parseDate(text: string): Date | null {
  const match = text.trim().match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const rawYear = match[3];
  const year = rawYear
    ? rawYear.length === 2 ? 2000 + parseInt(rawYear, 10) : parseInt(rawYear, 10)
    : new Date().getFullYear();
  if (day < 1 || day > 31 || month < 0 || month > 11) return null;
  // Store as UTC midnight of that Brazil date (Brazil midnight = UTC 03:00)
  const d = new Date(Date.UTC(year, month, day, BRAZIL_UTC_OFFSET_H, 0, 0, 0));
  if (isNaN(d.getTime())) return null;
  return d;
}

/** Format a UTC timestamp as Brazil date label */
function fmtDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
    timeZone: "America/Sao_Paulo",
  });
}

/** Format a UTC timestamp as Brazil time HH:MM */
function fmtTime(d: Date): string {
  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

/** Today's date label in Brazil PT */
function todayDateLabel(): string {
  return new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

/**
 * Generate available slot strings (HH:MM in Brazil local time)
 * for a given day (represented as UTC 03:00 of the Brazil date).
 */
async function generateSlots(
  tenantId: string,
  brazilDayUtc: Date,   // UTC midnight of Brazil date (= 03:00 UTC)
  durationMin: number,
): Promise<string[]> {
  const effectiveDuration = Math.max(30, durationMin);

  // Day window in UTC: Brazil 00:00-23:59 = UTC 03:00-26:59 (next day 02:59)
  const windowStart = new Date(brazilDayUtc);                            // UTC 03:00
  const windowEnd = new Date(brazilDayUtc.getTime() + 24 * 60 * 60 * 1000); // UTC 03:00 +24h

  // Fetch existing appointments (non-cancelled) for this tenant on this day
  const existing = await db
    .select({ scheduledAt: appointmentsTable.scheduledAt })
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.tenantId, tenantId),
        gt(appointmentsTable.scheduledAt, windowStart),
        lt(appointmentsTable.scheduledAt, windowEnd),
        or(
          eq(appointmentsTable.status, "pending"),
          eq(appointmentsTable.status, "confirmed"),
        ),
      ),
    );

  const existingMs = existing.map((e) => e.scheduledAt.getTime());
  const nowMs = Date.now();
  const slots: string[] = [];

  // Generate Brazil local slots WORK_START_H..WORK_END_H
  for (
    let brazilMinutes = WORK_START_H * 60;
    brazilMinutes + effectiveDuration <= WORK_END_H * 60;
    brazilMinutes += effectiveDuration
  ) {
    // Convert Brazil local minutes → UTC timestamp
    const brazilH = Math.floor(brazilMinutes / 60);
    const brazilM = brazilMinutes % 60;
    const slotUtcMs =
      brazilDayUtc.getTime() +                       // UTC 03:00 of the day
      (brazilH - 0) * 60 * 60 * 1000 +               // add Brazil hours (from 00:00)
      brazilM * 60 * 1000;

    // Don't offer past slots
    if (slotUtcMs <= nowMs + 60_000) continue;

    // Check for conflicts (within effectiveDuration window)
    const conflict = existingMs.some(
      (t) => Math.abs(t - slotUtcMs) < effectiveDuration * 60 * 1000,
    );
    if (!conflict) {
      slots.push(
        `${String(brazilH).padStart(2, "0")}:${String(brazilM).padStart(2, "0")}`,
      );
    }
  }

  return slots;
}

// ── Session data shape ─────────────────────────────────────────────────────────

interface SessionData {
  appointmentId: string;
  clientName: string;
  serviceName: string;
  serviceId?: string | null;
  durationMinutes?: number;
  originalScheduledAt?: string;
  selectedDate?: string;   // ISO string of UTC 03:00 of the Brazil date
  slots?: string[];
  selectedSlot?: string;
}

// ── Flow: cancel ───────────────────────────────────────────────────────────────

async function startCancelFlow(
  tenantId: string, clientPhone: string, clientName: string,
  cfg: { url: string; key: string; ok: boolean }, instance: string,
): Promise<void> {
  const [appt] = await db
    .select({
      id: appointmentsTable.id,
      scheduledAt: appointmentsTable.scheduledAt,
      serviceName: servicesTable.name,
    })
    .from(appointmentsTable)
    .leftJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
    .where(
      and(
        eq(appointmentsTable.tenantId, tenantId),
        eq(appointmentsTable.clientPhone, clientPhone),
        gt(appointmentsTable.scheduledAt, new Date()),
        or(eq(appointmentsTable.status, "pending"), eq(appointmentsTable.status, "confirmed")),
      ),
    )
    .orderBy(appointmentsTable.scheduledAt)
    .limit(1);

  if (!appt) {
    if (cfg.ok) await sendReply(cfg, instance, clientPhone, "Não encontrei agendamentos futuros para cancelar. 😊");
    return;
  }

  const data: SessionData = {
    appointmentId: appt.id,
    clientName,
    serviceName: appt.serviceName ?? "Atendimento",
    originalScheduledAt: appt.scheduledAt.toISOString(),
  };

  // Replace any existing session for this phone + tenant
  await db.delete(clientConversationSessionsTable).where(
    and(
      eq(clientConversationSessionsTable.tenantId, tenantId),
      eq(clientConversationSessionsTable.clientPhone, clientPhone),
    ),
  );
  await db.insert(clientConversationSessionsTable).values({
    tenantId, clientPhone, step: "cancel_confirm",
    data: data as unknown as Record<string, unknown>,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });

  if (cfg.ok) {
    await sendReply(cfg, instance, clientPhone,
      `Deseja cancelar este agendamento?\n\n*${data.serviceName}*\n📅 ${fmtDate(appt.scheduledAt)} às ${fmtTime(appt.scheduledAt)}\n\nResponda *SIM* para cancelar ou *NÃO* para manter.`,
    );
  }
}

async function processCancelConfirm(
  session: typeof clientConversationSessionsTable.$inferSelect,
  text: string,
  cfg: { url: string; key: string; ok: boolean }, instance: string,
): Promise<void> {
  const data = session.data as unknown as SessionData;
  const { clientPhone, tenantId } = session;

  if (isYes(text)) {
    await db.update(appointmentsTable)
      .set({
        status: "cancelled",
        notes: `[Cancelado via WhatsApp em ${todayDateLabel()}]`,
        updatedAt: new Date(),
      })
      .where(eq(appointmentsTable.id, data.appointmentId));

    await db.delete(clientConversationSessionsTable)
      .where(eq(clientConversationSessionsTable.id, session.id));

    if (cfg.ok) {
      await sendReply(cfg, instance, clientPhone,
        "✅ Seu agendamento foi cancelado com sucesso.\n\nEsperamos te ver em breve! 😊",
      );
    }
  } else if (isNo(text)) {
    await db.delete(clientConversationSessionsTable)
      .where(eq(clientConversationSessionsTable.id, session.id));

    if (cfg.ok) {
      await sendReply(cfg, instance, clientPhone, "👍 Ok! Seu agendamento foi mantido.");
    }
  } else {
    if (cfg.ok) {
      await sendReply(cfg, instance, clientPhone,
        "Por favor, responda *SIM* para cancelar ou *NÃO* para manter o agendamento.",
      );
    }
  }
}

// ── Flow: reschedule ───────────────────────────────────────────────────────────

async function startRescheduleFlow(
  tenantId: string, clientPhone: string, clientName: string,
  cfg: { url: string; key: string; ok: boolean }, instance: string,
): Promise<void> {
  const [appt] = await db
    .select({
      id: appointmentsTable.id,
      scheduledAt: appointmentsTable.scheduledAt,
      serviceId: appointmentsTable.serviceId,
      serviceName: servicesTable.name,
      durationMinutes: servicesTable.durationMinutes,
    })
    .from(appointmentsTable)
    .leftJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
    .where(
      and(
        eq(appointmentsTable.tenantId, tenantId),
        eq(appointmentsTable.clientPhone, clientPhone),
        gt(appointmentsTable.scheduledAt, new Date()),
        or(eq(appointmentsTable.status, "pending"), eq(appointmentsTable.status, "confirmed")),
      ),
    )
    .orderBy(appointmentsTable.scheduledAt)
    .limit(1);

  if (!appt) {
    if (cfg.ok) await sendReply(cfg, instance, clientPhone, "Não encontrei agendamentos futuros para reagendar. 😊");
    return;
  }

  const data: SessionData = {
    appointmentId: appt.id,
    clientName,
    serviceName: appt.serviceName ?? "Atendimento",
    serviceId: appt.serviceId,
    durationMinutes: appt.durationMinutes ?? 60,
    originalScheduledAt: appt.scheduledAt.toISOString(),
  };

  await db.delete(clientConversationSessionsTable).where(
    and(
      eq(clientConversationSessionsTable.tenantId, tenantId),
      eq(clientConversationSessionsTable.clientPhone, clientPhone),
    ),
  );
  await db.insert(clientConversationSessionsTable).values({
    tenantId, clientPhone, step: "reschedule_date",
    data: data as unknown as Record<string, unknown>,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });

  if (cfg.ok) {
    await sendReply(cfg, instance, clientPhone,
      `Para reagendar *${data.serviceName}*, qual a nova data?\n\nEnvie no formato *DD/MM* (ex: 15/07) 📅`,
    );
  }
}

async function processRescheduleDate(
  session: typeof clientConversationSessionsTable.$inferSelect,
  text: string,
  cfg: { url: string; key: string; ok: boolean }, instance: string,
): Promise<void> {
  const data = session.data as unknown as SessionData;
  const { clientPhone, tenantId } = session;

  const date = parseDate(text);
  if (!date) {
    if (cfg.ok) await sendReply(cfg, instance, clientPhone, "Data inválida. Envie no formato *DD/MM* (ex: 15/07) 📅");
    return;
  }

  // Date must be today or future (in Brazil timezone)
  const nowBrazilMs = Date.now() - BRAZIL_UTC_OFFSET_H * 3_600_000;
  const todayBrazilStart = new Date(nowBrazilMs);
  todayBrazilStart.setUTCHours(0, 0, 0, 0);
  if (date.getTime() < todayBrazilStart.getTime()) {
    if (cfg.ok) await sendReply(cfg, instance, clientPhone, "Por favor, escolha uma data de hoje em diante. 📅");
    return;
  }

  const durationMinutes = data.durationMinutes ?? 60;
  const slots = await generateSlots(tenantId, date, durationMinutes);

  if (slots.length === 0) {
    const lbl = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" });
    if (cfg.ok) {
      await sendReply(cfg, instance, clientPhone,
        `Não há horários disponíveis em ${lbl}. Tente outra data (envie DD/MM). 📅`,
      );
    }
    return;
  }

  const displaySlots = slots.slice(0, 8);
  const slotList = displaySlots.map((s, i) => `${i + 1}. ${s}`).join("\n");
  const dateLbl = date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" });

  await db.update(clientConversationSessionsTable)
    .set({
      step: "reschedule_slot",
      data: { ...data, selectedDate: date.toISOString(), slots: displaySlots } as unknown as Record<string, unknown>,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      updatedAt: new Date(),
    })
    .where(eq(clientConversationSessionsTable.id, session.id));

  if (cfg.ok) {
    await sendReply(cfg, instance, clientPhone,
      `Horários disponíveis em *${dateLbl}*:\n\n${slotList}\n\nEscolha um número (1 a ${displaySlots.length}):`,
    );
  }
}

async function processRescheduleSlot(
  session: typeof clientConversationSessionsTable.$inferSelect,
  text: string,
  cfg: { url: string; key: string; ok: boolean }, instance: string,
): Promise<void> {
  const data = session.data as unknown as SessionData;
  const { clientPhone } = session;
  const slots = data.slots ?? [];

  const choice = parseInt(text.trim(), 10);
  if (isNaN(choice) || choice < 1 || choice > slots.length) {
    if (cfg.ok) await sendReply(cfg, instance, clientPhone, `Por favor, escolha um número entre 1 e ${slots.length}.`);
    return;
  }

  const selectedSlot = slots[choice - 1]!;
  const date = new Date(data.selectedDate!);
  const dateLbl = date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" });

  await db.update(clientConversationSessionsTable)
    .set({
      step: "reschedule_confirm",
      data: { ...data, selectedSlot } as unknown as Record<string, unknown>,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      updatedAt: new Date(),
    })
    .where(eq(clientConversationSessionsTable.id, session.id));

  if (cfg.ok) {
    await sendReply(cfg, instance, clientPhone,
      `Confirmar reagendamento?\n\n*${data.serviceName}*\n📅 ${dateLbl} às ${selectedSlot}\n\nResponda *SIM* para confirmar ou *NÃO* para escolher outro horário.`,
    );
  }
}

async function processRescheduleConfirm(
  session: typeof clientConversationSessionsTable.$inferSelect,
  text: string,
  cfg: { url: string; key: string; ok: boolean }, instance: string,
): Promise<void> {
  const data = session.data as unknown as SessionData;
  const { clientPhone, tenantId } = session;

  if (isYes(text)) {
    // Parse new UTC timestamp from Brazil slot
    const brazilDayUtc = new Date(data.selectedDate!);
    const [h, m] = (data.selectedSlot ?? "09:00").split(":").map(Number);
    const newScheduledAt = new Date(
      brazilDayUtc.getTime() + (h ?? 9) * 3_600_000 + (m ?? 0) * 60_000,
    );

    const [original] = await db
      .select({
        clientName: appointmentsTable.clientName,
        clientPhone: appointmentsTable.clientPhone,
        clientEmail: appointmentsTable.clientEmail,
        serviceId: appointmentsTable.serviceId,
      })
      .from(appointmentsTable)
      .where(eq(appointmentsTable.id, data.appointmentId));

    if (original) {
      const dateLabel = todayDateLabel();
      // Cancel the original
      await db.update(appointmentsTable)
        .set({
          status: "cancelled",
          notes: `[Reagendado via WhatsApp em ${dateLabel}]`,
          updatedAt: new Date(),
        })
        .where(eq(appointmentsTable.id, data.appointmentId));

      // Create new appointment
      await db.insert(appointmentsTable).values({
        tenantId,
        clientName: original.clientName,
        clientPhone: original.clientPhone,
        clientEmail: original.clientEmail,
        serviceId: original.serviceId,
        scheduledAt: newScheduledAt,
        status: "confirmed",
        notes: `[Reagendado via WhatsApp em ${dateLabel}]`,
      });
    }

    await db.delete(clientConversationSessionsTable)
      .where(eq(clientConversationSessionsTable.id, session.id));

    if (cfg.ok) {
      const newDateLbl = newScheduledAt.toLocaleDateString("pt-BR", {
        weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo",
      });
      await sendReply(cfg, instance, clientPhone,
        `✅ Reagendamento confirmado!\n\n*${data.serviceName}*\n📅 ${newDateLbl} às ${data.selectedSlot}\n\nTe esperamos! 😊`,
      );
    }
  } else if (isNo(text)) {
    // Step back to slot selection for the same date
    const date = new Date(data.selectedDate!);
    const slots = await generateSlots(tenantId, date, data.durationMinutes ?? 60);
    const displaySlots = slots.slice(0, 8);

    if (displaySlots.length === 0) {
      // Go all the way back to date selection
      await db.update(clientConversationSessionsTable)
        .set({
          step: "reschedule_date",
          data: { ...data, selectedDate: undefined, slots: undefined, selectedSlot: undefined } as unknown as Record<string, unknown>,
          expiresAt: new Date(Date.now() + SESSION_TTL_MS),
          updatedAt: new Date(),
        })
        .where(eq(clientConversationSessionsTable.id, session.id));

      if (cfg.ok) await sendReply(cfg, instance, clientPhone, "Envie a nova data desejada no formato *DD/MM* 📅");
      return;
    }

    const dateLbl = date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" });
    const slotList = displaySlots.map((s, i) => `${i + 1}. ${s}`).join("\n");

    await db.update(clientConversationSessionsTable)
      .set({
        step: "reschedule_slot",
        data: { ...data, slots: displaySlots, selectedSlot: undefined } as unknown as Record<string, unknown>,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        updatedAt: new Date(),
      })
      .where(eq(clientConversationSessionsTable.id, session.id));

    if (cfg.ok) {
      await sendReply(cfg, instance, clientPhone,
        `Horários disponíveis em *${dateLbl}*:\n\n${slotList}\n\nEscolha um número:`,
      );
    }
  } else {
    if (cfg.ok) {
      await sendReply(cfg, instance, clientPhone,
        "Por favor, responda *SIM* para confirmar ou *NÃO* para escolher outro horário.",
      );
    }
  }
}

// ── Logger type (pino-http req.log) ───────────────────────────────────────────
type Logger = { info: (obj: object, msg?: string) => void; error: (obj: object, msg?: string) => void };

// ── AI assistant ───────────────────────────────────────────────────────────────

/**
 * Try to answer the client's message using GPT.
 * Returns true if the AI handled the message (reply sent or error logged).
 * Returns false if AI is unavailable (key missing) — flow continues to survey step.
 */
async function handleAiMessage(
  tenantId: string,
  clientPhone: string,
  clientName: string,
  userText: string,
  cfg: { url: string; key: string; ok: boolean },
  instance: string,
  log: Logger,
): Promise<boolean> {
  const ai = getOpenAI();
  if (!ai) return false; // No key configured — skip AI

  // Load tenant info
  const [tenant] = await db
    .select({
      name: tenantsTable.name,
      businessType: tenantsTable.businessType,
      description: tenantsTable.description,
      address: tenantsTable.address,
      city: tenantsTable.city,
      openingHours: tenantsTable.openingHours,
      phone: tenantsTable.phone,
      website: tenantsTable.website,
      instagram: tenantsTable.instagram,
      slug: tenantsTable.slug,
    })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, tenantId))
    .limit(1);

  if (!tenant) return false;

  // Load active services
  const services = await db
    .select({
      name: servicesTable.name,
      description: servicesTable.description,
      price: servicesTable.price,
      durationMinutes: servicesTable.durationMinutes,
    })
    .from(servicesTable)
    .where(and(eq(servicesTable.tenantId, tenantId), eq(servicesTable.isActive, true)));

  // Build booking link
  const domains = process.env.REPLIT_DOMAINS?.split(",")[0] ?? "";
  const bookingLink = domains ? `https://${domains}/agendar/${tenant.slug}` : `/agendar/${tenant.slug}`;

  // Build service list string
  const serviceLines = services.length > 0
    ? services.map((s) =>
        `- ${s.name}${s.description ? ` (${s.description})` : ""}: R$ ${Number(s.price).toFixed(2).replace(".", ",")} | ${s.durationMinutes}min`,
      ).join("\n")
    : "Nenhum serviço cadastrado ainda.";

  const systemPrompt = `Você é o assistente virtual do WhatsApp de *${tenant.name}*${tenant.businessType ? ` (${tenant.businessType})` : ""}.
Seu objetivo é responder dúvidas comuns dos clientes de forma simpática, clara e profissional, e sempre incentivar o agendamento.

INFORMAÇÕES DA EMPRESA:
- Nome: ${tenant.name}
${tenant.description ? `- Descrição: ${tenant.description}` : ""}
${tenant.address ? `- Endereço: ${tenant.address}${tenant.city ? `, ${tenant.city}` : ""}` : ""}
${tenant.openingHours ? `- Horário de funcionamento: ${tenant.openingHours}` : ""}
${tenant.phone ? `- Telefone/WhatsApp: ${tenant.phone}` : ""}
${tenant.website ? `- Site: ${tenant.website}` : ""}
${tenant.instagram ? `- Instagram: ${tenant.instagram}` : ""}
- Link de agendamento: ${bookingLink}

SERVIÇOS DISPONÍVEIS:
${serviceLines}

REGRAS OBRIGATÓRIAS:
1. NUNCA invente preços, serviços ou horários que não estejam listados acima.
2. Se não souber responder com certeza, diga: "Para mais informações, entre em contato com nossa equipe."
3. Sempre mantenha tom educado, amigável e profissional.
4. Sempre que possível, incentive o cliente a agendar pelo link: ${bookingLink}
5. Seja conciso — respostas curtas e diretas funcionam melhor no WhatsApp.
6. Use emojis com moderação para deixar a conversa mais amigável.
7. Se o cliente quiser cancelar ou reagendar, diga que ele pode escrever "cancelar" ou "reagendar" neste chat.
8. Responda sempre em português do Brasil.`;

  let aiReply: string | null = null;
  let status: "answered_by_ai" | "waiting_human" | "error" = "answered_by_ai";

  try {
    const completion = await ai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 400,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText },
      ],
    });

    aiReply = completion.choices[0]?.message?.content?.trim() ?? null;

    if (!aiReply) {
      status = "waiting_human";
      aiReply = null;
    }
  } catch (err) {
    log.error({ err }, "ai: OpenAI call failed");
    status = "error";
  }

  // Log to DB regardless of outcome
  await db.insert(whatsappAiLogsTable).values({
    tenantId,
    clientPhone,
    clientName,
    userMessage: userText,
    aiReply,
    status,
  }).catch(() => null);

  // Send reply if we have one
  if (aiReply && cfg.ok) {
    await sendReply(cfg, instance, clientPhone, aiReply);
  }

  // Return true even on error so survey step isn't triggered for AI conversations
  return true;
}

// ── Main webhook ───────────────────────────────────────────────────────────────

router.post("/evolution/webhook", async (req, res): Promise<void> => {
  res.status(200).json({ ok: true });

  try {
    const payload = req.body as {
      event?: string;
      instance?: string;
      data?: {
        key?: { remoteJid?: string; fromMe?: boolean; id?: string };
        pushName?: string;
        message?: {
          conversation?: string;
          extendedTextMessage?: { text?: string };
        };
      };
    };

    if (payload.event !== "messages.upsert") return;
    if (payload.data?.key?.fromMe) return;

    const remoteJid = payload.data?.key?.remoteJid ?? "";
    if (!remoteJid || remoteJid.endsWith("@g.us")) return;

    const senderPhone = normalisePhone(remoteJid);
    if (!senderPhone) return;

    const text =
      payload.data?.message?.conversation?.trim() ??
      payload.data?.message?.extendedTextMessage?.text?.trim() ??
      "";
    if (!text) return;

    const instanceName = payload.instance ?? "";
    if (!instanceName) return;

    // ── Find tenant by instance name ─────────────────────────────────────────
    const connectedTenants = await db
      .select({ id: tenantsTable.id, name: tenantsTable.name })
      .from(tenantsTable)
      .where(isNotNull(tenantsTable.whatsappPhoneNumberId));

    const tenant = connectedTenants.find((t) => evoInstance(t.id) === instanceName);
    if (!tenant) return;

    const cfg = await getEvoCfg();
    const clientName = payload.data?.pushName ?? senderPhone;

    // ── Purge expired sessions ───────────────────────────────────────────────
    await db.delete(clientConversationSessionsTable)
      .where(lt(clientConversationSessionsTable.expiresAt, new Date()))
      .catch(() => null);

    // ── 1. Check for active cancel/reschedule session ────────────────────────
    const [activeSession] = await db
      .select()
      .from(clientConversationSessionsTable)
      .where(
        and(
          eq(clientConversationSessionsTable.tenantId, tenant.id),
          eq(clientConversationSessionsTable.clientPhone, senderPhone),
        ),
      )
      .limit(1);

    if (activeSession) {
      req.log.info({ step: activeSession.step, phone: senderPhone }, "conv: active session");
      switch (activeSession.step) {
        case "cancel_confirm":
          await processCancelConfirm(activeSession, text, cfg, instanceName);
          break;
        case "reschedule_date":
          await processRescheduleDate(activeSession, text, cfg, instanceName);
          break;
        case "reschedule_slot":
          await processRescheduleSlot(activeSession, text, cfg, instanceName);
          break;
        case "reschedule_confirm":
          await processRescheduleConfirm(activeSession, text, cfg, instanceName);
          break;
      }
      return;
    }

    // ── 2. Detect cancel/reschedule intent ───────────────────────────────────
    const intent = detectIntent(text);
    if (intent === "cancel") {
      req.log.info({ phone: senderPhone }, "conv: cancel intent");
      await startCancelFlow(tenant.id, senderPhone, clientName, cfg, instanceName);
      return;
    }
    if (intent === "reschedule") {
      req.log.info({ phone: senderPhone }, "conv: reschedule intent");
      await startRescheduleFlow(tenant.id, senderPhone, clientName, cfg, instanceName);
      return;
    }

    // ── 3. AI assistant ──────────────────────────────────────────────────────
    {
      const aiHandled = await handleAiMessage(
        tenant.id, senderPhone, clientName, text, cfg, instanceName, req.log as Logger,
      );
      if (aiHandled) return;
    }

    // ── 4. Satisfaction survey ───────────────────────────────────────────────
    const [survey] = await db
      .select()
      .from(satisfactionSurveysTable)
      .where(
        and(
          eq(satisfactionSurveysTable.tenantId, tenant.id),
          eq(satisfactionSurveysTable.clientPhone, senderPhone),
          or(
            eq(satisfactionSurveysTable.status, "sent"),
            eq(satisfactionSurveysTable.status, "responded"),
          ),
        ),
      )
      .orderBy(desc(satisfactionSurveysTable.sentAt))
      .limit(1);

    if (!survey) return;

    const firstName = survey.clientName.split(" ")[0] ?? survey.clientName;

    if (survey.status === "sent") {
      const rating = parseInt(text, 10);
      if (!isNaN(rating) && rating >= 1 && rating <= 5) {
        await db.update(satisfactionSurveysTable)
          .set({ rating, status: "responded", respondedAt: new Date(), updatedAt: new Date() })
          .where(eq(satisfactionSurveysTable.id, survey.id));

        req.log.info({ surveyId: survey.id, rating }, "survey: rating received");

        if (cfg.ok) {
          const reply =
            rating >= 4
              ? `Muito obrigado, ${firstName}! Ficamos felizes que tenha gostado! 🎉\n\nQuer deixar um comentário? (opcional — responda esta mensagem)`
              : `Obrigado pelo feedback, ${firstName}! Vamos trabalhar para melhorar. 🙏\n\nQuer nos contar o que podemos melhorar? (opcional)`;
          await sendReply(cfg, instanceName, senderPhone, reply);
        }
      } else {
        if (cfg.ok) {
          await sendReply(cfg, instanceName, senderPhone,
            `Olá, ${firstName}! Por favor, responda com um número de *1 a 5* para avaliar seu atendimento. 😊`,
          );
        }
      }
      return;
    }

    if (survey.status === "responded" && !survey.comment) {
      const withinWindow =
        survey.respondedAt &&
        Date.now() - survey.respondedAt.getTime() < 2 * 60 * 60 * 1000;

      if (withinWindow) {
        await db.update(satisfactionSurveysTable)
          .set({ comment: text, updatedAt: new Date() })
          .where(eq(satisfactionSurveysTable.id, survey.id));

        req.log.info({ surveyId: survey.id }, "survey: comment saved");

        if (cfg.ok) {
          await sendReply(cfg, instanceName, senderPhone,
            `Obrigado pelo comentário, ${firstName}! Até a próxima! 😊`,
          );
        }
      }
    }
  } catch (err) {
    req.log.error({ err }, "evolution-webhook: unhandled error");
  }
});

export default router;
