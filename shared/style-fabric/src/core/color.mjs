import { clamp } from "./stable.mjs";

export function normalizeHex(value, fallback = "#7c5cff") {
  const text = String(value ?? "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(text)) return text;
  if (/^#[0-9a-f]{3}$/.test(text)) {
    return `#${[...text.slice(1)].map((part) => part.repeat(2)).join("")}`;
  }
  return fallback;
}

export function hexToRgb(value) {
  const hex = normalizeHex(value).slice(1);
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16)
  };
}

export function rgbToHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((part) => Math.round(clamp(part, 0, 255)).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function mixHex(first, second, amount = 0.5) {
  const a = hexToRgb(first);
  const b = hexToRgb(second);
  const t = clamp(amount);
  return rgbToHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t
  });
}

export function hslToHex(hue, saturation, lightness) {
  const h = ((Number(hue) % 360) + 360) % 360;
  const s = clamp(saturation / 100);
  const l = clamp(lightness / 100);
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const offset = l - chroma / 2;
  let rgb;

  if (h < 60) rgb = [chroma, x, 0];
  else if (h < 120) rgb = [x, chroma, 0];
  else if (h < 180) rgb = [0, chroma, x];
  else if (h < 240) rgb = [0, x, chroma];
  else if (h < 300) rgb = [x, 0, chroma];
  else rgb = [chroma, 0, x];

  return rgbToHex({
    r: (rgb[0] + offset) * 255,
    g: (rgb[1] + offset) * 255,
    b: (rgb[2] + offset) * 255
  });
}

function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const channels = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function contrastRatio(first, second) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function readableText(background, light = "#f7f8ff", dark = "#0a0c14") {
  return contrastRatio(background, light) >= contrastRatio(background, dark) ? light : dark;
}
