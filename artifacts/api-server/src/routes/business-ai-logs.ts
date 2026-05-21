import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, whatsappAiLogsTable } from "@workspace/db";
import { requireBusiness } from "../middlewares/business-auth";

const router: IRouter = Router();

// GET /api/business/ai-logs
router.get(
  "/business/ai-logs",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId } = req.businessUser!;

    const rows = await db
      .select()
      .from(whatsappAiLogsTable)
      .where(eq(whatsappAiLogsTable.tenantId, tenantId))
      .orderBy(desc(whatsappAiLogsTable.createdAt))
      .limit(200);

    res.json(
      rows.map((r) => ({
        id: r.id,
        clientPhone: r.clientPhone,
        clientName: r.clientName,
        userMessage: r.userMessage,
        aiReply: r.aiReply ?? null,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
    );
  },
);

export default router;
