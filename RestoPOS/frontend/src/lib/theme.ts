export function hexToHslChannels(hex: string) {
  const raw = hex.replace("#", "");
  const bigint = parseInt(
    raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw,
    16,
  );
  const r = ((bigint >> 16) & 255) / 255;
  const g = ((bigint >> 8) & 255) / 255;
  const b = (bigint & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * Applies the store brand color. The neutral system is static; only the
 * accent channels are written so `--color-primary*` tokens resolve at runtime.
 */
export function applyTheme(primary: string) {
  if (typeof document === "undefined") return;
  const { h, s, l } = hexToHslChannels(primary || "#C41E3A");
  const root = document.documentElement;
  root.style.setProperty("--ph", String(h));
  root.style.setProperty("--ps", `${s}%`);
  root.style.setProperty("--pl", `${l}%`);
  // Clean up legacy variables so nothing stale overrides the new layer.
  root.style.removeProperty("--primary");
  root.style.removeProperty("--secondary");
  root.style.removeProperty("--ring");
}

export function playAlert(kind: "new" | "ready" | "error" = "new") {
  if (typeof window === "undefined") return;
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = kind === "error" ? "sawtooth" : "sine";
  osc.frequency.value = kind === "ready" ? 880 : kind === "error" ? 220 : 660;
  gain.gain.value = 0.08;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.18);
  if (kind === "new") {
    const osc2 = ctx.createOscillator();
    osc2.frequency.value = 990;
    osc2.connect(gain);
    osc2.start(ctx.currentTime + 0.16);
    osc2.stop(ctx.currentTime + 0.32);
  }
}
