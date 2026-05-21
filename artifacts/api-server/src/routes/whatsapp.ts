import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import {
  db,
  tenantsTable,
  whatsappSessionsTable,
  whatsappMessagesTable,
  onboardingSubmissionsTable,
  type WhatsappSession,
} from "@workspace/db";
import {
  SendWhatsappMessageBody,
  SendWhatsappMessageResponse,
  ListWhatsappSessionsQueryParams,
  ListWhatsappSessionsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function sendWhatsappMessage(
  to: string,
  message: string,
  phoneNumberId: string,
): Promise<{ messageId: string | null; ok: boolean }> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) {
    return { messageId: null, ok: false };
  }

  try {
    const resp = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
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
          text: { body: message },
        }),
      },
    );
    const data = (await resp.json()) as {
      messages?: { id: string }[];
    };
    return { messageId: data.messages?.[0]?.id ?? null, ok: resp.ok };
  } catch {
    return { messageId: null, ok: false };
  }
}

async function processWhatsappFlow(
  session: WhatsappSession,
  incomingText: string,
  phoneNumberId: string,
): Promise<string> {
  const data = (session.sessionData as Record<string, string> | null) ?? {};
  let replyText = "";
  let nextStep = session.flowStep;
  const updatedData = { ...data };

  switch (session.flowStep) {
    case "welcome":
      replyText =
        "Welcome! I'll help you register your business.\n\nWhat is your *business name*?";
      nextStep = "business_name";
      break;

    case "business_name":
      updatedData.businessName = incomingText.trim();
      replyText = `Great! What is your *full name* (contact person)?`;
      nextStep = "contact_name";
      break;

    case "contact_name":
      updatedData.contactName = incomingText.trim();
      replyText = `Thank you, ${updatedData.contactName}! What is your *email address*?`;
      nextStep = "email";
      break;

    case "email":
      updatedData.email = incomingText.trim().toLowerCase();
      replyText = `Perfect! What is your *phone number* (with country code)?`;
      nextStep = "phone";
      break;

    case "phone":
      updatedData.phone = incomingText.trim();
      replyText = `Which *industry* does your business operate in? (e.g. Retail, Healthcare, Technology, etc.)`;
      nextStep = "industry";
      break;

    case "industry":
      updatedData.industry = incomingText.trim();
      replyText = `Almost done! Any *additional notes* or requirements? (Type "none" to skip)`;
      nextStep = "notes";
      break;

    case "notes":
      updatedData.notes =
        incomingText.trim().toLowerCase() === "none"
          ? ""
          : incomingText.trim();

      if (session.tenantId && updatedData.businessName && updatedData.contactName && updatedData.email && updatedData.phone) {
        await db.insert(onboardingSubmissionsTable).values({
          tenantId: session.tenantId,
          businessName: updatedData.businessName,
          contactName: updatedData.contactName,
          email: updatedData.email,
          phone: updatedData.phone,
          industry: updatedData.industry ?? null,
          notes: updatedData.notes || null,
        });
      }

      replyText = `Thank you! Your registration has been submitted successfully. Our team will review it shortly.`;
      nextStep = "complete";
      break;

    case "complete":
      replyText = `Your registration is already submitted. Thank you! Type *restart* to begin a new registration.`;
      if (incomingText.trim().toLowerCase() === "restart") {
        nextStep = "welcome";
      }
      break;

    default:
      replyText = `Welcome! I'll help you register your business. What is your *business name*?`;
      nextStep = "business_name";
  }

  await db
    .update(whatsappSessionsTable)
    .set({
      flowStep: nextStep,
      sessionData: updatedData,
      status: nextStep === "complete" ? "completed" : "active",
      updatedAt: new Date(),
    })
    .where(eq(whatsappSessionsTable.id, session.id));

  await sendWhatsappMessage(session.phone, replyText, phoneNumberId);

  return replyText;
}

