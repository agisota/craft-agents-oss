/**
 * Stable synchronous SHA-256 for mind-map projections.
 *
 * Bun exposes a native synchronous hash, but the renderer does not. Keep the
 * browser fallback local and dependency-free so this module remains safe to
 * import from both runtimes.
 */

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rightRotate(value: number, bits: number): number {
  return ((value >>> bits) | (value << (32 - bits))) >>> 0;
}

function sha256Fallback(text: string): string {
  const input = new TextEncoder().encode(text);
  const bitLength = input.length * 8;
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(input);
  bytes[input.length] = 0x80;

  const highBits = Math.floor(bitLength / 0x1_0000_0000);
  const lowBits = bitLength >>> 0;
  bytes[paddedLength - 8] = highBits >>> 24;
  bytes[paddedLength - 7] = highBits >>> 16;
  bytes[paddedLength - 6] = highBits >>> 8;
  bytes[paddedLength - 5] = highBits;
  bytes[paddedLength - 4] = lowBits >>> 24;
  bytes[paddedLength - 3] = lowBits >>> 16;
  bytes[paddedLength - 2] = lowBits >>> 8;
  bytes[paddedLength - 1] = lowBits;

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const words = new Uint32Array(64);

  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const start = offset + index * 4;
      words[index] = (
        (bytes[start]! << 24) |
        (bytes[start + 1]! << 16) |
        (bytes[start + 2]! << 8) |
        bytes[start + 3]!
      ) >>> 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const a = words[index - 15]!;
      const b = words[index - 2]!;
      const sigma0 = rightRotate(a, 7) ^ rightRotate(a, 18) ^ (a >>> 3);
      const sigma1 = rightRotate(b, 17) ^ rightRotate(b, 19) ^ (b >>> 10);
      words[index] = (words[index - 16]! + sigma0 + words[index - 7]! + sigma1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let index = 0; index < 64; index += 1) {
      const sigma1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + sigma1 + choose + SHA256_K[index]! + words[index]!) >>> 0;
      const sigma0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sigma0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((word) => word.toString(16).padStart(8, '0'))
    .join('');
}

function sha256Hex(text: string): string {
  const runtime = globalThis as typeof globalThis & {
    crypto?: Crypto & {
      hash?: (algorithm: string, data: string | ArrayBufferView, output?: string) => string | ArrayBuffer;
    };
    Bun?: {
      CryptoHasher?: new (algorithm: string) => {
        update(input: string | Uint8Array): void;
        digest(encoding?: string): string | Uint8Array;
      };
    };
  };
  const CryptoHasher = runtime.Bun?.CryptoHasher;
  if (typeof CryptoHasher === 'function') {
    const hasher = new CryptoHasher('sha256');
    hasher.update(text);
    return String(hasher.digest('hex'));
  }
  if (typeof runtime.crypto?.hash === 'function') {
    return String(runtime.crypto.hash('sha256', text, 'hex'));
  }
  return sha256Fallback(text);
}

/** Normalize newlines only (\r\n / \r → \n). Does not trim — structural parts stay exact. */
export function normalizeMindMapPart(part: string): string {
  return part.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Hash ordered structural parts joined with NUL after newline normalization.
 */
export function hashMindMapSource(parts: readonly string[]): string {
  const payload = parts.map(normalizeMindMapPart).join('\0');
  return sha256Hex(payload);
}
