import { Router, type IRouter, type Request } from "express";
import { eq, and } from "drizzle-orm";
import { db, tenantsTable, servicesTable } from "@workspace/db";
import { generateOgPng } from "../lib/og-image";

const router: IRouter = Router();

// Bot User-Agents used by WhatsApp, Telegram, Facebook, Twitter, Slack, Discord, LinkedIn…
const BOT_RE =
  /facebookexternalhit|FacebookBot|WhatsApp|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot|Pinterestbot|Applebot|bingbot|Googlebot|DuckDuckBot|Baiduspider|YandexBot|SemrushBot|AhrefsBot|ia_archiver/i;

function isBot(req: Request): boolean {
  return BOT_RE.test(req.get("user-agent") ?? "");
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Returns the canonical public origin for this deployment.
 *
 * Priority:
 *  1. REPLIT_DOMAINS env var (most reliable in production — always HTTPS public domain)
 *  2. x-forwarded-proto + host headers (works behind most reverse proxies)
 *  3. Hardcoded https fallback
 */
function getPublicOrigin(req: Request): string {
  const replitDomains = process.env.REPLIT_DOMAINS;
  if (replitDomains) {
    const primary = replitDomains.split(",")[0]?.trim();
    if (primary) return `https://${primary}`;
  }
  const proto = req.get("x-forwarded-proto") ?? req.protocol ?? "https";
  const host = req.get("host") ?? "localhost";
  return `${proto}://${host}`;
}

// ── Shared HTML builder ────────────────────────────────────────────────────────
// Used by both /share/:slug and /onboard/:slug (for bots).

interface TenantShareData {
  name: string;
  slug: string;
  businessType: string | null;
  description: string | null;
  logoUrl: string | null;
  updatedAt: Date;
}

interface ShareService {
  name: string;
}

function buildShareHtml(
  tenant: TenantShareData,
  services: ShareService[],
  origin: string,
): string {
  const businessName = tenant.name;
  const initial = businessName.charAt(0).toUpperCase();
  const businessType = tenant.businessType ?? "Agendamento online";
  const description = tenant.description ?? "";
  const logoUrl = tenant.logoUrl ?? "";
  const slug = tenant.slug;

  const bookingUrl = `${origin}/onboard/${slug}`;
  const shareUrl = `${origin}/share/${slug}`;
  const imgVer = tenant.updatedAt.getTime();
  const imageUrl = `${origin}/og/${slug}.png?v=${imgVer}`;

  const servicesDesc =
    services.length > 0 ? services.map((s) => s.name).join(", ") : null;

  const ogTitle = `${businessName} — Agende seu horário`;
  const ogDescription = description
    ? `${description}. Agendamento rápido e fácil.`
    : servicesDesc
      ? `${servicesDesc}. Agendamento rápido e fácil, sem precisar ligar.`
      : `Agende com ${businessName} de forma rápida e fácil.`;

  const logoHtml = logoUrl
    ? `<div class="logo-wrap"><img src="${logoUrl}" alt="${esc(businessName)}" class="logo-img"/></div>`
    : `<div class="logo-placeholder">${initial}</div>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(ogTitle)} | ReservaAI</title>
  <meta name="description" content="${esc(ogDescription)}">
  <meta http-equiv="refresh" content="0; url=${bookingUrl}">

  <!-- Open Graph (WhatsApp, Facebook, Telegram, LinkedIn…) -->
  <meta property="og:site_name" content="ReservaAI">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${shareUrl}">
  <meta property="og:title" content="${esc(ogTitle)}">
  <meta property="og:description" content="${esc(ogDescription)}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:secure_url" content="${imageUrl}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(businessName)}">
  <meta property="og:locale" content="pt_BR">

  <!-- Twitter card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(ogTitle)}">
  <meta name="twitter:description" content="${esc(ogDescription)}">
  <meta name="twitter:image" content="${imageUrl}">

  <!-- Favicon -->
  <link rel="icon" href="${imageUrl}" type="image/png">

  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      background:#f5f3ff;min-height:100vh;display:flex;align-items:center;
      justify-content:center;padding:24px}
    .card{background:#fff;border-radius:24px;padding:32px 24px;
      max-width:360px;width:100%;text-align:center;
      box-shadow:0 8px 48px rgba(124,58,237,.14)}
    .logo-wrap{width:80px;height:80px;border-radius:22px;overflow:hidden;
      margin:0 auto 16px;box-shadow:0 4px 20px rgba(124,58,237,.22)}
    .logo-img{width:100%;height:100%;object-fit:cover;display:block}
    .logo-placeholder{width:80px;height:80px;border-radius:22px;
      background:linear-gradient(135deg,#7c3aed,#5b21b6);
      display:flex;align-items:center;justify-content:center;
      margin:0 auto 16px;color:#fff;font-weight:800;font-size:30px;
      box-shadow:0 4px 20px rgba(124,58,237,.38)}
    h1{color:#111827;font-size:20px;font-weight:800;margin-bottom:4px;line-height:1.25}
    .type{color:#7c3aed;font-size:11px;font-weight:700;text-transform:uppercase;
      letter-spacing:.07em;margin-bottom:${description ? "10px" : "20px"}}
    .desc{color:#6b7280;font-size:13px;line-height:1.55;margin-bottom:16px}
    .services{background:#f5f3ff;border-radius:12px;padding:10px 14px;
      margin-bottom:20px;text-align:left}
    .slabel{color:#7c3aed;font-size:10px;font-weight:800;
      text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px}
    .services li{color:#374151;font-size:13px;list-style:none;
      padding:4px 0;border-bottom:1px solid #ede9fe}
    .services li:last-child{border:none}
    .btn{display:block;background:linear-gradient(135deg,#7c3aed,#5b21b6);
      color:#fff;padding:14px 28px;border-radius:14px;text-decoration:none;
      font-weight:800;font-size:14px;box-shadow:0 4px 18px rgba(124,58,237,.38)}
    .brand{color:#d1d5db;font-size:11px;margin-top:14px;font-weight:500}
  </style>
</head>
<body>
  <script>window.location.replace("${bookingUrl}");</script>
  <div class="card">
    ${logoHtml}
    <h1>${esc(businessName)}</h1>
    <p class="type">${esc(businessType)}</p>
    ${description ? `<p class="desc">${esc(description)}</p>` : ""}
    ${
      services.length > 0
        ? `<div class="services">
      <p class="slabel">Serviços</p>
      <ul>${services.map((s) => `<li>${esc(s.name)}</li>`).join("")}</ul>
    </div>`
        : ""
    }
    <a class="btn" href="${bookingUrl}">Agendar agora →</a>
    <p class="brand">Powered by ReservaAI</p>
  </div>
</body>
</html>`;
}

// ── Helper: fetch tenant + services by slug ────────────────────────────────────
async function fetchTenantData(slug: string) {
  const [tenant] = await db
    .select({
      id: tenantsTable.id,
      name: tenantsTable.name,
      slug: tenantsTable.slug,
      businessType: tenantsTable.businessType,
      description: tenantsTable.description,
      logoUrl: tenantsTable.logoUrl,
      updatedAt: tenantsTable.updatedAt,
    })
    .from(tenantsTable)
    .where(eq(tenantsTable.slug, slug));

  if (!tenant) return null;

  const services = await db
    .select({ name: servicesTable.name })
    .from(servicesTable)
    .where(
      and(
        eq(servicesTable.tenantId, tenant.id),
        eq(servicesTable.isActive, true),
      ),
    )
    .limit(5);

  return { tenant, services };
}

// ── Dynamic OG image per business — PNG 1200×630 ─────────────────────────────

router.get(
  "/og/:slug.png",
  async (req, res): Promise<void> => {
    const { slug } = req.params as { slug: string };

    const [tenant] = await db
      .select({
        name: tenantsTable.name,
        description: tenantsTable.description,
        logoUrl: tenantsTable.logoUrl,
      })
      .from(tenantsTable)
      .where(eq(tenantsTable.slug, slug));

    const png = generateOgPng(
      tenant?.name ?? "Seu negócio",
      tenant?.description ?? undefined,
      tenant?.logoUrl ?? undefined,
    );

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
    res.send(png);
  },
);

// ── /share/:slug — canonical shareable URL with OG meta tags ─────────────────
// Crawlers (WhatsApp, Telegram, Facebook…) read OG from this URL.
// Human browsers are immediately JS-redirected to /onboard/:slug.

router.get(
  "/share/:slug",
  async (req, res): Promise<void> => {
    const { slug } = req.params as { slug: string };

    const data = await fetchTenantData(slug);
    if (!data) {
      res.status(404).send("<h1>Empresa não encontrada</h1>");
      return;
    }

    const origin = getPublicOrigin(req);
    const html = buildShareHtml(data.tenant, data.services, origin);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    // Short cache: bots re-scrape and get fresh OG image URL after logo change
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
    res.send(html);
  },
);

// ── /onboard/:slug — booking page entry point ─────────────────────────────────
// When WhatsApp/Telegram/Facebook bots visit this URL (because it's what
// users copy from the browser address bar), they get full OG meta tags.
// Regular browsers are passed through to the SPA unchanged via a 302.

router.get(
  "/onboard/:slug",
  async (req, res): Promise<void> => {
    const { slug } = req.params as { slug: string };

    if (!isBot(req)) {
      // Let the SPA (dashboard) handle it — don't intercept real users
      res.setHeader("Cache-Control", "no-store");
      res.redirect(302, `/onboard/${slug}`);
      return;
    }

    // Bot detected — serve OG-enriched HTML so WhatsApp can build a rich preview
    const data = await fetchTenantData(slug);
    if (!data) {
      res.status(404).send("<h1>Empresa não encontrada</h1>");
      return;
    }

    const origin = getPublicOrigin(req);
    const html = buildShareHtml(data.tenant, data.services, origin);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
    res.send(html);
  },
);

export default router;
