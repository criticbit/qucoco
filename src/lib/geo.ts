// Geo helpers for QuCoCo: read GPS from JPEG EXIF, compute a convex hull
// polygon and its area. Pure JS — works on iOS, Android and web.

import type { GeoPoint } from '../types';
import { readBytes } from './decode';

const EARTH_RADIUS_M = 6371000;

// ---------------------------------------------------------------------------
// EXIF GPS extraction (JPEG only)
// ---------------------------------------------------------------------------

function rational(num: number, den: number): number {
  return den ? num / den : 0;
}

/**
 * Read GPS coordinates from a JPEG file's EXIF block.
 * Returns null for non-JPEG files, images without GPS, or on parse errors.
 */
export async function extractGeoFromImage(imageUri: string): Promise<GeoPoint | null> {
  try {
    const bytes = await readBytes(imageUri);
    return extractGeoFromJpegBytes(bytes);
  } catch {
    return null;
  }
}

function extractGeoFromJpegBytes(bytes: Uint8Array): GeoPoint | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  // Collect JPEG markers.
  const markers: { code: number; dataStart: number; dataEnd: number }[] = [];
  let pos = 2;
  while (pos + 4 <= bytes.length) {
    if (bytes[pos] !== 0xff) break;
    const marker = bytes[pos + 1];
    const len = (bytes[pos + 2] << 8) | bytes[pos + 3];
    if (marker === 0x01 || marker === 0xd9) break; // standalone (SOI/EOI)
    markers.push({ code: marker, dataStart: pos + 4, dataEnd: pos + 4 + len });
    pos += 2 + len;
  }

  // EXIF lives in the APP1 segment.
  const app1 = markers.find((m) => m.code === 0xe1);
  if (!app1) return null;
  const dStart = app1.dataStart;
  if (dStart + 6 > bytes.length) return null;
  // "Exif\0\0"
  if (
    bytes[dStart] !== 0x45 || bytes[dStart + 1] !== 0x78 ||
    bytes[dStart + 2] !== 0x69 || bytes[dStart + 3] !== 0x66 ||
    bytes[dStart + 4] !== 0x00 || bytes[dStart + 5] !== 0x00
  ) {
    return null;
  }

  const tiffStart = dStart + 6;
  if (tiffStart + 8 > bytes.length) return null;
  const littleEndian = bytes[tiffStart] === 0x49 && bytes[tiffStart + 1] === 0x49;
  const readU16 = (o: number) =>
    littleEndian ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1];
  const readU32 = (o: number) => {
    const lo = readU16(o);
    const hi = readU16(o + 2);
    return littleEndian ? (hi << 16) | lo : (lo << 16) | hi;
  };

  // First IFD offset is at TIFF base + 4.
  const ifd0Abs = tiffStart + readU32(tiffStart + 4);
  if (ifd0Abs + 2 > bytes.length) return null;
  const count = readU16(ifd0Abs);

  // Find the GPS IFD pointer (tag 0x8825, type LONG).
  let gpsIfdRel: number | null = null;
  for (let i = 0; i < count; i++) {
    const entry = ifd0Abs + 2 + i * 12;
    if (entry + 12 > bytes.length) break;
    const tag = readU16(entry);
    const type = readU16(entry + 2);
    const n = readU32(entry + 4);
    if (tag === 0x8825 && type === 4 && n === 4) {
      gpsIfdRel = readU32(entry + 8);
      break;
    }
  }
  if (gpsIfdRel === null) return null;

  const gpsAbs = tiffStart + gpsIfdRel;
  if (gpsAbs + 2 > bytes.length) return null;
  const gpsCount = readU16(gpsAbs);

  let latRef: string | null = null;
  let latRaw: number[] = [];
  let lngRef: string | null = null;
  let lngRaw: number[] = [];

  for (let i = 0; i < gpsCount; i++) {
    const entry = gpsAbs + 2 + i * 12;
    if (entry + 12 > bytes.length) break;
    const tag = readU16(entry);
    const type = readU16(entry + 2); // 1=ASCII, 5=RATIONAL
    const n = readU32(entry + 4);
    const dataBytes = type === 5 ? n * 8 : n;
    let off: number;
    if (dataBytes <= 4) {
      off = entry + 8;
    } else {
      off = tiffStart + readU32(entry + 8);
    }
    if (tag === 1) {
      latRef = String.fromCharCode(bytes[off]) === 'N' ? 'N' : 'S';
    } else if (tag === 2) {
      latRaw = [
        rational(readU32(off), readU32(off + 4)),
        rational(readU32(off + 8), readU32(off + 12)),
        rational(readU32(off + 16), readU32(off + 20)),
      ];
    } else if (tag === 3) {
      lngRef = String.fromCharCode(bytes[off]) === 'E' ? 'E' : 'W';
    } else if (tag === 4) {
      lngRaw = [
        rational(readU32(off), readU32(off + 4)),
        rational(readU32(off + 8), readU32(off + 12)),
        rational(readU32(off + 16), readU32(off + 20)),
      ];
    }
  }

  if (!latRef || latRaw.length < 3 || !lngRef || lngRaw.length < 3) return null;
  const lat = dmsToDecimal(latRaw) * (latRef === 'S' ? -1 : 1);
  const lng = dmsToDecimal(lngRaw) * (lngRef === 'W' ? -1 : 1);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

function dmsToDecimal([d, m, s]: number[]): number {
  return d + m / 60 + s / 3600;
}

// ---------------------------------------------------------------------------
// Haversine distance (meters)
// ---------------------------------------------------------------------------

export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// ---------------------------------------------------------------------------
// Convex hull (Andrew's monotone chain)
// ---------------------------------------------------------------------------

export function convexHull(points: GeoPoint[]): GeoPoint[] {
  const pts = [...points].sort(
    (a, b) => (a.lat - b.lat) || (a.lng - b.lng)
  );
  if (pts.length <= 2) return pts;
  const cross = (o: GeoPoint, a: GeoPoint, b: GeoPoint) =>
    (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);
  const lower: GeoPoint[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper: GeoPoint[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Polygon area in m². Uses a local equirectangular projection centered on the
 * polygon's mean point, accurate enough for farm-plot scales.
 */
export function polygonAreaM2(polygon: GeoPoint[]): number {
  if (polygon.length < 3) return 0;
  const lat0 = polygon.reduce((s, p) => s + p.lat, 0) / polygon.length;
  const lng0 = polygon.reduce((s, p) => s + p.lng, 0) / polygon.length;
  const kx = EARTH_RADIUS_M * Math.cos((lat0 * Math.PI) / 180) * (Math.PI / 180);
  const ky = EARTH_RADIUS_M * (Math.PI / 180);
  let sum = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const ax = (a.lng - lng0) * kx;
    const ay = (a.lat - lat0) * ky;
    const bx = (b.lng - lng0) * kx;
    const by = (b.lat - lat0) * ky;
    sum += ax * by - bx * ay;
  }
  return Math.abs(sum) / 2;
}

export function polygonCenter(polygon: GeoPoint[]): GeoPoint {
  const lat = polygon.reduce((s, p) => s + p.lat, 0) / polygon.length;
  const lng = polygon.reduce((s, p) => s + p.lng, 0) / polygon.length;
  return { lat, lng };
}

export function formatArea(m2: number): string {
  if (m2 < 10000) return `${Math.round(m2)} m²`;
  return `${(m2 / 10000).toFixed(2)} ha`;
}
