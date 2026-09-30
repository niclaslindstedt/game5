// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A SKIER LEAVES IN THE SNOW, as arithmetic. Every probe the engine
// reports (`SkierState.contacts` — the left ski's tip, mid and tail, then
// the right's) lays a CAPSULE from where it touched at the last stamp to
// where it touches now, so a trail is continuous at any speed and at any
// frame rate. `trail-map.ts` draws those capsules into the world-space
// trail map; this module decides what each one is, and is three-free so
// the suite reads it (`tests/trail_stamp_test.ts`).
//
// THE DEPTH IS DRAWN, NOT MEASURED. The engine's `sink` is what its support
// model needs: a ski planing across powder at speed is carried a couple of
// centimetres into it, and a trough two centimetres deep is invisible from a
// chase camera. The eye knows better — a skier through fresh powder leaves
// a furrow a hand deep whatever his speed, because the snow he planed over
// has been PRESSED, not merely skimmed. So the drawn depth is the physics'
// sink or the powder's own furrow, whichever is deeper, with the furrow
// scaled by how much of the snow there was powder (`packedAt`): full in a
// virgin meadow, a faint scuff on the groomed piste.
//
// TWO TRACKS, AND WHAT THE TURN DOES TO THEM. The skis run a stance apart,
// each a ski-width wide: the tip ploughs the furrow and the mid and the
// tail run in it, so one ski is one line. A CARVE is the skis on their
// edges: the groove goes narrower and deeper — two clean railed lines, the
// pencil lines a carved turn leaves on a groomer. A SKID is the skis
// pivoted across the way: the capsules go wider and shallower, and the
// two lines smear into one scraped band with a berm pushed out ahead of
// it. All of it falls out of the probes and the engine's `edge` and `skid`
// rather than being drawn as a decal.
//
// THE SNOW DECIDES THE FURROW'S SHAPE (`snowpack.ts`), when the caller says
// what snow it is: new snow takes the deepest furrow with its walls sloughed
// back in and hardly a berm; a wind slab a shallow cut with square walls;
// wet spring snow crisp walls and a real berm beside them; the groomer a
// scuff. Left unsaid, a probe is in settled powder over the packed field —
// the picture the game had before it knew one snow from another.

import { RAGDOLL, type SnowContact } from "@engine";

import type { SnowProps } from "./snowpack.ts";

/** What the snow is at a plan point (`snowpack.ts`'s `snowAt`, bound to a
 * run's snowpack). */
export type SnowSampler = (x: number, z: number) => SnowProps;

/** How far loose powder stands over the groomed track, m: the drawn snow is
 * the ground plus this on virgin powder, fading to none on the groomer
 * (`snow-glsl.ts` lifts it; anything standing on the snow stands on it). */
export const LOOSE = 0.1;

export const TRAIL = {
  /** The deepest trough the map can hold, m — the encoding's full scale:
   * a skier standing in a metre of fresh snow sits some 70 cm down in it
   * (`snow.deep`), and its hole is drawn that deep, at 4 mm a byte. */
  maxDepth: 1,
  /** The tallest berm, m — the second channel's full scale. */
  maxBerm: 0.12,
  /** The furrow a ski cuts in virgin powder, m, whatever the physics'
   * sink: under the boot, and at the tip, which ploughs deepest, and the
   * tail, which rides in the tip's cut. */
  powderSki: 0.12,
  powderTip: 0.15,
  powderTail: 0.09,
  /** THE CARVE: how much narrower and deeper an edged ski's groove is at a
   * full edge, as shares; THE SKID: how much wider and shallower a
   * pivoted ski's scrape is at a full skid. */
  carveNarrow: 0.55,
  carveDeep: 0.6,
  skidWide: 1.6,
  skidShallow: 0.5,
  /** ...and on fully packed snow, m — a scuff the grain barely shows. */
  packedDepth: 0.012,
  /** The berm thrown up beside a furrow, as a share of its depth, and how
   * far it reaches out past the furrow's edge, as a share of its width. */
  bermShare: 0.35,
  bermReach: 0.9,
  /** A probe that has moved further than this since its last stamp is a
   * reset or a teleport, not a trail, m. */
  jump: 6,
  /** A THROWN RIDER's gouge (`bodyStampOf`): its width, m — shoulders and a
   * flung arm — and its depth in virgin powder, m. */
  body: 0.7,
  bodyDepth: 0.14,
  /** The walls of a furrow in settled powder (`SnowProps.wall`), and the
   * power its cross-section falls away with at the softest and the hardest
   * wall: 1 − u^k, k from `wallSoft` to `wallHard`. */
  wall: 0.25,
  wallSoft: 2,
  wallHard: 10,
};

/** One capsule of trail: from (ax, az) to (bx, bz), `half` wide either side
 * of that line, pressed `depth` m, with a berm `berm` m high beside it. */
