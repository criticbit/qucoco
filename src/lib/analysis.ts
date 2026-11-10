import { loadPixels } from './decode';
import type { BeanType, RoastLevel } from '../types';

export interface BeanPhotoAnalysis {
  /** 0–10: how well the photo matches the expected bean color profile. */
  typeMatch: number;
  /** 0–1: fraction of sampled pixels that are consistent (same hue family). */
  uniformity: number;
  /** Mean luminance of the sample area (0–255). */
  meanLuminance: number;
  /** Only meaningful for roasted beans. */
  roastLevel?: RoastLevel;
  /** 0–100, intensity of roast. */
  roastIntensity?: number;
  /** 0–10 combined grade. */
  score: number;
}

export interface BeveragePhotoAnalysis {
  /** 0–1: fraction of surface pixels that look like espresso crema. */
  crema: number;
  /** 0–1: fraction of surface pixels that look like a milk-based drink. */
  milky: number;
  meanLuminance: number;
}

interface HSL {
  h: number;
  s: number;
  l: number;
}

function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    default: h = ((r - g) / d + 4) / 6; break;
  }
  return { h: h * 360, s, l };
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Sample pixels from the central 60% of the image on a 24×24 grid.
 */
function samplePixels(image: Awaited<ReturnType<typeof loadPixels>>, count = 24) {
  const { r, g, b, width, height } = image;
  const x0 = Math.floor(width * 0.2);
  const x1 = Math.ceil(width * 0.8);
  const y0 = Math.floor(height * 0.2);
  const y1 = Math.ceil(height * 0.8);
  const cols = count;
  const rows = count;
  const pixels: HSL[] = [];
  for (let ry = 0; ry < rows; ry++) {
    for (let cx = 0; cx < cols; cx++) {
      const x = Math.min(width - 1, Math.floor(x0 + ((x1 - x0) * cx) / (cols - 1)));
      const y = Math.min(height - 1, Math.floor(y0 + ((y1 - y0) * ry) / (rows - 1)));
      const i = y * width + x;
      pixels.push(rgbToHsl(r[i], g[i], b[i]));
    }
  }
  return { pixels, lums: pixels.map((p) => p.l * 255) };
}

const GREEN_HUE = { min: 35, max: 170 };
const ROAST_HUE = { min: 15, max: 45 }; // amber → red-brown
const DARK_LUM = 40;
const MED_LUM = 130;

function inHue(h: number, range: { min: number; max: number }): boolean {
  return h >= range.min && h <= range.max;
}

export async function analyzeBeanPhoto(imageUri: string, beanType: BeanType): Promise<BeanPhotoAnalysis> {
  const image = await loadPixels(imageUri);
  const { pixels, lums } = samplePixels(image);

  const meanLuminance = Math.round(lums.reduce((a, b) => a + b, 0) / lums.length);
  const darkFraction = lums.filter((l) => l < DARK_LUM).length / lums.length;

  if (beanType === 'green') {
    const green = pixels.filter(
      (p) => inHue(p.h, GREEN_HUE) && p.s > 0.05 && p.l > 0.15 && p.l < 0.85
    ).length / pixels.length;
    const typeMatch = Math.round((green * (1 - darkFraction * 0.5) + (1 - darkFraction) * 0.1) * 10) / 10;
    const score = clamp10(Math.round(green * 7 + (1 - darkFraction) * 3));
    return {
      typeMatch: clamp10(typeMatch),
      uniformity: Math.round((1 - spread(lums)) * 100) / 100,
      meanLuminance,
      score,
    };
  }

  // Roasted: warm hue + dark-ish luminance band.
  const warm = pixels.filter(
    (p) => (inHue(p.h, ROAST_HUE) || p.h < 12) && p.s > 0.1 && p.l > 0.1 && p.l < 0.75
  ).length / pixels.length;
  const darkBand = lums.filter((l) => l >= DARK_LUM && l <= MED_LUM).length / lums.length;
  const roastIntensity = Math.round(((1 - meanLuminance / 255) * 100 + darkBand * 20) / 2);
  const roastLevel: RoastLevel =
    roastIntensity < 45
      ? 'Light'
      : roastIntensity < 60
        ? 'Medium'
        : roastIntensity < 75
          ? 'Medium-Dark'
          : 'Dark';
  const score = clamp10(Math.round(warm * 6 + darkBand * 4 + (1 - spread(lums)) * 0));
  return {
    typeMatch: clamp10(Math.round((warm * 0.8 + darkBand * 0.2) * 10) / 10),
    uniformity: Math.round((1 - spread(lums)) * 100) / 100,
    meanLuminance,
    roastLevel,
    roastIntensity,
    score,
  };
}

export async function analyzeBeveragePhoto(imageUri: string): Promise<BeveragePhotoAnalysis> {
  const image = await loadPixels(imageUri);
  const { pixels, lums } = samplePixels(image);
  const crema =
    pixels.filter((p) => inHue(p.h, { min: 20, max: 50 }) && p.s > 0.25 && p.l > 0.4 && p.l < 0.8).length /
    pixels.length;
  const milky =
    pixels.filter((p) => p.s < 0.18 && p.l > 0.75).length / pixels.length;
  return {
    crema: Math.round(crema * 100) / 100,
    milky: Math.round(milky * 100) / 100,
    meanLuminance: Math.round(lums.reduce((a, b) => a + b, 0) / lums.length),
  };
}

/** Normalized spread (std dev) of a value list, 0–1. */
function spread(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const varr = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(varr) / 255;
}

function clamp10(v: number): number {
  return Math.max(0, Math.min(10, Math.round(v)));
}
