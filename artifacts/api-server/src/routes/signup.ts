import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import {
  db,
  tenantsTable,
  subscriptionsTable,
  usersTable,
} from "@workspace/db";
import { uniqueSlug } from "../lib/slugify";

const router: IRouter = Router();

const SignupBody = z.object({
  businessName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  whatsapp: z.string().min(7, "Digite um número de WhatsApp válido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

router.post("/public/signup", async (req, res): Promise<void> => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { businessName, whatsapp, password } = parsed.data;

  const sanitizedPhone = whatsapp.replace(/\D/g, "");
  const email = `${sanitizedPhone}@reservaai.app`;
  const ownerName = businessName.split(" ")[0] ?? businessName;

  const [existingUser] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (existingUser) {
    res.status(409).json({ error: "Número de WhatsApp já cadastrado" });
    return;
  }

  const slug = await uniqueSlug(businessName);
  const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const passwordHash = await bcrypt.hash(password, 12);

  const [tenant] = await db
    .insert(tenantsTable)
    .values({
      name: businessName,
      slug,
      subdomain: slug,
      email,
      phone: whatsapp,
      trialEndsAt,
      onboardingStep: "whatsapp",
      plan: "starter",
      status: "active",
    })
    .returning();

  const [user] = await db
    .insert(usersTable)
    .values({
      tenantId: tenant.id,
      name: ownerName,
      email,
      passwordHash,
      whatsapp,
      role: "owner",
    })
    .returning();

  await db.insert(subscriptionsTable).values({
    tenantId: tenant.id,
    plan: "starter",
    status: "trialing",
    billingCycle: "monthly",
    currency: "BRL",
    startedAt: new Date(),
    expiresAt: trialEndsAt,
  });

  const secret = process.env.SESSION_SECRET ?? "dev-secret-change-me";
  const token = jwt.sign(
    { role: "business", userId: user.id, tenantId: tenant.id },
    secret,
    { expiresIn: "7d" },
  );

  req.log.info({ tenantId: tenant.id, userId: user.id }, "New business signed up");

  res.status(201).json({
    token,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    user: {
      id: user.id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    },
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      subdomain: tenant.subdomain,
      email: tenant.email,
      phone: tenant.phone ?? null,
      plan: tenant.plan,
      status: tenant.status,
      whatsappPhoneNumberId: tenant.whatsappPhoneNumberId ?? null,
      businessType: tenant.businessType ?? null,
      address: tenant.address ?? null,
      openingHours: tenant.openingHours ?? null,
      trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
      onboardingStep: tenant.onboardingStep ?? null,
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.updatedAt.toISOString(),
    },
  });
});

export default router;
