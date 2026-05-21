import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tenantsTable } from "@workspace/db";
import { requireBusiness } from "../middlewares/business-auth";

const router: IRouter = Router();

const GRAPH_API = "https://graph.facebook.com/v19.0";

function getAppConfig() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN ?? "reservaai-webhook";
  const publicUrl =
    process.env.PUBLIC_URL ??
    (process.env.REPLIT_DOMAINS
      ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
      : null);
  return { appId, appSecret, verifyToken, publicUrl };
}

// ---------------------------------------------------------------------------
// GET /business/whatsapp/oauth-config
// Returns the FB App ID and OAuth redirect URI so the frontend can open the
// Embedded Signup popup without exposing the app secret.
// ---------------------------------------------------------------------------

router.get(
  "/business/whatsapp/oauth-config",
  requireBusiness,
  (req, res): void => {
    const { appId, publicUrl } = getAppConfig();

    if (!appId) {
      res.status(503).json({
        error: "META_APP_ID não configurado. Configure nas variáveis de ambiente.",
        configured: false,
      });
      return;
    }

    if (!publicUrl) {
      res.status(503).json({
        error: "PUBLIC_URL ou REPLIT_DOMAINS não configurado.",
        configured: false,
      });
      return;
    }

    const redirectUri = `${publicUrl}/api/business/whatsapp/oauth-callback`;

    res.json({
      configured: true,
      appId,
      redirectUri,
      scope: "whatsapp_business_management,whatsapp_business_messaging,business_management",
    });
  },
);

// ---------------------------------------------------------------------------
// POST /business/whatsapp/oauth-exchange
// Called after the user completes Embedded Signup.
// Receives the short-lived code from the FB SDK, exchanges it for a long-lived
// token, fetches the WABA + phone number list, and stores them.
// ---------------------------------------------------------------------------

