import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { AdminLoginBody, BusinessLoginBody } from "@workspace/api-zod";
import { requireBusiness } from "../middlewares/business-auth";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    req.log.error("ADMIN_PASSWORD env var is not set");
    res.status(500).json({ error: "Server misconfiguration" });
    return;
  }

  if (parsed.data.password !== adminPassword) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const secret = process.env.SESSION_SECRET ?? "dev-secret-change-me";
  const token = jwt.sign({ role: "admin" }, secret, { expiresIn: "24h" });
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  req.log.info("Admin logged in");
  res.json({ token, expiresAt });
});

router.post("/auth/logout", async (_req, res): Promise<void> => {
  res.sendStatus(204);
});

router.post("/auth/business-login", async (req, res): Promise<void> => {
  const parsed = BusinessLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, parsed.data.email.toLowerCase()));

  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const secret = process.env.SESSION_SECRET ?? "dev-secret-change-me";
  const token = jwt.sign(
    { role: "business", userId: user.id, tenantId: user.tenantId },
    secret,
    { expiresIn: "7d" },
  );
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  req.log.info({ userId: user.id }, "Business user logged in");
  res.json({
    token,
    expiresAt,
    user: {
      id: user.id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.get(
  "/auth/business-me",
  requireBusiness,
  async (req, res): Promise<void> => {
    const { userId } = req.businessUser!;

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      id: user.id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    });
  },
);

router.post("/auth/business-logout", async (_req, res): Promise<void> => {
  res.sendStatus(204);
});

export default router;
