// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Base64 to bytes, for the generated data the real faces and their hints
// are baked into (`real-face.ts`, `real-hints.ts`).

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Base64 to bytes, with no host's decoder (the engine imports nothing). */
export function base64(s: string): Uint8Array {
  const value = new Int16Array(128).fill(-1);
  for (let i = 0; i < B64.length; i++) value[B64.charCodeAt(i)] = i;
  const clean = s.replace(/=+$/, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0;
  let acc = 0;
  let o = 0;
  for (let i = 0; i < clean.length; i++) {
    acc = (acc << 6) | value[clean.charCodeAt(i)];
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  return out;
}
