import { Resvg } from "@resvg/resvg-js";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ── Full-bleed logo layout ─────────────────────────────────────────────────────
// Used when the business has uploaded a logo/photo.
// The logo fills the entire 1200×630 canvas (xMidYMid slice = smart center-crop).
// A vignette gradient is layered on top to make white text legible at the bottom.
function buildLogoSvg(
  businessName: string,
  description: string | undefined,
  logoDataUri: string,
): string {
  const len = businessName.length;
  const display = len > 32 ? businessName.slice(0, 30) + "…" : businessName;
  const safeDisplay = escapeXml(display);

  // Scale font so long names never overflow 1200px canvas
  const nameFontSize = len > 26 ? 54 : len > 18 ? 66 : len > 10 ? 78 : 90;

  const descText = description
    ? description.length > 82
      ? description.slice(0, 80) + "…"
      : description
    : "Agendamento online";
  const safeDesc = escapeXml(descText);

  // Text sits in the lower 38% of the image (~240 px of dark gradient)
  const nameY = 488;
  const descY  = 558;

  return `<svg width="1200" height="630" viewBox="0 0 1200 630"
     xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <!-- Bottom vignette: transparent in the middle, dark at bottom (and slight top) -->
    <linearGradient id="vign" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#000" stop-opacity="0.34"/>
      <stop offset="28%"  stop-color="#000" stop-opacity="0.00"/>
      <stop offset="50%"  stop-color="#000" stop-opacity="0.00"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.84"/>
    </linearGradient>
  </defs>

  <!-- Full-bleed photo: xMidYMid slice = centered smart-crop, no distortion -->
  <image x="0" y="0" width="1200" height="630"
         href="${logoDataUri}"
         preserveAspectRatio="xMidYMid slice"/>

  <!-- Vignette overlay so white text is always readable -->
  <rect width="1200" height="630" fill="url(#vign)"/>

  <!-- ReservaAI brand badge — top-left pill -->
  <rect x="36" y="28" width="162" height="40" rx="20"
        fill="rgba(0,0,0,0.58)"/>
  <text x="117" y="48"
        font-family="Arial, Helvetica, sans-serif"
        font-size="17" font-weight="700"
        fill="white" text-anchor="middle" dominant-baseline="middle">ReservaAI</text>

  <!-- Purple "Agendar" badge — top-right pill -->
  <rect x="988" y="28" width="176" height="40" rx="20"
        fill="rgba(124,58,237,0.88)"/>
  <text x="1076" y="48"
        font-family="Arial, Helvetica, sans-serif"
        font-size="17" font-weight="700"
        fill="white" text-anchor="middle" dominant-baseline="middle">Agendar agora</text>

  <!-- Business name — large, white, bold -->
  <text x="60" y="${nameY}"
        font-family="Arial Black, Arial, Helvetica, sans-serif"
        font-size="${nameFontSize}" font-weight="900"
        fill="white">${safeDisplay}</text>

  <!-- Description or "Agendamento online" fallback -->
  <text x="60" y="${descY}"
        font-family="Arial, Helvetica, sans-serif"
        font-size="30" font-weight="500"
        fill="rgba(255,255,255,0.86)">${safeDesc}</text>
</svg>`;
}

