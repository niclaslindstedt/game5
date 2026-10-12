// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE OTHER SKIERS' TRACKS ON THE PISTE — presentation only. A groomed run
// at the first chair is the night's corduroy whole; within the first hour
// of traffic it carries a scatter of clean lines (a carver's two thin
// grooves a hip apart, deepest at the turn's apex where the edges bite
// hardest, with a little snow thrown out on the outside of each turn; a
// skidder's broad smear widening at the apex; a snowboard's one wider
// band), crossing one another down the fall line. By late morning the
// whole run is printed with them and the comb survives only between; by
// the afternoon they are blurred into one another, wider and shallower,
// the edges of every one softened by the skis that crossed it, and the
// piste reads as churned, scraped snow rather than lines.
//
// What drives it is the hours of traffic the runs have taken
// (`pisteDayOf`'s `skied`, off the map's own hour, date and sky — the same
// clock the free ride's physics reads), on EVERY map whatever the mode:
// `tracksOf` turns it into how many tracks (`many`) and how churned they
// are (`churn`), handed to the snow shader as `uTracks` (`haze.ts`'s
// `setRunSnow`). The tracks themselves are a pure function of the world
// position — columns across the piste's own direction, a skier's line
// wandering down each, dealt off a hash — so nothing is stepped, stored or
// drawn from the engine's stream, and no digest can see them.

/** The numbers, each with its unit. */
export const PISTE_TRACKS = {
  /** Hours of full traffic for `1 − 1/e` of the run's lines to be printed:
   * a busy groomer is tracked across within an hour or two of the first
   * chair. */
  cover: 0.7,
  /** The churn over the hours of traffic: none at `from`, through by `full`
   * — the tracks blur into one another over the middle of the day. */
  churn: { from: 1, full: 6.5 },
  /** The column widths of the three layers of lines across the piste, m. */
  columns: [2.7, 4.1, 6.3],
  /** A carver's two grooves, half the distance between them, m. */
  stance: 0.11,
  /** How wide each kind's groove is crisp, m (a carved edge, a skid's
   * smear, a board) — and how much wider churned. */
  width: { carve: 0.05, skid: 0.3, board: 0.2, churned: 3 },
  /** How deep each is crisp, m, and the share of that left churned. */
  depth: { carve: 0.015, skid: 0.007, board: 0.011, churned: 0.5 },
  /** Out to here the tracks are drawn as grooves, m; past it as streaks. */
  near: [45, 85],
  /** Past this the piste is far enough off that none is drawn, m. */
  far: 400,
} as const;

/** What the shader is handed: how many lines (0..1) and how churned (0..1). */
export type Tracks = { many: number; churn: number };

const T = PISTE_TRACKS;

export const NO_TRACKS: Tracks = { many: 0, churn: 0 };

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** THE TRACKS after `skied` hours of full traffic on the runs. */
export function tracksOf(skied: number): Tracks {
  if (!(skied > 0)) return NO_TRACKS;
  return {
    many: 1 - Math.exp(-skied / T.cover),
    churn: smooth(T.churn.from, T.churn.full, skied),
  };
}

/** THE PISTE'S OWN FRAME on a grid over it: at each cell its offset across
 * the piste (m, right of the line positive) and how far down it it is (m,
 * split in two so a half float carries it to a few centimetres — the
 * whole 64s and the rest; bilinear filtering sums them back exact), and 1
 * where the piste reaches it. The lines are laid in it, so they bend with
 * the piste. A frame turned by the piste's heading at the fragment instead
 * moves a point hundreds of metres from the origin by metres for a hair of
 * a turn, and grooves a few centimetres wide curl. */
export type TrackFrame = {
  /** RGBA, `half` encoded: across, down's 64s, down's rest, inside. */
  data: Uint16Array;
  cols: number;
  rows: number;
  /** Where the first cell's middle is, m, and the cells' size. */
  x0: number;
  z0: number;
  cell: number;
};

/** How far past the piste's edge the frame reaches, m. */
const MARGIN = 12;

