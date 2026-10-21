// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A ROUND INSTRUMENT'S PIECES, PAINTED IN CODE — canvas only, three-free:
// the bezel and its face, the ticks and the numbers round a dial, the
// coloured bands, a needle and its hub, a word; the attitude ball and the
// compass card. Every cockpit's faces are painted out of these
// (`cockpit-paint.ts`, `army-heli-paint.ts`, `cab-paint.ts`), each in its
// own layout, so one dial reads the same in every one of them.

export type Ctx = CanvasRenderingContext2D;

export const INK = "#e9ece6";
export const FACE = "#0c0d0e";
export const GREEN = "#2fd35a";
export const AMBER = "#f4b41c";
export const RED = "#e8332a";

export const deg = (d: number): number => (d * Math.PI) / 180;

/** A round bezel and black face, `r` px. */
export function bezel(c: Ctx, x: number, y: number, r: number): void {
  const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r * 1.18);
  g.addColorStop(0, "#4a4d52");
  g.addColorStop(1, "#141517");
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r * 1.16, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = FACE;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  // The four screws at the bezel's corners.
  c.fillStyle = "#26282b";
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    c.beginPath();
    c.arc(x + sx * r * 1.02, y + sy * r * 1.02, r * 0.07, 0, Math.PI * 2);
    c.fill();
  }
}

/** Ticks round a dial from `a0` to `a1` deg (clockwise from the top) at
 * `n` steps, every `major` one long. */
export function ticks(
  c: Ctx,
  x: number,
  y: number,
  r: number,
  a0: number,
  a1: number,
  n: number,
  major: number,
): void {
  c.strokeStyle = INK;
  for (let i = 0; i <= n; i++) {
    const a = deg(a0 + ((a1 - a0) * i) / n);
    const long = i % major === 0;
    const r0 = r * (long ? 0.78 : 0.86);
    c.lineWidth = long ? r * 0.045 : r * 0.025;
    c.beginPath();
    c.moveTo(x + Math.sin(a) * r0, y - Math.cos(a) * r0);
    c.lineTo(x + Math.sin(a) * r * 0.96, y - Math.cos(a) * r * 0.96);
    c.stroke();
  }
}

/** Numbers round a dial at the long ticks. */
export function numbers(
  c: Ctx,
  x: number,
  y: number,
  r: number,
  a0: number,
  a1: number,
  words: readonly string[],
  size = 0.17,
): void {
  c.fillStyle = INK;
  c.font = `bold ${Math.round(r * size)}px sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  for (let i = 0; i < words.length; i++) {
    const a = deg(a0 + ((a1 - a0) * i) / Math.max(1, words.length - 1));
    c.fillText(words[i], x + Math.sin(a) * r * 0.6, y - Math.cos(a) * r * 0.6);
  }
}

/** A coloured arc band round a dial's rim from `a0` to `a1` deg. */
export function band(c: Ctx, x: number, y: number, r: number, a0: number, a1: number, colour: string) {
  c.strokeStyle = colour;
  c.lineWidth = r * 0.08;
  c.beginPath();
  c.arc(x, y, r * 0.92, deg(a0 - 90), deg(a1 - 90));
  c.stroke();
}

export function label(c: Ctx, x: number, y: number, size: number, text: string, colour = INK): void {
  c.fillStyle = colour;
  c.font = `bold ${Math.round(size)}px sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(text, x, y);
}

/** A needle from the middle at `a` deg, `len` of the radius. */
export function needle(c: Ctx, x: number, y: number, r: number, a: number, len: number, w = 0.06) {
  const s = Math.sin(deg(a));
  const k = -Math.cos(deg(a));
  c.fillStyle = INK;
  c.beginPath();
  c.moveTo(x + s * r * len, y + k * r * len);
  c.lineTo(x - k * r * w, y + s * r * w);
  c.lineTo(x - s * r * 0.18, y - k * r * 0.18);
  c.lineTo(x + k * r * w, y - s * r * w);
  c.closePath();
  c.fill();
}

export function hub(c: Ctx, x: number, y: number, r: number): void {
  c.fillStyle = "#2b2d30";
  c.beginPath();
  c.arc(x, y, r * 0.09, 0, Math.PI * 2);
  c.fill();
}


/** THE ATTITUDE: the sky and the ground behind the fixed aircraft, the
 * horizon moved with the pitch and turned with the roll, the bank pointer
 * on its scale. */