export type Stamp = {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  half: number;
  depth: number;
  berm: number;
  /** How its walls stand, 0 sloughed … 1 square (`SnowProps.wall`);
   * settled powder's (`TRAIL.wall`) when left out. */
  wall?: number;
};

/** THE DEPTH A PROBE IS DRAWN AT, m, on snow `packed` (0 powder … 1
 * groomed) — its load share (`0..1`) scales the furrow, so a ski barely
 * kissing the snow on a hop leaves less than one carrying the skier, and
 * the run's snow dial (`GameState.snowDepth`) scales the powder's own
 * furrow the way it scales the physics' sink: a dusting leaves a scuff, a
 * dump a trench. Given the SNOW (`snowpack.ts`), its `give` is the
 * furrow's share instead — the packed field and the dial are already in
 * it. */
export function drawnDepth(
  contact: SnowContact,
  packed: number,
  load = 1,
  depth = 1,
  snow?: SnowProps,
): number {
  const base =
    contact.station === "tip"
      ? TRAIL.powderTip
      : contact.station === "tail"
        ? TRAIL.powderTail
        : TRAIL.powderSki;
  const p = Math.min(1, Math.max(0, packed));
  const share = snow
    ? Math.max(TRAIL.packedDepth, base * snow.give)
    : base * depth * (1 - p) + TRAIL.packedDepth * p;
  const drawn = share * Math.min(1, Math.max(0.25, load));
  return Math.min(TRAIL.maxDepth, Math.max(contact.sink, drawn));
}

/** The last place each probe of one skier was stamped. */
export type TrailPen = { xs: Float64Array; zs: Float64Array; down: Uint8Array };

export function createPen(probes: number): TrailPen {
  return {
    xs: new Float64Array(probes),
    zs: new Float64Array(probes),
    down: new Uint8Array(probes),
  };
}

/** How the skis are being used, as the trail reads it: the edge they
 * stand on (0 flat … 1 the most) and the skid across the way (0..1). */
export type Carve = { edge: number; skid: number };

/** A stamp's width and depth scaled by the carve and the skid: an edged
 * ski cuts a narrower, deeper groove; a pivoted one scrapes wide and
 * shallow. */
export function carveShape(carve: Carve | undefined): { width: number; depth: number } {
  if (!carve) return { width: 1, depth: 1 };
  const e = Math.min(1, Math.max(0, carve.edge)) * (1 - Math.min(1, Math.max(0, carve.skid)));
  const k = Math.min(1, Math.max(0, carve.skid));
  return {
    width: (1 - (1 - TRAIL.carveNarrow) * e) * (1 + (TRAIL.skidWide - 1) * k),
    depth: (1 + (TRAIL.carveDeep - 1) * e) * (1 - (1 - TRAIL.skidShallow) * k),
  };
}

/**
 * The capsules one skier lays since his last stamp, pushed onto `out`.
 * `packedAt` is the level's own; `nominalLoad` is the load (N) a probe
 * carries standing still, which is what "a full furrow" is measured
 * against; `depth` is the run's snow dial; `snowAt`, when given, says what
 * snow each probe is in (`snowpack.ts`) and shapes the furrow by it;
 * `carve` the edge and the skid the skis are on, which shape the groove.
 */
export function stampsOf(
  contacts: readonly SnowContact[],
  pen: TrailPen,
  packedAt: (x: number, z: number) => number,
  nominalLoad: number,
  out: Stamp[],
  depth = 1,
  snowAt?: SnowSampler,
  carve?: Carve,
): void {
  const shape = carveShape(carve);
  for (let i = 0; i < contacts.length && i < pen.xs.length; i++) {
    const c = contacts[i];
    if (!c.touching) {
      pen.down[i] = 0;
      continue;
    }
    const was = pen.down[i] === 1;
    const ax = was ? pen.xs[i] : c.x;
    const az = was ? pen.zs[i] : c.z;
    const moved = Math.hypot(c.x - ax, c.z - az);
    pen.xs[i] = c.x;
    pen.zs[i] = c.z;
    pen.down[i] = 1;
    if (moved > TRAIL.jump) continue;
    const load = nominalLoad > 0 ? c.load / nominalLoad : 1;
    const snow = snowAt?.(c.x, c.z);
    const drawn = Math.min(
      TRAIL.maxDepth,
      drawnDepth(c, packedAt(c.x, c.z), load, depth, snow) * shape.depth,
    );
    out.push({
      ax,
      az,
      bx: c.x,
      bz: c.z,
      half: c.width * 0.5 * shape.width,
      depth: drawn,
      berm: Math.min(TRAIL.maxBerm, drawn * (snow ? snow.berm : TRAIL.bermShare)),
      wall: snow ? snow.wall : TRAIL.wall,
    });
  }
}