export function trackFrameOf(
  track: {
    points: readonly { x: number; z: number; s: number; heading: number; width: number }[];
  },
  cell: number,
  half: (n: number) => number,
): TrackFrame {
  const pts = track.points;
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (const p of pts) {
    const r = p.width / 2 + MARGIN;
    minX = Math.min(minX, p.x - r);
    maxX = Math.max(maxX, p.x + r);
    minZ = Math.min(minZ, p.z - r);
    maxZ = Math.max(maxZ, p.z + r);
  }
  if (!pts.length) {
    minX = minZ = 0;
    maxX = maxZ = cell;
  }
  const cols = Math.max(2, Math.ceil((maxX - minX) / cell) + 1);
  const rows = Math.max(2, Math.ceil((maxZ - minZ) / cell) + 1);
  const data = new Uint16Array(cols * rows * 4);
  const best = new Float32Array(cols * rows).fill(Infinity);
  for (const p of pts) {
    const reach = p.width / 2 + MARGIN;
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    const c0 = Math.max(0, Math.floor((p.x - reach - minX) / cell));
    const c1 = Math.min(cols - 1, Math.ceil((p.x + reach - minX) / cell));
    const r0 = Math.max(0, Math.floor((p.z - reach - minZ) / cell));
    const r1 = Math.min(rows - 1, Math.ceil((p.z + reach - minZ) / cell));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const dx = minX + c * cell - p.x;
        const dz = minZ + r * cell - p.z;
        const d = Math.hypot(dx, dz);
        const k = r * cols + c;
        if (d > reach || d >= best[k]) continue;
        best[k] = d;
        const down = p.s + dx * fx + dz * fz;
        const whole = Math.floor(down / 64) * 64;
        data[k * 4] = half(dx * fz - dz * fx);
        data[k * 4 + 1] = half(whole);
        data[k * 4 + 2] = half(down - whole);
        data[k * 4 + 3] = half(1);
      }
    }
  }
  return { data, cols, rows, x0: minX, z0: minZ, cell };
}

const f = (n: number): string => n.toFixed(4);

/** The snow shader's half: `pisteTracks` lays the lines' grooves into the
 * surface's slope, says how far they have cut the comb away (the return)
 * and how each shades the snow (`snowTrackShade`). Wants `snowHash1`,
 * `snowNoise` and `snowDist` declared before it. */
