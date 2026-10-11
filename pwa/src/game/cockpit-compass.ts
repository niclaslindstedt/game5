// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER'S WET COMPASS, ITS FACE PAINTED IN CODE (`heli-cockpit.ts`
// hangs the case off the windscreen's centre post, as the light utility
// helicopter's standby compass is) — canvas only, three-free.

type Ctx = CanvasRenderingContext2D;

/** THE WET COMPASS'S FACE: its canvas, px (as wide as it is tall — the
 * case's front, the card's window in its top and the deviation card under). */
export const COMPASS_PX = 192;

/** THE WET COMPASS'S FACE at `heading` deg: the card floating in its bowl
 * seen through the window, read against the lubber line — its numbers
 * running the wrong way round, as a card seen from behind its middle does
 * (33 to the right of N) — and under it the deviation card in its holder. */
export function paintCompass(c: Ctx, heading: number): void {
  const S = COMPASS_PX;
  c.fillStyle = "#121315";
  c.fillRect(0, 0, S, S);
  // The window: the card through the fluid, a little bowed.
  const wx = S * 0.1;
  const wy = S * 0.1;
  const ww = S * 0.8;
  const wh = S * 0.5;
  c.save();
  c.beginPath();
  c.ellipse(S / 2, wy + wh / 2, ww / 2, wh / 2, 0, 0, Math.PI * 2);
  c.clip();
  const card = c.createLinearGradient(wx, 0, wx + ww, 0);
  card.addColorStop(0, "#020202");
  card.addColorStop(0.5, "#1d1e1f");
  card.addColorStop(1, "#020202");
  c.fillStyle = card;
  c.fillRect(wx, wy, ww, wh);
  const perDeg = ww / 70;
  const mid = S / 2;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.strokeStyle = "#e8e4d6";
  c.fillStyle = "#e8e4d6";
  c.lineWidth = 2;
  const from = Math.floor((heading - 40) / 5) * 5;
  for (let d = from; d <= heading + 40; d += 5) {
    const x = mid - (d - heading) * perDeg;
    const v = ((d % 360) + 360) % 360;
    const big = v % 30 === 0;
    c.beginPath();
    c.moveTo(x, wy + wh * 0.72);
    c.lineTo(x, wy + wh * (big ? 0.5 : v % 10 === 0 ? 0.58 : 0.64));
    c.stroke();
    if (big) {
      const word = ({ 0: "N", 90: "E", 180: "S", 270: "W" } as Record<number, string>)[v];
      c.font = `bold ${Math.round(wh * (word ? 0.32 : 0.26))}px sans-serif`;
      c.fillText(word ?? String(v / 10), x, wy + wh * 0.3);
    }
  }
  // The fluid's shade toward the bowl's rim.
  const shade = c.createRadialGradient(mid, wy + wh / 2, wh * 0.2, mid, wy + wh / 2, ww * 0.55);
  shade.addColorStop(0, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.75)");
  c.fillStyle = shade;
  c.fillRect(wx, wy, ww, wh);
  c.restore();
  // The lubber line, down the window's middle.
  c.strokeStyle = "#d8372c";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(mid, wy + 4);
  c.lineTo(mid, wy + wh - 4);
  c.stroke();
  // The window's chrome ring.
  c.strokeStyle = "#5d6065";
  c.lineWidth = 4;
  c.beginPath();
  c.ellipse(S / 2, wy + wh / 2, ww / 2, wh / 2, 0, 0, Math.PI * 2);
  c.stroke();
  // The deviation card in its holder: FOR over STEER, in pencil.
  const dy = S * 0.68;
  const dh = S * 0.24;
  c.fillStyle = "#d9d5c4";
  c.fillRect(S * 0.12, dy, S * 0.76, dh);
  c.strokeStyle = "#6c6a62";
  c.lineWidth = 1;
  for (let k = 1; k < 6; k++) {
    const x = S * 0.12 + (S * 0.76 * k) / 6;
    c.beginPath();
    c.moveTo(x, dy);
    c.lineTo(x, dy + dh);
    c.stroke();
  }
  c.beginPath();
  c.moveTo(S * 0.12, dy + dh / 2);
  c.lineTo(S * 0.88, dy + dh / 2);
  c.stroke();
  c.fillStyle = "#2b2a28";
  c.font = `${Math.round(dh * 0.28)}px sans-serif`;
  ["N", "30", "60", "E", "120", "150"].forEach((w, k) => {
    const x = S * 0.12 + (S * 0.76 * (k + 0.5)) / 6;
    c.fillText(w, x, dy + dh * 0.26);
    const steer = (k * 30 + [2, 1, 0, -2, 1, 2][k] + 360) % 360;
    c.fillText(String(steer).padStart(3, "0"), x, dy + dh * 0.76);
  });
}
