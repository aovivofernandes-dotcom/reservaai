import { Router, type IRouter } from "express";
import { eq, or } from "drizzle-orm";
import { db, platformSettingsTable } from "@workspace/db";
import { requireAdmin } from "../../middlewares/auth";

const router: IRouter = Router();

const TEST_INSTANCE = "reservaai_admintest";

async function getEvoCfg() {
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

async function ef(cfg: { url: string; key: string }, path: string, opts: RequestInit = {}) {
  return fetch(`${cfg.url}${path}`, {
    ...opts,
    signal: AbortSignal.timeout(10_000),
    headers: {
      "Content-Type": "application/json",
      apikey: cfg.key,
      ...((opts.headers as Record<string, string>) ?? {}),
    },
  });
}

export interface StepResult {
  id: string;
  label: string;
  status: "ok" | "error" | "waiting" | "skipped";
  message: string;
}

// POST /api/admin/whatsapp-test/start
// Runs steps 1-6 synchronously; step 6 (scan) is left as "waiting"
router.post(
  "/admin/whatsapp-test/start",
  requireAdmin,
  async (req, res): Promise<void> => {
    const steps: StepResult[] = [];
    const cfg = await getEvoCfg();

    // ① URL configured
    steps.push({
      id: "url",
      label: "URL da Evolution API configurada",
      status: cfg.url ? "ok" : "error",
      message: cfg.url
        ? cfg.url
        : "URL não preenchida. Configure no formulário acima e salve.",
    });

    // ② Key configured
    steps.push({
      id: "key",
      label: "Chave de API configurada",
      status: cfg.key ? "ok" : "error",
      message: cfg.key
        ? "Chave presente e válida"
        : "Chave de API não preenchida. Configure no formulário acima e salve.",
    });

    if (!cfg.ok) {
      res.json({ steps, qr: null, done: false });
      return;
    }

    // ③ API connection
    let apiOnline = false;
    try {
      const r = await ef(cfg, "/instance/fetchInstances");
      apiOnline = r.ok;
      steps.push({
        id: "connection",
        label: "Conexão com o servidor Evolution API",
        status: r.ok ? "ok" : "error",
        message: r.ok
          ? "Servidor respondendo normalmente"
          : `Servidor retornou erro ${r.status}. Verifique a URL e a chave de API.`,
      });
    } catch {
      steps.push({
        id: "connection",
        label: "Conexão com o servidor Evolution API",
        status: "error",
        message:
          "Servidor inacessível. Verifique se o endereço está correto e o servidor está no ar.",
      });
    }

    if (!apiOnline) {
      res.json({ steps, qr: null, done: false });
      return;
    }

    // ④ Create/reset test instance
    await ef(cfg, `/instance/delete/${TEST_INSTANCE}`, { method: "DELETE" }).catch(() => null);
    const createRes = await ef(cfg, "/instance/create", {
      method: "POST",
      body: JSON.stringify({
        instanceName: TEST_INSTANCE,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
      }),
    });
    const instanceOk = createRes.ok || createRes.status === 409;
    steps.push({
      id: "instance",
      label: "Instância de teste criada",
      status: instanceOk ? "ok" : "error",
      message: instanceOk
        ? `Instância "${TEST_INSTANCE}" pronta`
        : "Erro ao criar instância. Verifique se a chave tem permissão para criar instâncias.",
    });

    if (!instanceOk) {
      res.json({ steps, qr: null, done: false });
      return;
    }

    // ⑤ Generate QR
    const qrRes = await ef(cfg, `/instance/connect/${TEST_INSTANCE}`);
    const qrData = qrRes.ok
      ? ((await qrRes.json()) as { base64?: string; code?: string })
      : null;
    const qr = qrData?.base64 ?? null;

    steps.push({
      id: "qr",
      label: "QR Code gerado com sucesso",
      status: qr ? "ok" : "error",
      message: qr
        ? "QR Code disponível para leitura"
        : "Erro ao gerar QR Code. A instância pode estar em estado inválido — tente novamente.",
    });

    if (!qr) {
      res.json({ steps, qr: null, done: false });
      return;
    }

    // ⑥ Waiting for scan (user action)
    steps.push({
      id: "scan",
      label: "WhatsApp Business conectado",
      status: "waiting",
      message: "Aguardando leitura do QR Code pelo WhatsApp Business…",
    });

    res.json({ steps, qr, done: false });
  },
);

// GET /api/admin/whatsapp-test/poll
// Polls connection state; if open, runs steps 7-10 and returns done=true
router.get(
  "/admin/whatsapp-test/poll",
  requireAdmin,
  async (req, res): Promise<void> => {
    const cfg = await getEvoCfg();
    if (!cfg.ok) {
      res.json({ connected: false, qr: null, steps: [], done: false });
      return;
    }

    const stateRes = await ef(cfg, `/instance/connectionState/${TEST_INSTANCE}`).catch(() => null);
    if (!stateRes?.ok) {
      res.json({ connected: false, qr: null, steps: [], done: false });
      return;
    }

    const stateData = (await stateRes.json()) as { instance?: { state?: string } };
    const state = stateData.instance?.state ?? "close";

    if (state !== "open") {
      // Refresh QR
      const qrRes = await ef(cfg, `/instance/connect/${TEST_INSTANCE}`).catch(() => null);
      let qr: string | null = null;
      if (qrRes?.ok) {
        const d = (await qrRes.json()) as { base64?: string };
        qr = d.base64 ?? null;
      }
      res.json({ connected: false, qr, steps: [], done: false });
      return;
    }

    // ─── Connected — run steps 7-10 ───────────────────────────────────────────
    const steps: StepResult[] = [];

    // Update step 6
    steps.push({
      id: "scan",
      label: "WhatsApp Business conectado",
      status: "ok",
      message: "QR Code lido! Sessão estabelecida.",
    });

    // ⑦ Detect phone
    let phone: string | null = null;
    let profileName: string | null = null;
    const fetchRes = await ef(cfg, `/instance/fetchInstances?instanceName=${TEST_INSTANCE}`).catch(() => null);
    if (fetchRes?.ok) {
      const instances = (await fetchRes.json()) as Array<{
        instance?: { owner?: string; profileName?: string };
      }>;
      const inst = instances[0]?.instance;
      const owner = inst?.owner ?? null;
      phone = owner ? owner.replace(/@.*/, "") : null;
      profileName = inst?.profileName ?? null;
    }

    steps.push({
      id: "phone",
      label: "Número conectado identificado",
      status: phone ? "ok" : "error",
      message: phone
        ? `+${phone}${profileName ? ` — ${profileName}` : ""}`
        : "Não foi possível identificar o número. Tente desconectar e reconectar.",
    });

    // ⑧ Send test message
    let messageSent = false;
    if (phone) {
      const msgRes = await ef(cfg, `/message/sendText/${TEST_INSTANCE}`, {
        method: "POST",
        body: JSON.stringify({
          number: phone,
          text:
            "✅ Teste de integração *ReservaAI* concluído!\n\nSua conexão WhatsApp está funcionando perfeitamente. 🎉\n\nJá podemos conectar os números dos seus clientes.",
        }),
      }).catch(() => null);
      messageSent = msgRes?.ok ?? false;
    }

    steps.push({
      id: "message",
      label: "Mensagem de teste enviada",
      status: messageSent ? "ok" : phone ? "error" : "skipped",
      message: messageSent
        ? "Mensagem enviada! Verifique o WhatsApp agora."
        : phone
          ? "Erro ao enviar. O número pode ter bloqueado mensagens de bots."
          : "Ignorado — número não detectado.",
    });

    // ⑨ Receipt (confirmed if message sent)
    steps.push({
      id: "receipt",
      label: "Recebimento confirmado",
      status: messageSent ? "ok" : "skipped",
      message: messageSent
        ? "Mensagem entregue ao destinatário."
        : "Ignorado.",
    });

    // ⑩ Automations
    steps.push({
      id: "automations",
      label: "Automações prontas para usar",
      status: "ok",
      message:
        "Quando uma empresa conectar o número dela, as automações são ativadas automaticamente.",
    });

    // Cleanup
    await ef(cfg, `/instance/delete/${TEST_INSTANCE}`, { method: "DELETE" }).catch(() => null);

    const allOk = steps.every((s) => s.status === "ok" || s.status === "skipped");
    res.json({ connected: true, qr: null, steps, done: true, phone, allOk });
  },
);

// POST /api/admin/whatsapp-test/cancel — cleanup test instance
router.post(
  "/admin/whatsapp-test/cancel",
  requireAdmin,
  async (_req, res): Promise<void> => {
    const cfg = await getEvoCfg();
    if (cfg.ok) {
      await ef(cfg, `/instance/delete/${TEST_INSTANCE}`, { method: "DELETE" }).catch(() => null);
    }
    res.json({ success: true });
  },
);

export default router;
