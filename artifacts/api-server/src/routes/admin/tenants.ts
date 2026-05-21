import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, tenantsTable, type Tenant } from "@workspace/db";
import {
  CreateTenantBody,
  GetTenantParams,
  GetTenantResponse,
  UpdateTenantParams,
  UpdateTenantBody,
  UpdateTenantResponse,
  DeleteTenantParams,
  ListTenantsResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../../middlewares/auth";
import { uniqueSlug } from "../../lib/slugify";

const router: IRouter = Router();

function toTenantResponse(t: Tenant) {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    subdomain: t.subdomain,
    email: t.email,
    phone: t.phone ?? null,
    plan: t.plan,
    status: t.status,
    whatsappPhoneNumberId: t.whatsappPhoneNumberId ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

router.get("/admin/tenants", requireAdmin, async (_req, res): Promise<void> => {
  const tenants = await db
    .select()
    .from(tenantsTable)
    .orderBy(desc(tenantsTable.createdAt));
  res.json(ListTenantsResponse.parse(tenants.map(toTenantResponse)));
});

router.post(
  "/admin/tenants",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = CreateTenantBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const slug = await uniqueSlug(parsed.data.name);
    const subdomain = slug;

    const [tenant] = await db
      .insert(tenantsTable)
      .values({
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone ?? null,
        plan: (parsed.data.plan as Tenant["plan"]) ?? "free",
        slug,
        subdomain,
        whatsappPhoneNumberId: parsed.data.whatsappPhoneNumberId ?? null,
      })
      .returning();

    req.log.info({ tenantId: tenant.id }, "Tenant created");
    res.status(201).json(GetTenantResponse.parse(toTenantResponse(tenant)));
  },
);

router.get(
  "/admin/tenants/:tenantId",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = GetTenantParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [tenant] = await db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.id, params.data.tenantId));

    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    res.json(GetTenantResponse.parse(toTenantResponse(tenant)));
  },
);

router.patch(
  "/admin/tenants/:tenantId",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = UpdateTenantParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdateTenantBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const updates: Partial<typeof tenantsTable.$inferInsert> = {};
    if (parsed.data.name != null) updates.name = parsed.data.name;
    if (parsed.data.email != null) updates.email = parsed.data.email;
    if (parsed.data.phone != null) updates.phone = parsed.data.phone;
    if (parsed.data.plan != null)
      updates.plan = parsed.data.plan as Tenant["plan"];
    if (parsed.data.status != null)
      updates.status = parsed.data.status as Tenant["status"];
    if (parsed.data.whatsappPhoneNumberId != null)
      updates.whatsappPhoneNumberId = parsed.data.whatsappPhoneNumberId;
    updates.updatedAt = new Date();

    const [tenant] = await db
      .update(tenantsTable)
      .set(updates)
      .where(eq(tenantsTable.id, params.data.tenantId))
      .returning();

    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    res.json(UpdateTenantResponse.parse(toTenantResponse(tenant)));
  },
);

router.delete(
  "/admin/tenants/:tenantId",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = DeleteTenantParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [deleted] = await db
      .delete(tenantsTable)
      .where(eq(tenantsTable.id, params.data.tenantId))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    req.log.info({ tenantId: params.data.tenantId }, "Tenant deleted");
    res.sendStatus(204);
  },
);

export default router;