export const PISTE_TRACKS_GLSL = /* glsl */ `
uniform vec2 uTracks;
uniform sampler2D uTrackFrame;
uniform vec4 uTrackFrameBox;
float snowTrackShade; // −1 .. 1 a groove's shade (−) or a carve's thrown snow (+)
float pisteTracks(vec2 p, vec2 acr, float weight, inout vec2 grad) {
  snowTrackShade = 0.0;
  if (weight < 0.01 || uTracks.x <= 0.0 || snowDist > ${f(T.far)}) return 0.0;
  // Across and down the piste, off its frame; and which way each runs
  // here, for the grooves' slope.
  vec4 fr = texture2D(uTrackFrame, (p - uTrackFrameBox.xy) * uTrackFrameBox.zw);
  weight *= smoothstep(0.6, 0.95, fr.w);
  if (weight < 0.01) return 0.0;
  vec2 alg = vec2(-acr.y, acr.x);
  float u = fr.x;
  float v = fr.y + fr.z;
  // The footprint ACROSS the lines: a line running away from the lens
  // stays sharp however grazing the view, so it is judged by this.
  float pu = fwidth(u);
  float px = length(fwidth(p));
  float churn = uTracks.y;
  float near = 1.0 - smoothstep(${f(T.near[0])}, ${f(T.near[1])}, snowDist);
  float cut = 0.0;
  float shade = 0.0;
  vec2 gr = vec2(0.0);
  if (near > 0.0) {
    for (int i = 0; i < 3; i++) {
      float w = i == 0 ? ${f(T.columns[0])} : i == 1 ? ${f(T.columns[1])} : ${f(T.columns[2])};
      float salt = 7.31 * float(i) + 2.0;
      float cu = u / w + 0.37 * float(i);
      float c0 = floor(cu);
      for (int j = 0; j < 2; j++) {
        float n = j == 0 ? c0 : c0 + (fract(cu) > 0.5 ? 1.0 : -1.0);
        float h0 = snowHash1(vec2(n, salt));
        // Fewer lines early: a column has one once the traffic reaches it.
        if (h0 > uTracks.x) continue;
        float h1 = snowHash1(vec2(n + 0.5, salt + 3.1));
        float h2 = fract(h1 * 7.13 + h0 * 3.7);
        float h3 = fract(h1 * 13.7 + h0 * 11.3);
        float x0 = (n - 0.37 * float(i) + 0.25 + 0.5 * h1) * w;
        float amp = w * mix(0.1, 0.45, h2);
        float lam = mix(12.0, 34.0, h3);
        float a = 6.2831853 * v / lam + h0 * 40.0 + h2 * 17.0;
        float s = sin(a);
        float slope = amp * 6.2831853 / lam * cos(a);
        float inv = inversesqrt(1.0 + slope * slope);
        float d = (u - x0 - amp * s) * inv;
        // The kind: a carver (most), a skidder, a snowboard.
        float kind = fract(h3 * 5.3 + h1 * 2.9);
        float carve = step(kind, 0.6);
        float board = step(0.85, kind);
        float apart = ${f(T.stance)} * carve;
        float wid = mix(mix(${f(T.width.skid)} * (0.6 + 0.8 * abs(s)), ${f(T.width.board)}, board), ${f(T.width.carve)}, carve)
          * mix(1.0, ${f(T.width.churned)}, churn);
        // Older lines are skied over in stretches.
        float keep = smoothstep(-0.45, 0.15, sin(v * 0.035 * (0.7 + h2) + h0 * 31.0) + 0.7 * h1 - 0.2);
        // The groove's relief while a pixel is finer than it; past that
        // the line is kept as a shade, thinned as the pixel outgrows it.
        float k = keep * (1.0 - smoothstep(0.6, 1.6, pu / wid));
        float line = keep * min(1.0, 1.2 * wid / max(pu, 1e-4));
        if (line <= 0.01) continue;
        float depth = mix(mix(${f(T.depth.skid)}, ${f(T.depth.board)}, board), ${f(T.depth.carve)}, carve)
          * mix(1.0, ${f(T.depth.churned)}, churn) * (0.75 + 0.25 * abs(s));
        float d1 = d - apart;
        float d2 = d + apart;
        float iw = 1.0 / (wid * wid);
        float g1 = exp(-d1 * d1 * iw);
        float g2 = carve * exp(-d2 * d2 * iw);
        // h = −depth (g1 + g2), along d; d's slope in (u, v).
        float dh = depth * 2.0 * iw * (d1 * g1 + d2 * g2);
        gr += dh * k * inv * vec2(1.0, -slope);
        cut = max(cut, line * (1.0 - smoothstep(apart + 0.8 * wid, apart + 2.2 * wid, abs(d))));
        // The snow a carve throws out on the outside of its turn.
        float o = (d * sign(s) - apart - 0.14) / (0.07 + 0.2 * churn);
        float spray = carve * exp(-o * o) * s * s;
        shade += line * (spray * 0.7 - (g1 + g2) * mix(0.35, 0.8, carve + board) * (1.0 - 0.4 * churn));
      }
    }
  }
  // Churned, the lines are lost in scraped and heaped patches.
  shade += (snowNoise(p * 0.7 + 23.0) - 0.5) * 0.9 * churn * uTracks.x * near;
  // Further off, the lines as faint streaks down the fall line.
  float streak = snowNoise(vec2(u * 0.8, v * 0.04) + 61.0) - 0.5;
  float sa = 1.0 - smoothstep(0.3, 0.8, px * 0.8);
  shade += streak * 0.6 * uTracks.x * sa * (1.0 - near);
  grad += (acr * gr.x + alg * gr.y) * weight * near;
  snowTrackShade = clamp(shade * 2.5, -1.0, 1.0) * weight;
  return cut * weight * near;
}
`;