export function attitudeBall(
  c: Ctx,
  x: number,
  y: number,
  r: number,
  g: { pitch: number; roll: number },
): void {
  c.save();
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.clip();
  c.translate(x, y);
  c.rotate(-g.roll);
  const shift = Math.max(-1.2, Math.min(1.2, g.pitch / deg(30))) * r * 0.75;
  c.fillStyle = "#2c78c4";
  c.fillRect(-r * 2, -r * 3 + shift, r * 4, r * 3);
  c.fillStyle = "#5a3a1f";
  c.fillRect(-r * 2, shift, r * 4, r * 3);
  c.strokeStyle = "#ffffff";
  c.lineWidth = r * 0.03;
  c.beginPath();
  c.moveTo(-r * 2, shift);
  c.lineTo(r * 2, shift);
  c.stroke();
  // The pitch ladder, every 5°.
  c.lineWidth = r * 0.02;
  for (let p = -20; p <= 20; p += 5) {
    if (p === 0) continue;
    const yy = shift - (p / 30) * r * 0.75;
    const w = p % 10 === 0 ? r * 0.3 : r * 0.15;
    c.beginPath();
    c.moveTo(-w, yy);
    c.lineTo(w, yy);
    c.stroke();
  }
  c.restore();
  // The bank scale round the top and its pointer, turned with the roll.
  c.save();
  c.translate(x, y);
  c.strokeStyle = INK;
  c.lineWidth = r * 0.04;
  for (const a of [-60, -30, -20, -10, 0, 10, 20, 30, 60]) {
    const s = Math.sin(deg(a));
    const k = -Math.cos(deg(a));
    const r0 = a % 30 === 0 ? 0.8 : 0.87;
    c.beginPath();
    c.moveTo(s * r * r0, k * r * r0);
    c.lineTo(s * r * 0.97, k * r * 0.97);
    c.stroke();
  }
  c.rotate(-g.roll);
  c.fillStyle = AMBER;
  c.beginPath();
  c.moveTo(0, -r * 0.78);
  c.lineTo(-r * 0.07, -r * 0.65);
  c.lineTo(r * 0.07, -r * 0.65);
  c.closePath();
  c.fill();
  c.restore();
  // The fixed aircraft.
  c.strokeStyle = AMBER;
  c.lineWidth = r * 0.06;
  c.beginPath();
  c.moveTo(x - r * 0.5, y);
  c.lineTo(x - r * 0.18, y);
  c.lineTo(x - r * 0.1, y + r * 0.08);
  c.moveTo(x + r * 0.5, y);
  c.lineTo(x + r * 0.18, y);
  c.lineTo(x + r * 0.1, y + r * 0.08);
  c.stroke();
  c.fillStyle = AMBER;
  c.beginPath();
  c.arc(x, y, r * 0.04, 0, Math.PI * 2);
  c.fill();
}

/** THE HSI: the compass card turned to the heading under the lubber line. */
export function compassCard(
  c: Ctx,
  x: number,
  y: number,
  r: number,
  g: { heading: number },
): void {
  c.fillStyle = FACE;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.save();
  c.translate(x, y);
  c.rotate(deg(-g.heading));
  c.strokeStyle = INK;
  c.fillStyle = INK;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = `bold ${Math.round(r * 0.17)}px sans-serif`;
  for (let d = 0; d < 360; d += 5) {
    const a = deg(d);
    const long = d % 10 === 0;
    c.lineWidth = long ? r * 0.03 : r * 0.018;
    c.beginPath();
    c.moveTo(Math.sin(a) * r * (long ? 0.8 : 0.87), -Math.cos(a) * r * (long ? 0.8 : 0.87));
    c.lineTo(Math.sin(a) * r * 0.95, -Math.cos(a) * r * 0.95);
    c.stroke();
    if (d % 30 === 0) {
      const word = d === 0 ? "N" : d === 90 ? "E" : d === 180 ? "S" : d === 270 ? "W" : `${d / 10}`;
      c.save();
      c.translate(Math.sin(a) * r * 0.65, -Math.cos(a) * r * 0.65);
      c.rotate(a);
      c.fillText(word, 0, 0);
      c.restore();
    }
  }
  c.restore();
  // The lubber line and the aircraft.
  c.fillStyle = AMBER;
  c.beginPath();
  c.moveTo(x, y - r * 0.98);
  c.lineTo(x - r * 0.06, y - r * 0.84);
  c.lineTo(x + r * 0.06, y - r * 0.84);
  c.closePath();
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = r * 0.05;
  c.beginPath();
  c.moveTo(x, y - r * 0.3);
  c.lineTo(x, y + r * 0.3);
  c.moveTo(x - r * 0.25, y - r * 0.02);
  c.lineTo(x + r * 0.25, y - r * 0.02);
  c.moveTo(x - r * 0.1, y + r * 0.26);
  c.lineTo(x + r * 0.1, y + r * 0.26);
  c.stroke();
  label(c, x, y + r * 0.5, r * 0.15, String(Math.round(g.heading) % 360).padStart(3, "0"), AMBER);
}

/** A seven-segment readout's window, lit green while `on`. */
export function window7(c: Ctx, x: number, y: number, w: number, h: number, text: string, on: boolean) {
  c.fillStyle = "#050505";
  c.fillRect(x, y, w, h);
  if (!on) return;
  c.fillStyle = "#57ff6e";
  c.font = `bold ${Math.round(h * 0.72)}px monospace`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(text, x + w / 2, y + h / 2 + 1);
}

/** A round knob, lit from the top left. */
export function knob(c: Ctx, x: number, y: number, r: number): void {
  const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
  g.addColorStop(0, "#5b5e63");
  g.addColorStop(1, "#151618");
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}

/** A row of push buttons with words. */
export function keys(c: Ctx, x: number, y: number, w: number, h: number, words: readonly string[]) {
  const kw = w / words.length;
  words.forEach((word, i) => {
    c.fillStyle = "#2a2c2f";
    c.fillRect(x + i * kw + 3, y, kw - 6, h);
    c.fillStyle = "#cfd2cc";
    c.font = `bold ${Math.round(h * 0.38)}px sans-serif`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(word, x + i * kw + kw / 2, y + h / 2);
  });
}