router.post(
  "/business/whatsapp/oauth-exchange",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId } = req.businessUser!;
    const body = req.body as {
      code?: string;
      wabaId?: string;
      phoneNumberId?: string;
    };

    const { appId, appSecret, verifyToken, publicUrl } = getAppConfig();

    if (!appId || !appSecret) {
      res.status(503).json({ error: "META_APP_ID / META_APP_SECRET não configurados." });
      return;
    }

    if (!body.code) {
      res.status(400).json({ error: "Código de autorização não fornecido." });
      return;
    }

    const redirectUri = `${publicUrl}/api/business/whatsapp/oauth-callback`;

    try {
      // 1. Exchange code for short-lived user access token
      const tokenUrl = new URL(`${GRAPH_API}/oauth/access_token`);
      tokenUrl.searchParams.set("client_id", appId);
      tokenUrl.searchParams.set("client_secret", appSecret);
      tokenUrl.searchParams.set("redirect_uri", redirectUri ?? "");
      tokenUrl.searchParams.set("code", body.code);

      const tokenResp = await fetch(tokenUrl.toString());
      const tokenData = (await tokenResp.json()) as {
        access_token?: string;
        error?: { message?: string };
      };

      if (!tokenData.access_token) {
        req.log.error({ tokenData }, "Token exchange failed");
        res.status(400).json({
          error: tokenData.error?.message ?? "Falha ao obter token de acesso da Meta.",
        });
        return;
      }

      const shortToken = tokenData.access_token;

      // 2. Exchange short-lived for long-lived system user token
      const longTokenUrl = new URL(`${GRAPH_API}/oauth/access_token`);
      longTokenUrl.searchParams.set("grant_type", "fb_exchange_token");
      longTokenUrl.searchParams.set("client_id", appId);
      longTokenUrl.searchParams.set("client_secret", appSecret);
      longTokenUrl.searchParams.set("fb_exchange_token", shortToken);

      const longResp = await fetch(longTokenUrl.toString());
      const longData = (await longResp.json()) as {
        access_token?: string;
        expires_in?: number;
      };

      const accessToken = longData.access_token ?? shortToken;

      // 3. Get WhatsApp Business Account info
      let wabaId = body.wabaId;
      let phoneNumberId = body.phoneNumberId;
      let displayPhone = "";
      let accountId = wabaId ?? "";

      if (!wabaId) {
        const wabaResp = await fetch(
          `${GRAPH_API}/me/businesses?access_token=${accessToken}`,
        );
        const wabaData = (await wabaResp.json()) as {
          data?: { id: string; name: string }[];
        };
        wabaId = wabaData.data?.[0]?.id;
        accountId = wabaId ?? "";
      }

      // 4. Get phone numbers from WABA
      if (wabaId && !phoneNumberId) {
        const phonesResp = await fetch(
          `${GRAPH_API}/${wabaId}/phone_numbers?access_token=${accessToken}&fields=id,display_phone_number,verified_name`,
        );
        const phonesData = (await phonesResp.json()) as {
          data?: { id: string; display_phone_number: string; verified_name: string }[];
        };
        const firstPhone = phonesData.data?.[0];
        phoneNumberId = firstPhone?.id;
        displayPhone = firstPhone?.display_phone_number ?? "";
      } else if (phoneNumberId) {
        const phoneResp = await fetch(
          `${GRAPH_API}/${phoneNumberId}?fields=display_phone_number,verified_name&access_token=${accessToken}`,
        );
        const phoneData = (await phoneResp.json()) as {
          display_phone_number?: string;
        };
        displayPhone = phoneData.display_phone_number ?? "";
      }

      if (!phoneNumberId) {
        res.status(400).json({
          error: "Nenhum número de WhatsApp Business encontrado nessa conta Meta.",
        });
        return;
      }

      // 5. Register webhook on the WABA
      if (wabaId && publicUrl && verifyToken) {
        try {
          const webhookUrl = `${publicUrl}/api/whatsapp/webhook`;
          await fetch(`${GRAPH_API}/${wabaId}/subscribed_apps`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              callback_url: webhookUrl,
              verify_token: verifyToken,
              subscribed_fields: ["messages"],
            }),
          });
          req.log.info({ tenantId, wabaId }, "Webhook registered on WABA");
        } catch (err) {
          req.log.warn({ err }, "Webhook registration failed — continuing");
        }
      }

      // 6. Persist to DB
      await db
        .update(tenantsTable)
        .set({
          whatsappPhoneNumberId: phoneNumberId,
          whatsappAccessToken: accessToken,
          whatsappAccountId: accountId,
          whatsappPhoneNumber: displayPhone,
          whatsappConnectedAt: new Date(),
          onboardingStep: "complete",
          updatedAt: new Date(),
        })
        .where(eq(tenantsTable.id, tenantId));

      req.log.info({ tenantId, phoneNumberId, displayPhone }, "WhatsApp connected via Embedded Signup");

      res.json({
        success: true,
        phoneNumberId,
        phoneNumber: displayPhone,
        wabaId: accountId,
      });
    } catch (err) {
      req.log.error({ err }, "Meta OAuth exchange failed");
      res.status(502).json({ error: "Erro ao conectar com a Meta. Tente novamente." });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /business/whatsapp/test-message
// Sends a test WhatsApp message to verify the connection is alive.
// ---------------------------------------------------------------------------

router.post(
  "/business/whatsapp/test-message",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId } = req.businessUser!;
    const body = req.body as { to?: string };

    if (!body.to) {
      res.status(400).json({ error: "Número de destino obrigatório." });
      return;
    }

    const [tenant] = await db
      .select({
        whatsappPhoneNumberId: tenantsTable.whatsappPhoneNumberId,
        whatsappAccessToken: tenantsTable.whatsappAccessToken,
        name: tenantsTable.name,
      })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId));

    const phoneNumberId = tenant?.whatsappPhoneNumberId;
    const token =
      tenant?.whatsappAccessToken ??
      process.env.WHATSAPP_TOKEN;

    if (!phoneNumberId || !token) {
      res.status(400).json({
        error: "WhatsApp não conectado. Conecte primeiro para enviar mensagens de teste.",
      });
      return;
    }

    const to = body.to.replace(/\D/g, "");

    try {
      const resp = await fetch(
        `${GRAPH_API}/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: {
              body: `✅ Mensagem de teste do ReservaAI!\n\nSeu WhatsApp está conectado e o bot está ativo para *${tenant?.name ?? "seu negócio"}*.\n\nClientes que enviarem mensagem receberão resposta automática.`,
            },
          }),
        },
      );

      const data = (await resp.json()) as {
        messages?: { id: string }[];
        error?: { message?: string };
      };

      if (!resp.ok || !data.messages?.[0]) {
        req.log.warn({ data }, "Test message failed");
        res.status(400).json({
          error: data.error?.message ?? "Falha ao enviar mensagem. Verifique se o número está correto.",
        });
        return;
      }

      req.log.info({ tenantId, to, messageId: data.messages[0].id }, "Test message sent");
      res.json({ success: true, messageId: data.messages[0].id });
    } catch (err) {
      req.log.error({ err }, "Test message error");
      res.status(502).json({ error: "Erro ao enviar mensagem de teste." });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /business/whatsapp/disconnect
// Removes the WhatsApp connection for this tenant.
// ---------------------------------------------------------------------------

router.post(
  "/business/whatsapp/disconnect",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId } = req.businessUser!;

    await db
      .update(tenantsTable)
      .set({
        whatsappPhoneNumberId: null,
        whatsappAccessToken: null,
        whatsappAccountId: null,
        whatsappPhoneNumber: null,
        whatsappConnectedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(tenantsTable.id, tenantId));

    req.log.info({ tenantId }, "WhatsApp disconnected");
    res.json({ success: true });
  },
);

// ---------------------------------------------------------------------------
// GET /business/whatsapp/status  (replaces the one in business.ts)
// Returns the FULL connection status for the authenticated tenant.
// ---------------------------------------------------------------------------

export default router;
