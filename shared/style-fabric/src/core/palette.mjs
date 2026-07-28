import { hexToRgb, hslToHex, normalizeHex } from "./color.mjs";
import { clamp } from "./stable.mjs";

export const PALETTE_HARMONIES = Object.freeze([
  "custom",
  "complementary",
  "analogous",
  "triadic",
  "split-complementary",
  "monochrome"
]);

function rgbToHsl({ r, g, b }) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  let hue = 0;

  if (delta) {
    if (maximum === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (maximum === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }

  const lightness = (maximum + minimum) / 2;
  const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0;
  return {
    h: (hue + 360) % 360,
    s: saturation * 100,
    l: lightness * 100
  };
}

function color(hue, saturation, lightness) {
  return hslToHex(hue, clamp(saturation, 18, 100), clamp(lightness, 18, 86));
}

export function createHarmonyPalette(primary, harmony = "triadic") {
  const normalized = normalizeHex(primary);
  const { h, s, l } = rgbToHsl(hexToRgb(normalized));
  const mode = PALETTE_HARMONIES.includes(harmony) ? harmony : "triadic";

  const palettes = {
    custom: {
      primary: normalized,
      secondary: color(h + 82, s * 0.88, l + 3),
      accent: color(h + 202, Math.max(72, s), l + 8)
    },
    complementary: {
      primary: normalized,
      secondary: color(h + 180, s * 0.9, l + 2),
      accent: color(h + 32, Math.max(70, s), l + 9)
    },
    analogous: {
      primary: normalized,
      secondary: color(h + 38, s * 0.9, l + 3),
      accent: color(h - 42, Math.max(68, s), l + 7)
    },
    triadic: {
      primary: normalized,
      secondary: color(h + 120, s * 0.9, l + 2),
      accent: color(h + 240, Math.max(70, s), l + 7)
    },
    "split-complementary": {
      primary: normalized,
      secondary: color(h + 150, s * 0.88, l + 3),
      accent: color(h + 210, Math.max(72, s), l + 7)
    },
    monochrome: {
      primary: normalized,
      secondary: color(h, s * 0.68, l + 18),
      accent: color(h, Math.min(100, s * 1.08), l - 15)
    }
  };

  return palettes[mode];
}
