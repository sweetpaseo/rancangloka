/**
 * RancangLoka — Headless Image Binary Validation (MEDIA-A1)
 *
 * Validates raw image bytes directly from provider response (Base64 / Bytes / Stream).
 * Enforces magic-byte verification, dimensions extraction, and deterministic SHA-256 calculation.
 */

import { ImageProviderError } from './image-provider-types.ts';

export interface ValidatedImageBinary {
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  width: number;
  height: number;
  byteSize: number;
  sha256: string;
  extension: 'png' | 'jpg' | 'webp';
}

/**
 * Computes lowercase hex SHA-256 string from Uint8Array or ArrayBuffer.
 */
export async function computeBinarySha256(data: Uint8Array | ArrayBuffer): Promise<string> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  const arr = Array.from(new Uint8Array(digest));
  return arr.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Parses PNG dimensions from IHDR chunk (starts at offset 16).
 */
function parsePngDimensions(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return { width, height };
}

/**
 * Parses JPEG dimensions from Start Of Frame (SOF) marker.
 */
function parseJpegDimensions(bytes: Uint8Array): { width: number; height: number } {
  let offset = 2;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  while (offset < bytes.length - 8) {
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = bytes[offset + 1];
    // SOF markers: C0 to C3, C5 to C7, C9 to CB, CD to CF
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      const height = view.getUint16(offset + 5, false);
      const width = view.getUint16(offset + 7, false);
      return { width, height };
    }
    const length = view.getUint16(offset + 2, false);
    offset += 2 + length;
  }
  return { width: 0, height: 0 };
}

/**
 * Parses WebP dimensions (VP8, VP8L, or VP8X).
 */
function parseWebpDimensions(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const formatTag = String.fromCharCode(...bytes.slice(12, 16));

  if (formatTag === 'VP8 ') {
    const width = view.getUint16(26, true) & 0x3fff;
    const height = view.getUint16(28, true) & 0x3fff;
    return { width, height };
  }

  if (formatTag === 'VP8L') {
    const b1 = bytes[21];
    const b2 = bytes[22];
    const b3 = bytes[23];
    const b4 = bytes[24];
    const width = 1 + (((b2 & 0x3f) << 8) | b1);
    const height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
    return { width, height };
  }

  if (formatTag === 'VP8X') {
    const width = 1 + (view.getUint32(24, true) & 0x00ffffff);
    const height = 1 + ((view.getUint32(27, true) >> 8) & 0x00ffffff);
    return { width, height };
  }

  return { width: 0, height: 0 };
}

/**
 * Validates raw image binary bytes against strict media integrity rules.
 */
export async function validateImageBinary(
  bufferOrBytes: ArrayBuffer | Uint8Array,
  providerName: string = 'unknown'
): Promise<ValidatedImageBinary> {
  const bytes = bufferOrBytes instanceof Uint8Array ? bufferOrBytes : new Uint8Array(bufferOrBytes);
  const byteSize = bytes.byteLength;

  if (!byteSize || byteSize < 16) {
    throw new ImageProviderError({
      code: 'INVALID_RESPONSE',
      provider: providerName,
      message: `Image binary is empty or truncated (${byteSize} bytes).`
    });
  }

  // Detect HTML or JSON error masquerading as image
  const first16Str = String.fromCharCode(...bytes.slice(0, 16)).trim().toLowerCase();
  if (first16Str.startsWith('<html') || first16Str.startsWith('<!doctype') || first16Str.startsWith('{"error"')) {
    throw new ImageProviderError({
      code: 'INVALID_RESPONSE',
      provider: providerName,
      message: 'Provider returned HTML or text error payload instead of valid image binary.'
    });
  }

  let mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  let extension: 'png' | 'jpg' | 'webp';
  let width = 0;
  let height = 0;

  // 1. PNG Magic Bytes: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    mimeType = 'image/png';
    extension = 'png';
    ({ width, height } = parsePngDimensions(bytes));
  }
  // 2. JPEG Magic Bytes: FF D8 FF
  else if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    mimeType = 'image/jpeg';
    extension = 'jpg';
    ({ width, height } = parseJpegDimensions(bytes));
  }
  // 3. WebP Magic Bytes: 'RIFF' .... 'WEBP'
  else if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    mimeType = 'image/webp';
    extension = 'webp';
    ({ width, height } = parseWebpDimensions(bytes));
  } else {
    throw new ImageProviderError({
      code: 'INVALID_RESPONSE',
      provider: providerName,
      message: 'Unrecognized image binary format. Expected PNG, JPEG, or WebP magic bytes.'
    });
  }

  if (width <= 0 || height <= 0) {
    throw new ImageProviderError({
      code: 'INVALID_RESPONSE',
      provider: providerName,
      message: `Failed to extract valid dimensions from image binary (${width}x${height}).`
    });
  }

  const sha256 = await computeBinarySha256(bytes);

  return {
    mimeType,
    width,
    height,
    byteSize,
    sha256,
    extension
  };
}