// ── Purple brand banner layout ─────────────────────────────────────────────────
// Used when the business has NOT uploaded a logo.
// Premium purple gradient with decorative elements + text on the left.
function buildPurpleSvg(
  businessName: string,
  description?: string,
): string {
  const len = businessName.length;
  const display = len > 30 ? businessName.slice(0, 28) + "…" : businessName;
  const safeDisplay = escapeXml(display);

  const nameFontSize = len > 26 ? 52 : len > 18 ? 62 : len > 12 ? 74 : 86;

  const descText = description
    ? description.length > 90
      ? description.slice(0, 88) + "…"
      : description
    : null;
  const safeDesc = descText ? escapeXml(descText) : null;

  const initial = businessName.charAt(0).toUpperCase();

  const hasDesc = !!safeDesc;
  const nameY = hasDesc ? 295 : 320 + (88 - nameFontSize) / 2;
  const descY = 395;
  const taglineY = hasDesc ? 458 : 410;
  const ctaY    = hasDesc ? 498 : 470;

  return `<svg width="1200" height="630" viewBox="0 0 1200 630"
     xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#6d28d9"/>
      <stop offset="100%" stop-color="#3b0764"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0%"   stop-color="#ffffff" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.05"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Decorative blobs -->
  <circle cx="1100" cy="80"  r="280" fill="white" fill-opacity="0.05"/>
  <circle cx="80"   cy="580" r="200" fill="white" fill-opacity="0.05"/>
  <circle cx="1160" cy="600" r="120" fill="white" fill-opacity="0.06"/>

  <!-- Card background -->
  <rect x="56" y="56" width="1088" height="518" rx="36" fill="url(#card)"/>

  <!-- Initial placeholder (letter in rounded square) -->
  <rect x="96" y="88" width="64" height="64" rx="18" fill="white" fill-opacity="0.22"/>
  <text x="128" y="138"
        font-family="Arial Black, Arial, Helvetica, sans-serif"
        font-size="36" font-weight="900"
        fill="white" text-anchor="middle">${initial}</text>

  <!-- Brand label -->
  <text x="176" y="140"
        font-family="Arial, Helvetica, sans-serif"
        font-size="24" font-weight="700"
        fill="rgba(255,255,255,0.88)"
        dominant-baseline="middle">ReservaAI</text>

  <!-- "Agendamento online" tag -->
  <rect x="96" y="196" width="340" height="44" rx="22" fill="white" fill-opacity="0.15"/>
  <text x="266" y="218"
        font-family="Arial, Helvetica, sans-serif"
        font-size="18" font-weight="700"
        fill="rgba(255,255,255,0.90)"
        text-anchor="middle" dominant-baseline="middle">&#x1F4C5; Agendamento online</text>

  <!-- Business name -->
  <text x="96" y="${nameY}"
        font-family="Arial Black, Arial, Helvetica, sans-serif"
        font-size="${nameFontSize}" font-weight="900"
        fill="white">${safeDisplay}</text>

  ${
    safeDesc
      ? `<!-- Description -->
  <text x="96" y="${descY}"
        font-family="Arial, Helvetica, sans-serif"
        font-size="26" font-weight="400"
        fill="rgba(255,255,255,0.80)">${safeDesc}</text>`
      : ""
  }

  <!-- Tagline -->
  <text x="96" y="${taglineY}"
        font-family="Arial, Helvetica, sans-serif"
        font-size="28" font-weight="400"
        fill="rgba(255,255,255,0.68)">Agende com 1 clique, sem precisar ligar</text>

  <!-- CTA pill -->
  <rect x="96" y="${ctaY}" width="340" height="60" rx="30" fill="white" fill-opacity="0.18"/>
  <text x="266" y="${ctaY + 30}"
        font-family="Arial, Helvetica, sans-serif"
        font-size="22" font-weight="700"
        fill="white" text-anchor="middle" dominant-baseline="middle">Agendar agora</text>

  <!-- Right: calendar decoration -->
  <rect x="840" y="180" width="300" height="270" rx="28" fill="white" fill-opacity="0.12"/>
  <rect x="840" y="180" width="300" height="68"  rx="28" fill="white" fill-opacity="0.12"/>
  <circle cx="900"  cy="295" r="9"  fill="white" fill-opacity="0.45"/>
  <circle cx="960"  cy="295" r="9"  fill="white" fill-opacity="0.45"/>
  <circle cx="1020" cy="295" r="9"  fill="white" fill-opacity="0.45"/>
  <circle cx="1080" cy="295" r="9"  fill="white" fill-opacity="0.45"/>
  <circle cx="900"  cy="355" r="9"  fill="white" fill-opacity="0.45"/>
  <circle cx="960"  cy="355" r="18" fill="white" fill-opacity="0.95"/>
  <circle cx="1020" cy="355" r="9"  fill="white" fill-opacity="0.45"/>
  <circle cx="1080" cy="355" r="9"  fill="white" fill-opacity="0.45"/>
  <circle cx="900"  cy="415" r="9"  fill="white" fill-opacity="0.45"/>
  <circle cx="960"  cy="415" r="9"  fill="white" fill-opacity="0.45"/>
  <circle cx="1020" cy="415" r="9"  fill="white" fill-opacity="0.45"/>
  <circle cx="1080" cy="415" r="9"  fill="white" fill-opacity="0.45"/>
  <text x="990" y="226"
        font-family="Arial, Helvetica, sans-serif"
        font-size="20" font-weight="700"
        fill="white" text-anchor="middle" dominant-baseline="middle">MAIO 2026</text>
</svg>`;
}

let fontWarned = false;

function renderSvgToPng(svg: string): Buffer {
  try {
    const resvg = new Resvg(svg, {
      font: { loadSystemFonts: true },
      fitTo: { mode: "original" as const },
    });
    return Buffer.from(resvg.render().asPng());
  } catch {
    if (!fontWarned) {
      fontWarned = true;
      // intentionally not using logger here (no request context)
    }
    // 1×1 transparent PNG fallback
    return Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    );
  }
}

export function generateOgPng(
  businessName: string,
  description?: string,
  logoDataUri?: string,
): Buffer {
  // Only embed data URIs (base64 blobs stored in DB).
  // External URLs won't work inside SVG via resvg.
  const embedLogo =
    logoDataUri && logoDataUri.startsWith("data:") ? logoDataUri : undefined;

  const svg = embedLogo
    ? buildLogoSvg(businessName, description, embedLogo)
    : buildPurpleSvg(businessName, description);

  return renderSvgToPng(svg);
}
