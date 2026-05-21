import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface BusinessJwtPayload {
  role: "business";
  userId: string;
  tenantId: string;
}

declare global {
  namespace Express {
    interface Request {
      businessUser?: BusinessJwtPayload;
    }
  }
}

export function requireBusiness(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);
  const secret = process.env.SESSION_SECRET ?? "dev-secret-change-me";

  try {
    const payload = jwt.verify(token, secret) as BusinessJwtPayload;
    if (payload.role !== "business") {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    req.businessUser = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