/** THE BODY'S TRAIL: a thrown skier (`Thrown`, `crash.ts`) sliding on the
 * snow ploughs a wide, shallow gouge of his own — a body is a footprint
 * too, and the sprawl it leaves is the one mark on the map that says a
 * crash happened here. One capsule from where he last touched to where he
 * touches now, drawn as a furrow of `TRAIL.body` width at the powder's own
 * depth (a scuff on the groomer), and — given the body's `points`
 * (`RAGDOLL`) — every bone of him pressed in (`BONES`), so a body lying in
 * powder lies in the body-shaped hole it made rather than under the snow. `pen` is a one-probe pen of its own, and `snowAt`, when given,
 * shapes it by the snow it slides through. */
export function bodyStampOf(
  body: { x: number; z: number; touching: boolean; points?: readonly number[] },
  pen: TrailPen,
  packedAt: (x: number, z: number) => number,
  out: Stamp[],
  snowAt?: SnowSampler,
): void {
  if (!body.touching) {
    pen.down[0] = 0;
    return;
  }
  const was = pen.down[0] === 1;
  const ax = was ? pen.xs[0] : body.x;
  const az = was ? pen.zs[0] : body.z;
  pen.xs[0] = body.x;
  pen.zs[0] = body.z;
  pen.down[0] = 1;
  if (Math.hypot(body.x - ax, body.z - az) > TRAIL.jump) return;
  const snow = snowAt?.(body.x, body.z);
  const p = Math.min(1, Math.max(0, packedAt(body.x, body.z)));
  const depth = snow
    ? Math.max(TRAIL.packedDepth * 2, TRAIL.bodyDepth * snow.give)
    : TRAIL.bodyDepth * (1 - p) + TRAIL.packedDepth * 2 * p;
  const berm = Math.min(TRAIL.maxBerm, depth * (snow ? snow.berm : TRAIL.bermShare));
  const wall = snow ? snow.wall : TRAIL.wall;
  const half = TRAIL.body / 2;
  out.push({ ax, az, bx: body.x, bz: body.z, half, depth, berm, wall });
  const q = body.points;
  if (!q) return;
  for (const [i, j, half] of BONES) {
    out.push({
      ax: q[3 * i],
      az: q[3 * i + 2],
      bx: q[3 * j],
      bz: q[3 * j + 2],
      half,
      depth,
      berm,
      wall,
    });
  }
}

/** THE BODY PRESSED IN: every bone of a thrown skier's body (`RAGDOLL`)
 * and the half-width, m, of the hollow it leaves — the trunk, the thighs
 * and shins, the arms. */
const R = RAGDOLL;
const BONES: readonly (readonly [number, number, number])[] = [
  [R.head, R.hipL, 0.22],
  [R.head, R.hipR, 0.22],
  [R.hipL, R.kneeL, 0.1],
  [R.hipR, R.kneeR, 0.1],
  [R.kneeL, R.footL, 0.1],
  [R.kneeR, R.footR, 0.1],
  [R.shoulderL, R.elbowL, 0.08],
  [R.shoulderR, R.elbowR, 0.08],
  [R.elbowL, R.handL, 0.08],
  [R.elbowR, R.handR, 0.08],
];

/** The power a furrow's cross-section falls away with for walls `wall`
 * (0 sloughed … 1 square). */
export function wallPower(wall: number): number {
  return TRAIL.wallSoft + (TRAIL.wallHard - TRAIL.wallSoft) * Math.min(1, Math.max(0, wall));
}

/** The cross-section of one furrow at `d` m from its centreline: how far
 * the snow is pressed (0..1 of the stamp's depth) and how much berm stands
 * there (0..1 of its berm), for walls `wall` (settled powder's when left
 * out). The GLSL in `trail-map.ts` is this, verbatim. */
export function furrowProfile(
  d: number,
  half: number,
  wall = TRAIL.wall,
): { press: number; berm: number } {
  const u = d / Math.max(half, 1e-6);
  const press = u < 1 ? 1 - u ** wallPower(wall) : 0;
  const reach = TRAIL.bermReach;
  const v = (u - 0.8) / reach;
  const berm = v > 0 && v < 1 ? Math.sin(Math.PI * v) : 0;
  return { press, berm };
}

/**
 * WHERE THE FINE WINDOW STANDS. The fine map is a square `span` m wide that
 * follows the player; it is moved only when he has ridden `slack` m off its
 * centre, and then onto a multiple of `texel` so a texel of the old map
 * lands exactly on a texel of the new one. Returns the new centre, or null
 * when the window stays.
 */
export function recentre(
  cx: number,
  cz: number,
  px: number,
  pz: number,
  slack: number,
  texel: number,
): { x: number; z: number } | null {
  if (Math.abs(px - cx) < slack && Math.abs(pz - cz) < slack) return null;
  return { x: Math.round(px / texel) * texel, z: Math.round(pz / texel) * texel };
}
