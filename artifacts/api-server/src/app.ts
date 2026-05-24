import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import shareRouter from "./routes/share";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// ── Health routes at ROOT level (no /api prefix) ──────────────────────────
// Railway and other platforms probe these paths directly.
// They must respond 200 immediately, even if the DB is down.
app.get(["/health", "/healthz"], (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// ── Clean share/og URLs at root level (no /api prefix) ────────────────────
// /share/:slug  → social share page with OG meta tags
// /og/:slug.png → dynamic OG image per business
app.use(shareRouter);

// ── All other API routes under /api ───────────────────────────────────────
app.use("/api", router);

export default app;
