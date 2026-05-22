import { Router, type IRouter } from "express";
import { eq, or, isNotNull } from "drizzle-orm";
import { db, platformSettingsTable, tenantsTable } from "@workspace/db";
import { requireAdmin } from "../../middlewares/auth";

const router: IRouter = Router();

async function readEvoConfig() {
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
  return { url, key, fromEnv: !m["evolution_api_url"] && Boolean(process.env.EVOLUTION_API_URL) };
}

// GET /api/admin/whatsapp-config — config + live diagnostics
router.get(
  "/admin/whatsapp-config",
  requireAdmin,
  async (req, res): Promise<void> => {
    const { url, key, fromEnv } = await readEvoConfig();
    const configured = Boolean(url && key);

    let apiOnline = false;
    let instancesCount = 0;

    if (configured) {
      try {
        const r = await fetch(`${url}/instance/fetchInstances`, {
          headers: { apikey: key, "Content-Type": "application/json" },
          signal: AbortSignal.timeout(6000),
        });
        if (r.ok) {
          apiOnline = true;
          const data = (await r.json()) as unknown[];
          instancesCount = Array.isArray(data) ? data.length : 0;
        }
      } catch {
        /* offline */
      }
    }

    const connectedTenants = await db
      .select({
        id: tenantsTable.id,
        name: tenantsTable.name,
        whatsappPhoneNumber: tenantsTable.whatsappPhoneNumber,
        whatsappProfileName: tenantsTable.whatsappProfileName,
        whatsappConnectedAt: tenantsTable.whatsappConnectedAt,
      })
      .from(tenantsTable)
      .where(isNotNull(tenantsTable.whatsappPhoneNumberId));

    res.json({
      url: url || null,
      keyConfigured: Boolean(key),
      fromEnv,
      configured,
      apiOnline,
      instancesCount,
      connectedTenantsCount: connectedTenants.length,
      connectedTenants: connectedTenants.map((t) => ({
        id: t.id,
        name: t.name,
        phone: t.whatsappPhoneNumber ?? null,
        profileName: t.whatsappProfileName ?? null,
        connectedAt: t.whatsappConnectedAt?.toISOString() ?? null,
      })),
    });
  },
);

// ── Automation settings ─────────────────────────────────────────────────────

const AUTOMATION_KEYS = [
  "wa_auto_reply",
  "wa_booking_confirmation",
  "wa_reminder_24h",
  "wa_satisfaction_survey",
] as const;
type AutomationKey = (typeof AUTOMATION_KEYS)[number];

// GET /api/admin/whatsapp-automations
router.get(
  "/admin/whatsapp-automations",
  requireAdmin,
  async (_req, res): Promise<void> => {
    const rows = await db
      .select()
      .from(platformSettingsTable)
      .where(
        or(
          ...AUTOMATION_KEYS.map((k) => eq(platformSettingsTable.key, k)),
        ),
      );
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value === "true"]));
    res.json({
      autoReply: map["wa_auto_reply"] ?? true,
      bookingConfirmation: map["wa_booking_confirmation"] ?? true,
      reminder24h: map["wa_reminder_24h"] ?? true,
      satisfactionSurvey: map["wa_satisfaction_survey"] ?? false,
    });
  },
);

// PATCH /api/admin/whatsapp-automations
router.patch(
  "/admin/whatsapp-automations",
  requireAdmin,
  async (req, res): Promise<void> => {
    const body = req.body as { key?: string; value?: boolean };
    if (!body.key || !AUTOMATION_KEYS.includes(body.key as AutomationKey)) {
      res.status(400).json({ error: "Invalid key" });
      return;
    }
    const val = body.value ? "true" : "false";
    await db
      .insert(platformSettingsTable)
      .values({ key: body.key, value: val })
      .onConflictDoUpdate({
        target: platformSettingsTable.key,
        set: { value: val, updatedAt: new Date() },
      });
    req.log.info({ key: body.key, value: val }, "WhatsApp automation updated");
    res.json({ success: true });
  },
);

// PUT /api/admin/whatsapp-config — persist URL + API key
router.put(
  "/admin/whatsapp-config",
  requireAdmin,
  async (req, res): Promise<void> => {
    const body = req.body as { url?: string; key?: string };

    if (body.url !== undefined) {
      const val = body.url.trim().replace(/\/$/, "");
      await db
        .insert(platformSettingsTable)
        .values({ key: "evolution_api_url", value: val })
        .onConflictDoUpdate({
          target: platformSettingsTable.key,
          set: { value: val, updatedAt: new Date() },
        });
    }

    if (body.key !== undefined && body.key.trim() !== "") {
      const val = body.key.trim();
      await db
        .insert(platformSettingsTable)
        .values({ key: "evolution_api_key", value: val })
        .onConflictDoUpdate({
          target: platformSettingsTable.key,
          set: { value: val, updatedAt: new Date() },
        });
    }

    req.log.info("WhatsApp platform config updated");
    res.json({ success: true });
  },
);

export default router;