router.get("/whatsapp/webhook", async (req, res): Promise<void> => {
  const mode = req.query["hub.mode"] as string | undefined;
  const challenge = req.query["hub.challenge"] as string | undefined;
  const verifyToken = req.query["hub.verify_token"] as string | undefined;

  const expectedToken =
    process.env.WHATSAPP_VERIFY_TOKEN ?? "default-verify-token";

  if (mode === "subscribe" && verifyToken === expectedToken) {
    req.log.info("WhatsApp webhook verified");
    res.status(200).send(challenge);
    return;
  }

  res.status(403).json({ error: "Forbidden" });
});

router.post("/whatsapp/webhook", async (req, res): Promise<void> => {
  res.status(200).json({ status: "ok" });

  try {
    const payload = req.body as {
      object?: string;
      entry?: {
        id?: string;
        changes?: {
          value?: {
            metadata?: { phone_number_id?: string };
            messages?: {
              id?: string;
              from?: string;
              type?: string;
              text?: { body?: string };
            }[];
          };
        }[];
      }[];
    };

    if (payload.object !== "whatsapp_business_account") return;

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        const phoneNumberId = value?.metadata?.phone_number_id ?? "";

        for (const msg of value?.messages ?? []) {
          if (msg.type !== "text" || !msg.from || !msg.text?.body) continue;

          const fromPhone = msg.from;
          const text = msg.text.body;

          const [tenant] = await db
            .select({ id: tenantsTable.id })
            .from(tenantsTable)
            .where(eq(tenantsTable.whatsappPhoneNumberId, phoneNumberId));

          let [session] = await db
            .select()
            .from(whatsappSessionsTable)
            .where(eq(whatsappSessionsTable.phone, fromPhone))
            .orderBy(desc(whatsappSessionsTable.createdAt))
            .limit(1);

          if (!session || session.status === "completed") {
            const [newSession] = await db
              .insert(whatsappSessionsTable)
              .values({
                phone: fromPhone,
                tenantId: tenant?.id ?? null,
                flowStep: "welcome",
                status: "active",
                sessionData: {},
              })
              .returning();
            session = newSession;
          }

          await db.insert(whatsappMessagesTable).values({
            sessionId: session.id,
            direction: "inbound",
            content: text,
            whatsappMessageId: msg.id ?? null,
          });

          await processWhatsappFlow(session, text, phoneNumberId);

          await db.insert(whatsappMessagesTable).values({
            sessionId: session.id,
            direction: "outbound",
            content: `[automated reply for step: ${session.flowStep}]`,
          });
        }
      }
    }
  } catch (err) {
    req.log.error({ err }, "Error processing WhatsApp webhook");
  }
});

router.post("/whatsapp/send", async (req, res): Promise<void> => {
  const parsed = SendWhatsappMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";

  if (parsed.data.tenantId) {
    const [tenant] = await db
      .select({ whatsappPhoneNumberId: tenantsTable.whatsappPhoneNumberId })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, parsed.data.tenantId));
    if (tenant?.whatsappPhoneNumberId) {
      phoneNumberId = tenant.whatsappPhoneNumberId;
    }
  }

  if (!phoneNumberId) {
    res.json(
      SendWhatsappMessageResponse.parse({
        messageId: null,
        status: "no_phone_number_id_configured",
      }),
    );
    return;
  }

  const result = await sendWhatsappMessage(
    parsed.data.to,
    parsed.data.message,
    phoneNumberId,
  );

  res.json(
    SendWhatsappMessageResponse.parse({
      messageId: result.messageId,
      status: result.ok ? "sent" : "failed",
    }),
  );
});

router.get("/whatsapp/sessions", async (req, res): Promise<void> => {
  const queryParams = ListWhatsappSessionsQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  let query = db
    .select()
    .from(whatsappSessionsTable)
    .orderBy(desc(whatsappSessionsTable.createdAt))
    .$dynamic();

  if (queryParams.data.tenantId) {
    query = query.where(
      eq(whatsappSessionsTable.tenantId, queryParams.data.tenantId),
    );
  }

  const sessions = await query.limit(100);

  res.json(
    ListWhatsappSessionsResponse.parse(
      sessions.map((s) => ({
        id: s.id,
        tenantId: s.tenantId ?? null,
        phone: s.phone,
        status: s.status,
        flowStep: s.flowStep,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      })),
    ),
  );
});

export default router;
