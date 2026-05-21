import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, satisfactionSurveysTable } from "@workspace/db";
import { requireBusiness } from "../middlewares/business-auth";

const router: IRouter = Router();

// GET /api/business/surveys — full list for the tenant
router.get(
  "/business/surveys",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId } = req.businessUser!;

    const rows = await db
      .select()
      .from(satisfactionSurveysTable)
      .where(eq(satisfactionSurveysTable.tenantId, tenantId))
      .orderBy(desc(satisfactionSurveysTable.createdAt))
      .limit(100);

    res.json(
      rows.map((r) => ({
        id: r.id,
        appointmentId: r.appointmentId,
        clientName: r.clientName,
        clientPhone: r.clientPhone,
        status: r.status,
        sentAt: r.sentAt?.toISOString() ?? null,
        rating: r.rating ?? null,
        comment: r.comment ?? null,
        respondedAt: r.respondedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    );
  },
);

// GET /api/business/surveys/stats — aggregate stats
router.get(
  "/business/surveys/stats",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { tenantId } = req.businessUser!;

    const rows = await db
      .select()
      .from(satisfactionSurveysTable)
      .where(eq(satisfactionSurveysTable.tenantId, tenantId));

    const responded = rows.filter((r) => r.status === "responded" && r.rating !== null);
    const totalResponded = responded.length;
    const totalSent = rows.filter(
      (r) => r.status === "sent" || r.status === "responded",
    ).length;
    const satisfiedCount = responded.filter((r) => (r.rating ?? 0) >= 4).length;
    const avgSum = responded.reduce((s, r) => s + (r.rating ?? 0), 0);
    const averageRating =
      totalResponded > 0
        ? Math.round((avgSum / totalResponded) * 10) / 10
        : null;

    const recentReviews = responded
      .sort(
        (a, b) =>
          (b.respondedAt?.getTime() ?? 0) - (a.respondedAt?.getTime() ?? 0),
      )
      .slice(0, 5)
      .map((r) => ({
        clientName: r.clientName,
        rating: r.rating!,
        comment: r.comment ?? null,
        respondedAt: r.respondedAt!.toISOString(),
      }));

    res.json({
      averageRating,
      totalResponded,
      totalSent,
      totalPending: rows.filter((r) => r.status === "pending_send").length,
      satisfiedCount,
      satisfiedPercent:
        totalResponded > 0
          ? Math.round((satisfiedCount / totalResponded) * 100)
          : 0,
      recentReviews,
    });
  },
);

export default router;
