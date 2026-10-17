// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FLICKER METER — how steady a moving picture is, measured off frames
// drawn 1/60 s apart through a lens that does not move: what a burning
// wreck's fire does between one frame and the next. A fire is always
// moving, so motion is not the fault; FLICKER is change that does not
// grow with the gap — a tongue blinking in and out, a puff popping to
// the front of the sort, a light strobing — where a flame licking up
// changes the more the longer you wait. So each film is read as:
//
//   * `step`  — the mean change of a moving pixel's brightness from one
//               frame to the next, 0..1;
//   * `index` — that change against the change four frames apart: a
//               quarter is a picture that only flows, one is a strobe;
//   * `pops`  — the share of moving pixels a frame that jump by more than
//               a quarter of full scale in one frame;
//   * `light` — the frame's mean brightness from one frame to the next, as
//               a share of itself (a fire's light strobing on the snow).
//
// The pixels are read off a small copy of the canvas (the moving ones are
// those that change at all over the film), so the meter is the same on any
// frame size. Lab-only: nothing in the game reads it.

/** One film's numbers (`readFilm`). */
export type Flicker = { step: number; index: number; pops: number; light: number };

const W = 320;
const H = 180;

/** A film being read: hand it every frame as it is drawn, then `read`. */
export function createFilm(canvas: HTMLCanvasElement) {
  const copy = document.createElement("canvas");
  copy.width = W;
  copy.height = H;
  const ctx = copy.getContext("2d", { willReadFrequently: true })!;
  const frames: Float32Array[] = [];
  return {
    /** The canvas as drawn now, taken as the film's next frame. */
    take(): void {
      ctx.drawImage(canvas, 0, 0, W, H);
      const px = ctx.getImageData(0, 0, W, H).data;
      const lum = new Float32Array(W * H);
      for (let i = 0; i < lum.length; i++)
        lum[i] = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255;
      frames.push(lum);
    },
    read(): Flicker {
      const n = frames.length;
      const size = W * H;
      // The moving pixels: any that change by more than a hair over the film.
      const moving = new Uint8Array(size);
      let count = 0;
      for (let i = 0; i < size; i++) {
        let lo = 1;
        let hi = 0;
        for (const f of frames) {
          lo = Math.min(lo, f[i]);
          hi = Math.max(hi, f[i]);
        }
        if (hi - lo > 0.04) {
          moving[i] = 1;
          count++;
        }
      }
      const gap = (g: number): number => {
        let s = 0;
        let k = 0;
        for (let f = 0; f + g < n; f++) {
          const a = frames[f];
          const b = frames[f + g];
          for (let i = 0; i < size; i++) if (moving[i]) s += Math.abs(b[i] - a[i]);
          k += count;
        }
        return k ? s / k : 0;
      };
      let jumps = 0;
      for (let f = 0; f + 1 < n; f++)
        for (let i = 0; i < size; i++)
          if (moving[i] && Math.abs(frames[f + 1][i] - frames[f][i]) > 0.25) jumps++;
      const means = frames.map((f) => f.reduce((s, v) => s + v, 0) / size);
      let light = 0;
      for (let f = 0; f + 1 < n; f++) light += Math.abs(means[f + 1] - means[f]) / means[f];
      const step = gap(1);
      const four = gap(4);
      return {
        step,
        index: four > 0 ? step / four : 0,
        pops: count && n > 1 ? jumps / (count * (n - 1)) : 0,
        light: n > 1 ? light / (n - 1) : 0,
      };
    },
  };
}

/** The numbers as a caption's line. */
export function flickerLine(f: Flicker): string {
  return (
    `flicker: step ${(f.step * 100).toFixed(2)}% · index ${f.index.toFixed(2)} · ` +
    `pops ${(f.pops * 100).toFixed(2)}% · light ${(f.light * 100).toFixed(2)}%`
  );
}
