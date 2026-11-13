// Pixel decoding for CoQuCo — pure JS, no native image modules required,
// so it behaves identically on iOS, Android and web.

import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { inflate } from 'pako';
import * as jpeg from 'jpeg-js';

export interface ImagePixels {
  r: Uint8Array;
  g: Uint8Array;
  b: Uint8Array;
  width: number;
  height: number;
}

function base64ToBytes(b64: string): Uint8Array {
  if (Platform.OS === 'web') {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  const out = Buffer.from(b64, 'base64') as unknown as Uint8Array;
  return out;
}

export async function loadPixels(imageUri: string): Promise<ImagePixels> {
  const bytes = Platform.OS === 'web' ? await readBytesWeb(imageUri) : await readBytesNative(imageUri);
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return decodePng(bytes);
  }
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return decodeJpeg(bytes);
  }
  throw new Error('Unsupported image format — save the photo as JPEG or PNG');
}

export async function readBytes(imageUri: string): Promise<Uint8Array> {
  return Platform.OS === 'web' ? readBytesWeb(imageUri) : readBytesNative(imageUri);
}

async function readBytesNative(imageUri: string): Promise<Uint8Array> {
  const buf = await new File(imageUri).arrayBuffer();
  return new Uint8Array(buf);
}

async function readBytesWeb(imageUri: string): Promise<Uint8Array> {
  if (imageUri.startsWith('data:')) {
    const comma = imageUri.indexOf(',');
    const b64 = imageUri.slice(comma + 1);
    return base64ToBytes(b64);
  }
  const res = await fetch(imageUri);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

// ---------------------------------------------------------------------------
// PNG (8-bit, non-interlaced — what phone cameras produce)
// ---------------------------------------------------------------------------

function decodePng(bytes: Uint8Array): ImagePixels {
  let pos = 8; // skip signature
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let palette: Uint8Array | null = null;
  const idatChunks: Uint8Array[] = [];
  while (pos + 12 <= bytes.length) {
    const len = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
    const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
    const data = bytes.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = (data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3];
      height = (data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7];
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'PLTE') {
      palette = new Uint8Array(data);
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }
  const isPalette = colorType === 3;
  if (bitDepth !== 8) throw new Error('Only 8-bit PNG images are supported');
  const channels =
    isPalette
      ? 1
      : colorType === 2
        ? 3
        : colorType === 6
          ? 4
          : colorType === 0
            ? 1
            : colorType === 4
              ? 2
              : -1;
  if (channels === -1) throw new Error(`Unsupported PNG color type ${colorType}`);
  if (isPalette && !palette) throw new Error('PNG palette missing');

  const totalLen = idatChunks.reduce((a, d) => a + d.length, 0);
  const compressed = new Uint8Array(totalLen);
  let off = 0;
  for (const d of idatChunks) {
    compressed.set(d, off);
    off += d.length;
  }
  const raw = inflate(compressed);
  const stride = width * channels;
  const n = width * height;
  const outR = new Uint8Array(n);
  const outG = new Uint8Array(n);
  const outB = new Uint8Array(n);

  const prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = new Uint8Array(stride);
    const start = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const rawByte = raw[start + x];
      const a = x >= channels ? line[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v: number;
      switch (filter) {
        case 0: v = rawByte; break;
        case 1: v = rawByte + a; break;
        case 2: v = rawByte + b; break;
        case 3: v = rawByte + Math.floor((a + b) / 2); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          v = rawByte + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error(`Unsupported PNG filter ${filter}`);
      }
      line[x] = v & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (isPalette) {
        const idx = line[x];
        outR[i] = palette![idx * 3];
        outG[i] = palette![idx * 3 + 1];
        outB[i] = palette![idx * 3 + 2];
      } else if (channels >= 3) {
        outR[i] = line[x * channels];
        outG[i] = line[x * channels + 1];
        outB[i] = line[x * channels + 2];
      } else {
        outR[i] = outG[i] = outB[i] = line[x * channels];
      }
    }
    prev.set(line);
  }
  return { r: outR, g: outG, b: outB, width, height };
}

// ---------------------------------------------------------------------------
// JPEG via jpeg-js (baseline + progressive, YCbCr + grayscale).
// Output is RGBA (4 bytes per pixel).
// ---------------------------------------------------------------------------

function decodeJpeg(bytes: Uint8Array): ImagePixels {
  const decoded = jpeg.decode(bytes, { useTArray: true });
  const rgba = decoded.data as Uint8Array;
  const n = decoded.width * decoded.height;
  const r = new Uint8Array(n);
  const g = new Uint8Array(n);
  const b = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    r[i] = rgba[i * 4];
    g[i] = rgba[i * 4 + 1];
    b[i] = rgba[i * 4 + 2];
  }
  return { r, g, b, width: decoded.width, height: decoded.height };
}
