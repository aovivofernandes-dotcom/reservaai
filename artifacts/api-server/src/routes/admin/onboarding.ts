import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import {
  db,
  onboardingSubmissionsTable,
  type OnboardingSubmission,
} from "@workspace/db";
import {
  ListOnboardingSubmissionsParams,
  ListOnboardingSubmissionsResponse,
  UpdateOnboardingSubmissionParams,
  UpdateOnboardingSubmissionBody,
  UpdateOnboardingSubmissionResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../../middlewares/auth";

const router: IRouter = Router();

function toSubmissionResponse(s: OnboardingSubmission) {
  return {
    id: s.id,
    tenantId: s.tenantId,
    businessName: s.businessName,
    contactName: s.contactName,
    email: s.email,
    phone: s.phone,
    address: s.address ?? null,
    industry: s.industry ?? null,
    notes: s.notes ?? null,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

router.get(
  "/admin/tenants/:tenantId/onboarding",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = ListOnboardingSubmissionsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const submissions = await db
      .select()
      .from(onboardingSubmissionsTable)
      .where(eq(onboardingSubmissionsTable.tenantId, params.data.tenantId))
      .orderBy(desc(onboardingSubmissionsTable.createdAt));

    res.json(
      ListOnboardingSubmissionsResponse.parse(
        submissions.map(toSubmissionResponse),
      ),
    );
  },
);

router.patch(
  "/admin/onboarding/:submissionId",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = UpdateOnboardingSubmissionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdateOnboardingSubmissionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [submission] = await db
      .update(onboardingSubmissionsTable)
      .set({
        status: parsed.data.status as OnboardingSubmission["status"],
        updatedAt: new Date(),
      })
      .where(eq(onboardingSubmissionsTable.id, params.data.submissionId))
      .returning();

    if (!submission) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }

    req.log.info(
      { submissionId: submission.id, status: submission.status },
      "Onboarding submission updated",
    );
    res.json(
      UpdateOnboardingSubmissionResponse.parse(
        toSubmissionResponse(submission),
      ),
    );
  },
);

export default router;
