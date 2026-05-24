import { Resvg } from "@resvg/resvg-js";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSvg(
  businessName: string,
  description?: string,
  logoDataUri?: string,
): string {
  const len = businessName.length;
  const display = len > 30 ? businessName.slice(0, 28) + "…" : businessName;
  const safeDisplay = escapeXml(display);

  // Scale name font based on length
  const nameFontSize = len > 26 ? 52 : len > 18 ? 62 : len > 12 ? 74 : 86;

  // Truncate description to 90 chars for the image
  const descText = description
    ? description.length > 90
      ? description.slice(0, 88) + "…"
      : description
    : null;
  const safeDesc = descText ? escapeXml(descText) : null;

  const initial = businessName.charAt(0).toUpperCase();

  // Vertical layout depends on whether we have a description
  const hasDesc = !!safeDesc;
  const nameY = hasDesc ? 295 : 320 + (88 - nameFontSize) / 2;
  const descY = 395;
  const taglineY = hasDesc ? 458 : 410;
  const ctaY = hasDesc ? 498 : 470;

  // Logo badge: embed real logo or show initials placeholder
  const logoBadge = logoDataUri
    ? `<defs><clipPath id="lc"><rect x="96" y="84" width="80" height="80" rx="20"/></clipPath></defs>
  <image x="96" y="84" width="80" height="80" clip-path="url(#lc)"
         href="${logoDataUri}" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect x="96" y="88" width="64" height="64" rx="18" fill="white" fill-opacity="0.22"/>
  <text x="128" y="138"
        font-family="Arial Black, Arial, Helvetica, sans-serif"
        font-size="36" font-weight="900"
        fill="white" text-anchor="middle">${initial}</text>`;

  const brandX = logoDataUri ? 196 : 176;

  return `<svg width="1200" height="630" viewBox="0 0 1200 630"
     xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#6d28d9"/>
      <stop offset="100%" stop-color="#3b0764"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.14"/>
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

  <!-- Logo badge (real logo or "R" initial) -->
  ${logoBadge}

  <!-- Brand label -->
  <text x="${brandX}" y="140"
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
  <circle cx="900" cy="295" r="9"  fill="white" fill-opacity="0.45"/>
  <circle cx="960" cy="295" r="9"  fill="white" fill-opacity="0.45"/>
  <circle cx="1020" cy="295" r="9" fill="white" fill-opacity="0.45"/>
  <circle cx="1080" cy="295" r="9" fill="white" fill-opacity="0.45"/>
  <circle cx="900" cy="355" r="9"  fill="white" fill-opacity="0.45"/>
  <circle cx="960" cy="355" r="18" fill="white" fill-opacity="0.95"/>
  <circle cx="1020" cy="355" r="9" fill="white" fill-opacity="0.45"/>
  <circle cx="1080" cy="355" r="9" fill="white" fill-opacity="0.45"/>
  <circle cx="900" cy="415" r="9"  fill="white" fill-opacity="0.45"/>
  <circle cx="960" cy="415" r="9"  fill="white" fill-opacity="0.45"/>
  <circle cx="1020" cy="415" r="9" fill="white" fill-opacity="0.45"/>
  <circle cx="1080" cy="415" r="9" fill="white" fill-opacity="0.45"/>
  <text x="990" y="226"
        font-family="Arial, Helvetica, sans-serif"
        font-size="20" font-weight="700"
        fill="white" text-anchor="middle" dominant-baseline="middle">MAIO 2026</text>
</svg>`;
}

let fontWarned = false;

export function generateOgPng(
  businessName: string,
  description?: string,
  logoDataUri?: string,
): Buffer {
  // Only pass logoDataUri to SVG if it's an actual data URI (not a URL)
  const embedLogo =
    logoDataUri && logoDataUri.startsWith("data:") ? logoDataUri : undefined;

  const svg = buildSvg(businessName, description, embedLogo);

  try {
    const resvg = new Resvg(svg, {
      font: { loadSystemFonts: true },
      fitTo: { mode: "original" as const },
    });
    return Buffer.from(resvg.render().asPng());
  } catch {
    if (!fontWarned) {
      fontWarned = true;
      console.warn("[og-image] resvg render failed, returning empty 1x1 png");
    }
    return Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    );
  }
}
