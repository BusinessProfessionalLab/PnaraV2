export function hexToHsl(hex: string) {
  const raw = hex.replace("#", "");
  const bigint = parseInt(raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw, 16);
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
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function applyTheme(primary: string, secondary: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--primary", hexToHsl(primary || "#C41E3A"));
  root.style.setProperty("--secondary", hexToHsl(secondary || "#1F2937"));
  root.style.setProperty("--ring", hexToHsl(primary || "#C41E3A"));
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
