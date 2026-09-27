/**
 * Generates the brand raster assets that cannot be expressed as markup:
 *
 *   public/og.png      1200×630 social card
 *   public/favicon.png 512×512 site icon
 *
 * Both are drawn as vector shapes and rasterised with `sharp` (already a
 * project dependency — no new dependency added). Text is deliberately omitted:
 * the card is a shape-only composition built from the design tokens, so it has
 * no font/script dependency and stays correct in every renderer.
 *
 * Run with:  pnpm brand:assets
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.resolve(import.meta.dirname, "../public");

/* Design tokens — keep in sync with src/styles/global.css */
const TOKENS = {
  canvas: "#fdfaf5",
  surface: "#ffffff",
  primary: "#2d6dc3",
  primaryLight: "#8fb9ff",
  accent: "#fad13b",
  neutral200: "#dfe4ed",
  neutral400: "#92a1b7",
};

/** Rounded rectangle helper. */
const rrect = (x, y, w, h, r, fill, extra = "") =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;

/** The product mark: a rounded tile holding a receipt. Used by card + favicon. */
const mark = (x, y, size, tileFill, inkFill) => {
  const s = size / 100; // shapes are authored on a 100×100 grid
  const px = (v) => x + v * s;
  const py = (v) => y + v * s;
  const lw = (v) => v * s;
  return `
    ${rrect(x, y, size, size, 22 * s, tileFill)}
    <!-- receipt body -->
    ${rrect(px(30), py(22), lw(40), lw(56), 5 * s, inkFill)}
    <!-- torn bottom edge -->
    <path d="M ${px(30)} ${py(78)} l ${lw(7)} ${lw(6)} l ${lw(7)} ${-lw(6)} l ${lw(6)} ${lw(6)} l ${lw(7)} ${-lw(6)} l ${lw(7)} ${lw(6)} l ${lw(6)} ${-lw(6)}"
      fill="none" stroke="${inkFill}" stroke-width="${lw(3)}" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- receipt lines, punched out of the tile -->
    ${[38, 48, 58, 68].map((v, i) => rrect(px(38), py(v), lw(i === 3 ? 14 : 24), lw(4), 2 * s, tileFill)).join("\n")}
  `;
};

const ogCard = () => {
  const dots = [];
  for (let gx = 24; gx < 1200; gx += 24) {
    for (let gy = 24; gy < 630; gy += 24) {
      dots.push(`<circle cx="${gx}" cy="${gy}" r="1.6" fill="${TOKENS.primary}" opacity="0.16"/>`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    ${rrect(0, 0, 1200, 630, 0, TOKENS.canvas)}
    ${dots.join("")}

    <!-- mark -->
    ${mark(96, 150, 150, TOKENS.primary, TOKENS.surface)}

    <!-- register summary panel -->
    <g transform="translate(330 140)">
      ${rrect(0, 0, 470, 350, 26, TOKENS.surface)}
      ${rrect(0, 0, 470, 350, 26, "none", `stroke="${TOKENS.neutral200}" stroke-width="2"`)}
      <!-- panel header: three chrome dots + separator -->
      <circle cx="34" cy="40" r="7" fill="${TOKENS.neutral200}"/>
      <circle cx="58" cy="40" r="7" fill="${TOKENS.neutral200}"/>
      <circle cx="82" cy="40" r="7" fill="${TOKENS.primaryLight}"/>
      <line x1="0" y1="76" x2="470" y2="76" stroke="${TOKENS.neutral200}" stroke-width="2" stroke-dasharray="6 8"/>

      <!-- receipt lines -->
      ${[124, 176, 228].map((y, i) => `
        ${rrect(34, y, 26, 26, 8, i === 0 ? TOKENS.primary : TOKENS.neutral400, `opacity="${i === 0 ? 0.9 : 0.5}"`)}
        ${rrect(74, y + 4, i === 1 ? 150 : 196, 8, 4, TOKENS.neutral400, 'opacity="0.45"')}
        ${rrect(74, y + 17, i === 1 ? 104 : 132, 8, 4, TOKENS.neutral200, 'opacity="0.9"')}
        ${rrect(370, y + 7, 66, 12, 6, TOKENS.primary, `opacity="${0.55 + i * 0.12}"`)}
      `).join("")}

      <!-- dashed separator + total row -->
      <line x1="34" y1="290" x2="436" y2="290" stroke="${TOKENS.neutral200}" stroke-width="2" stroke-dasharray="6 8"/>
      ${rrect(34, 306, 58, 8, 4, TOKENS.neutral200)}
      ${rrect(340, 302, 96, 16, 8, TOKENS.accent)}
    </g>

    <!-- hourly sales chart -->
    <g transform="translate(96 350)">
      ${rrect(0, 0, 138, 200, 24, TOKENS.surface)}
      ${rrect(0, 0, 138, 200, 24, "none", `stroke="${TOKENS.neutral200}" stroke-width="2"`)}
      ${[46, 78, 58, 104, 132, 96, 66].map((h, i) => {
        const x = 18 + i * 15;
        const y = 172 - h;
        return rrect(x, y, 9, h, 4, TOKENS.primary, `opacity="${(0.22 + (i / 6) * 0.68).toFixed(2)}"`);
      }).join("")}
    </g>
  </svg>`;
};

const favicon = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    ${rrect(0, 0, 512, 512, 0, TOKENS.canvas)}
    ${mark(56, 56, 400, TOKENS.primary, TOKENS.surface)}
  </svg>`;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  await sharp(Buffer.from(ogCard())).png({ compressionLevel: 9 }).toFile(path.join(OUT_DIR, "og.png"));
  await sharp(Buffer.from(favicon())).png({ compressionLevel: 9 }).toFile(path.join(OUT_DIR, "favicon.png"));

  console.log("✓ public/og.png (1200×630)");
  console.log("✓ public/favicon.png (512×512)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
