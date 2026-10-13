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
//
// THE DEEPER THE CUT, THE MORE THE WALLS SLOUGH (`slough`). A ski is a hand
// wide, but loose snow cannot stand in a wall a hand apart and a thigh
// deep: it slumps back to its angle of repose, so a furrow in deep powder
// is a TRENCH as wide as it is deep, its sides fallen in round a ski cut
// still showing in its floor — and the two skis' trenches run together into
// the one wide track a skier leaves in bottomless snow. A crust holds a
// square wall, and a groomer's scuff is too shallow to slump at all. So the
// snow's depth reads in three bands of its own: a groomer's two pencil
// lines, powder's soft trough a boot deep, and deep snow's trench.
//
// THREE FOOTPRINTS, NOT ONE. What cuts the snow decides the track as much as
// the snow does, and the eye tells them apart at a glance:
//
//   * SKIS leave TWO lines a stance apart, each a hand wide — on a groomer
//     two pencil lines, edged into narrow railed grooves; in deep powder
//     two troughs that slough together into one.
//   * A SNOWBOARD (a contact with `side` 0, `suspension.ts`) leaves ONE line
//     as wide as the deck. On its edge the whole base is laid into the
//     snow at the edge's angle, so the cut is a WEDGE — deep under the edge
//     it stands on, shallowing across the deck, square on the edge's side —
//     and the snow it shoves out piles on the OTHER side, the turn's
//     outside (`Stamp.tilt`). A wider base floats higher in powder
//     (`TRAIL.board.float`) and rounds its trough (`.wall`); skidded, it is
//     a long deck sideways, a scraped band a board long.
//   * A SNOWMOBILE (`sled-scene.ts`) leaves a belt's FLAT-BOTTOMED TRENCH,
//     packed hard and SQUARE-WALLED, its floor printed across with the
//     paddles' imprints (`Stamp.belt`, drawn by the shader off the trail
//     map's blue and alpha as the groomer's comb is), between two narrow
//     ski grooves each with a keel's line down its middle.
//
// The skis and the board share the edge's tilt, which is the physics': a
// ski stood on its edge cuts a wedge too, only too narrow to read.

import { RAGDOLL, type SkierState, type SnowContact } from "@engine";

import type { SnowProps } from "./snowpack.ts";

/** What the snow is at a plan point (`snowpack.ts`'s `snowAt`, bound to a
 * run's snowpack). */
export type SnowSampler = (x: number, z: number) => SnowProps;

/** How far loose powder stands over the groomed track, m: the drawn snow is
 * the ground plus this on virgin powder, fading to none on the groomer
 * (`snow-glsl.ts` lifts it; anything standing on the snow stands on it). */
export const LOOSE = 0.1;

/** New snow that buries the groomed track's LOOK outright, m: a few
 * centimetres cover the comb's corduroy and the grey of worked snow — and
 * fill a piste machine's fresh swath the same (`trail-map.ts`'s `fill`). */
export const FRESH_LOOK = 0.06;

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
  /** ...and the hole a bone SUNK past that leaves (`bodyHole`): this much
   * wider than the bone, a share of its half-width — the snow he went in
   * through, which closes round a body only so far. */
  bodyRoom: 1.4,
  /** The walls of a furrow in settled powder (`SnowProps.wall`), and the
   * power its cross-section falls away with at the softest and the hardest
   * wall: 1 − u^k, k from `wallSoft` to `wallHard`. */
  wall: 0.25,
  wallSoft: 2,
  wallHard: 10,
  /** THE SLOUGHED WALLS: how far out a cut's walls fall, as a share of its
   * depth, in snow with no wall at all (`wall` 0 — a square wall, 1, stands
   * where it was cut); a cut shallower than `sloughFrom` m stands, and one
   * past `sloughFull` slumps all the way. The trench they leave is
   * `sloughDeep` of the cut's depth, its walls falling away as `u³`. */
  slough: 1.4,
  sloughFrom: 0.03,
  sloughFull: 0.09,
  sloughDeep: 0.88,
  /** THE DECK pressed between a ski's or a board's tip and tail
   * (`stampsOf`), as a share of the shallowest of its stations' cuts. */
  deck: 0.7,
  /** THE PLANE (`planeOf`): a ski at speed rides up onto the powder (the
   * physics' sink falls as exp(−(v / `snow.planeSpeed`)²)), so the furrow
   * it leaves is shallower, and with it the trench its walls slough into —
   * a fast line a narrow trough, a slow one a trench. Drawn slower to fall
   * than the physics' sink, m/s, and never under `floor` of the furrow:
   * a planing ski still packs the snow it rides on. */
  plane: { speed: 9, floor: 0.45 },
  /** A SNOWBOARD's own: its trough as a share of a ski's furrow in powder
   * (a wider base, the same load, floats higher); how much narrower and
   * deeper its edged cut is at a full edge, as shares — the whole base laid
   * into the snow at the edge's angle, where a ski's edge only scores it; how much softer its walls
   * stand (a rounded U, the base's own shape); its skid's scrape, wider and
   * shallower than a ski's, as shares at a full skid. THE FLOAT'S DEPTH:
   * the deepest a board's own cut is drawn in powder, m, at a crawl
   * (`boardCut`) — a board's wide base floats where a ski's sinks, so the
   * deck rides at the snow's surface, at most a few centimetres under it
   * with the boots' soles in the snow, whatever the physics' sink. */
  board: {
    bury: 0.07,
    float: 0.8,
    carveNarrow: 0.45,
    carveDeep: 1.8,
    wall: 0.6,
    skidWide: 1.25,
    skidShallow: 0.4,
  },
  /** A SNOWMOBILE's belt (`sled-scene.ts`): the least its trench's walls
   * stand (packed under the paddles, they hold square), and the keel's
   * groove down each ski — its half width, m, and how much deeper than the
   * ski's own groove, m (the runner under a ski is a steel rod). */
  belt: { wall: 0.8 },
  keel: { half: 0.012, deep: 0.02 },
  /** THE PADDLES' PRINT across a belt's floor (`snow-glsl.ts`): their pitch
   * along the belt, m (a deep-snow belt's 2.86 in), how deep each lug's
   * imprint is drawn, m, and how wide a staggered row of paddle runs
   * across the belt before the next is offset by half a pitch, m. */
  lug: { pitch: 0.073, depth: 0.012, row: 0.135 },
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
  /** THE SLOUGHED TRENCH round the cut, m either side of the line
   * (`sloughOf`): its walls fallen back to that half-width, `sloughDeep` of
   * the cut deep. None — or no wider than `half` — is the cut alone. */
  slough?: number;
  /** A PISTE MACHINE'S SWATH (`groomer.ts`), not a furrow: everything under
   * it is wiped back to the snow's own surface and marked groomed, the comb
   * running along it (`trail-map.ts`'s groom pass). `depth` and `berm` are
   * nought. */
  groom?: boolean;
  /** THE EDGE'S TILT, −1 … 1: the cut laid as a wedge, deepest on the side
   * of the line it is positive toward (+ the right of the way it runs, a
   * to b), shallowing to nothing across it at ±1, and its berm thrown out
   * the other side. None — 0 — is the even cut. */
  tilt?: number;
  /** A SNOWMOBILE'S BELT: as a furrow, and its floor PACKED and printed
   * with the paddles — the trail map's blue set and its alpha the belt's
   * axis, read by the shader (`trail-map.ts`'s `trailBeltAt`). */
  belt?: boolean;
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

/** THE CUT A BOARD'S STATION DRAWS, m, before the carve's shape: the
 * powder's furrow at the board's float (`TRAIL.board.float`) and the plane
 * at `speed` m/s, never deeper than `board.bury` of it — a board floats,
 * so neither its trench nor the deck drawn in it (`board-input.ts`'s
 * `boardRideSink`) goes down with the physics' sink in deep snow. */
export function boardCut(
  contact: SnowContact,
  packed: number,
  load = 1,
  depth = 1,
  snow?: SnowProps,
  speed = 0,
): number {
  const plane = planeOf(speed);
  const float = TRAIL.board.float * plane;
  const give = snow ? { ...snow, give: snow.give * float } : snow;
  const cap = Math.max(TRAIL.packedDepth, TRAIL.board.bury * plane);
  return Math.min(cap, drawnDepth(contact, packed, load, depth * float, give));
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
 * stand on (0 flat … 1 the most) and the skid across the way (0..1) —
 * and, when given, which way the edge is (`side`, + his right) and his
 * right in the plan (`rightX`, `rightZ`), which lay the edged cut as a
 * wedge on the edge's side (`Stamp.tilt`). */
export type Carve = {
  edge: number;
  skid: number;
  side?: number;
  rightX?: number;
  rightZ?: number;
  /** How fast he is going, m/s — what lifts a ski onto the powder. */
  speed?: number;
};

/** How a skier is using his skis or his board, as his trail reads it. */
export function carveOf(skier: SkierState): Carve {
  return {
    edge: Math.abs(skier.edge) / Math.max(0.3, skier.spec.edgeMax),
    skid: skier.skid,
    side: Math.sign(skier.edge),
    rightX: Math.cos(skier.heading),
    rightZ: -Math.sin(skier.heading),
    speed: skier.speed,
  };
}

/** THE PLANE: the share of the powder's furrow a ski or a board going
 * `speed` m/s still cuts — the whole of it at a crawl, falling as
 * exp(−(v / speed)²) to the `floor` a planing ski still packs. */
export function planeOf(speed = 0): number {
  const { speed: v0, floor } = TRAIL.plane;
  return floor + (1 - floor) * Math.exp(-((speed / v0) ** 2));
}

/** A stamp's width and depth scaled by the carve and the skid: an edged
 * ski cuts a narrower, deeper groove; a pivoted one scrapes wide and
 * shallow — a board by its own shares (`board`). */
export function carveShape(
  carve: Carve | undefined,
  board = false,
): { width: number; depth: number } {
  if (!carve) return { width: 1, depth: 1 };
  const e = edgeShare(carve);
  const k = Math.min(1, Math.max(0, carve.skid));
  const narrow = board ? TRAIL.board.carveNarrow : TRAIL.carveNarrow;
  const wide = board ? TRAIL.board.skidWide : TRAIL.skidWide;
  const shallow = board ? TRAIL.board.skidShallow : TRAIL.skidShallow;
  const deep = board ? TRAIL.board.carveDeep : TRAIL.carveDeep;
  return {
    width: (1 - (1 - narrow) * e) * (1 + (wide - 1) * k),
    depth: (1 + (deep - 1) * e) * (1 - (1 - shallow) * k),
  };
}

/** How much of the edge the cut stands on: the edge, less the skid. */
function edgeShare(carve: Carve): number {
  return Math.min(1, Math.max(0, carve.edge)) * (1 - Math.min(1, Math.max(0, carve.skid)));
}

/** THE TILT a cut from (ax, az) to (bx, bz) is laid at (`Stamp.tilt`): the
 * edge's share, on the side of the way he went that his edged side is — so
 * riding switch, or skidded across the way, it reads the right way round,
 * and fades as the cut runs across his right rather than along it. */
export function tiltOf(
  carve: Carve | undefined,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  if (!carve || carve.rightX === undefined || carve.rightZ === undefined || !carve.side) return 0;
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return 0;
  // The way's right in the plan (heading 0 along +z, clockwise from above).
  const across = (carve.rightX * dz - carve.rightZ * dx) / len;
  return Math.max(-1, Math.min(1, edgeShare(carve) * Math.sign(carve.side) * across));
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
  const skiShape = carveShape(carve);
  const boardShape = carveShape(carve, true);
  const plane = planeOf(carve?.speed);
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
    const board = c.side === 0;
    const shape = board ? boardShape : skiShape;
    const load = nominalLoad > 0 ? c.load / nominalLoad : 1;
    const snow = snowAt?.(c.x, c.z);
    const packed = packedAt(c.x, c.z);
    let cut: number;
    if (board) cut = boardCut(c, packed, load, depth, snow, carve?.speed);
    else {
      const give = snow && plane !== 1 ? { ...snow, give: snow.give * plane } : snow;
      cut = drawnDepth(c, packed, load, depth * plane, give);
    }
    const drawn = Math.min(TRAIL.maxDepth, cut * shape.depth);
    const half = c.width * 0.5 * shape.width;
    const wall = (snow ? snow.wall : TRAIL.wall) * (board ? TRAIL.board.wall : 1);
    // The edged cut stands under the EDGE, not the middle of the base: moved
    // over by what the narrowing took off, toward the edged side.
    const tilt = tiltOf(carve, ax, az, c.x, c.z);
    const off = carve?.side ? Math.max(0, c.width * 0.5 - half) * Math.sign(carve.side) : 0;
    const ox = off * (carve?.rightX ?? 0);
    const oz = off * (carve?.rightZ ?? 0);
    const stamp: Stamp = {
      ax: ax + ox,
      az: az + oz,
      bx: c.x + ox,
      bz: c.z + oz,
      half,
      depth: drawn,
      berm: Math.min(TRAIL.maxBerm, drawn * (snow ? snow.berm : TRAIL.bermShare)),
      wall,
      slough: sloughOf(half, drawn, wall),
    };
    if (tilt !== 0) stamp.tilt = tilt;
    out.push(stamp);
    // Kept for the deck below: the column's ends where they stand now.
    const col = c.side + 1;
    if (c.station === "tip") {
      deck.tx[col] = stamp.bx;
      deck.tz[col] = stamp.bz;
      deck.tip[col] = 1;
    } else if (c.station === "tail") {
      deck.lx[col] = stamp.bx;
      deck.lz[col] = stamp.bz;
      deck.tail[col] = 1;
    }
    deck.half[col] = Math.min(deck.half[col], half);
    deck.depth[col] = Math.min(deck.depth[col], drawn);
    deck.wall[col] = wall;
  }
  // THE DECK: a ski or a board presses its whole length, not three points of
  // it — tip to tail where it lies now. Run straight it lies in its own
  // line; skidded across the way it lays the scraped band a deck long that
  // the stations' own lines would leave gaps in.
  for (let col = 0; col < 3; col++) {
    if (deck.tip[col] && deck.tail[col]) {
      const depth = deck.depth[col] * TRAIL.deck;
      const stamp: Stamp = {
        ax: deck.tx[col],
        az: deck.tz[col],
        bx: deck.lx[col],
        bz: deck.lz[col],
        half: deck.half[col],
        depth,
        berm: 0,
        wall: deck.wall[col],
      };
      const tilt = tiltOf(carve, stamp.ax, stamp.az, stamp.bx, stamp.bz);
      if (tilt !== 0) stamp.tilt = tilt;
      out.push(stamp);
    }
    deck.tip[col] = 0;
    deck.tail[col] = 0;
    deck.half[col] = Infinity;
    deck.depth[col] = Infinity;
  }
}

/** The deck's scratch, a column a side (left ski, board, right ski). */
const deck = {
  tx: new Float64Array(3),
  tz: new Float64Array(3),
  lx: new Float64Array(3),
  lz: new Float64Array(3),
  tip: new Uint8Array(3),
  tail: new Uint8Array(3),
  half: new Float64Array(3).fill(Infinity),
  depth: new Float64Array(3).fill(Infinity),
  wall: new Float64Array(3),
};

/** THE BODY'S TRAIL: a thrown skier (`Thrown`, `crash.ts`) sliding on the
 * snow ploughs a wide, shallow gouge of his own — a body is a footprint
 * too, and the sprawl it leaves is the one mark on the map that says a
 * crash happened here. One capsule from where he last touched to where he
 * touches now, drawn as a furrow of `TRAIL.body` width at the powder's own
 * depth (a scuff on the groomer), and — given the body's `points`
 * (`RAGDOLL`) — every bone of him pressed in (`BONES`), so a body lying in
 * powder lies in the body-shaped hole it made rather than under the snow.
 * Given the ground (`groundAt`), every bone's hole goes down to where that
 * bone actually lies: in deep powder the engine lets a body sink a third of
 * a metre and more, and a hole drawn only a hand deep left him under the
 * snow, gone (`bodyHole`). `pen` is a one-probe pen of its own, and
 * `snowAt`, when given, shapes it by the snow it slides through. */
export function bodyStampOf(
  body: { x: number; z: number; touching: boolean; points?: readonly number[] },
  pen: TrailPen,
  packedAt: (x: number, z: number) => number,
  out: Stamp[],
  snowAt?: SnowSampler,
  groundAt?: (x: number, z: number) => number,
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
  for (const [i, j, bone] of BONES) {
    const x0 = q[3 * i];
    const z0 = q[3 * i + 2];
    const x1 = q[3 * j];
    const z1 = q[3 * j + 2];
    const hole = groundAt
      ? bodyHole(
          (x0 + x1) / 2,
          (z0 + z1) / 2,
          Math.min(q[3 * i + 1], q[3 * j + 1]),
          bone,
          packedAt,
          groundAt,
        )
      : 0;
    if (hole <= depth) {
      out.push({ ax: x0, az: z0, bx: x1, bz: z1, half: bone, depth, berm, wall });
      continue;
    }
    // Sunk past the gouge: the hole to his own depth, a little wider than
    // he is, its walls slumped as deep a cut's are in snow this loose,
    // and the snow he shoved aside heaped round its rim.
    const wide = bone * TRAIL.bodyRoom;
    out.push({
      ax: x0,
      az: z0,
      bx: x1,
      bz: z1,
      half: wide,
      depth: hole,
      berm: Math.min(TRAIL.maxBerm, hole * (snow ? snow.berm : TRAIL.bermShare)),
      wall,
      slough: sloughOf(wide, hole, wall),
    });
  }
}

/** THE IMPACT CRATER a body leaves where it comes down out of the air
 * onto the snow (`craterStampOf`): the speed into the snow, m/s, at which
 * it starts to show and at which it is as big as it gets; its half-width,
 * m, from the first to the last; and how much deeper than the body's own
 * gouge it is pressed at the hardest, as a share. The snow it shoves out
 * stands round it as a rim, `rim` times the furrow's own berm. */
export const CRATER = { from: 3, full: 14, half: [0.45, 1.05], deep: 2.6, rim: 1.8 };

/** THE CRATER: a body met by the snow at `impact` m/s into it, a round
 * pit at (x, z) — wider and deeper the harder it came down, its walls
 * slumped by the snow, its rim the snow it threw out — the mark a fall
 * out of the air leaves before the slide's gouge leads away from it. A
 * groomer takes a shallow dish; powder a hole. Nothing under `CRATER.from`. */
export function craterStampOf(
  x: number,
  z: number,
  impact: number,
  packed: number,
  out: Stamp[],
  snow?: SnowProps,
): void {
  if (impact < CRATER.from) return;
  const power = Math.min(1, (impact - CRATER.from) / (CRATER.full - CRATER.from));
  const p = Math.min(1, Math.max(0, packed));
  const own = snow
    ? Math.max(TRAIL.packedDepth * 2, TRAIL.bodyDepth * snow.give)
    : TRAIL.bodyDepth * (1 - p) + TRAIL.packedDepth * 2 * p;
  const depth = Math.min(TRAIL.maxDepth * 0.6, own * (1 + CRATER.deep * power));
  const half = CRATER.half[0] + (CRATER.half[1] - CRATER.half[0]) * power;
  const wall = snow ? snow.wall : TRAIL.wall;
  const berm = Math.min(TRAIL.maxBerm, depth * (snow ? snow.berm : TRAIL.bermShare) * CRATER.rim);
  out.push({
    ax: x,
    az: z,
    bx: x,
    bz: z + 1e-3,
    half,
    depth,
    berm,
    wall,
    slough: sloughOf(half, depth, wall),
  });
}

/** HOW DEEP A BONE'S HOLE IS DRAWN, m: from the drawn snow over the bone's
 * middle (`x`, `z` — the ground and the loose snow `LOOSE` stands over it)
 * down to the underside of the bone, whose lower end's centre is at `y`
 * and which is `half` m thick each side — never past the map's full scale. */
export function bodyHole(
  x: number,
  z: number,
  y: number,
  half: number,
  packedAt: (x: number, z: number) => number,
  groundAt: (x: number, z: number) => number,
): number {
  const p = Math.min(1, Math.max(0, packedAt(x, z)));
  const surface = groundAt(x, z) + LOOSE * (1 - p);
  return Math.min(TRAIL.maxDepth, Math.max(0, surface - (y - half)));
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

/** THE TRENCH'S HALF-WIDTH round a cut `half` m either side and `depth` m
 * deep, in snow whose walls stand `wall` (0 sloughed … 1 square): the cut
 * itself where it is too shallow to slump or the wall holds. */
export function sloughOf(half: number, depth: number, wall: number): number {
  const t = Math.min(
    1,
    Math.max(0, (depth - TRAIL.sloughFrom) / (TRAIL.sloughFull - TRAIL.sloughFrom)),
  );
  const slump = t * t * (3 - 2 * t) * TRAIL.slough * (1 - Math.min(1, Math.max(0, wall)));
  return half + depth * slump;
}

/** The power a furrow's cross-section falls away with for walls `wall`
 * (0 sloughed … 1 square). */
export function wallPower(wall: number): number {
  return TRAIL.wallSoft + (TRAIL.wallHard - TRAIL.wallSoft) * Math.min(1, Math.max(0, wall));
}

/** The cross-section of one furrow at `d` m from its centreline (+ to the
 * right of the way it runs): how far the snow is pressed (0..1 of the
 * stamp's depth) and how much berm stands there (0..1 of its berm), for
 * walls `wall` (settled powder's when left out), a sloughed trench
 * `slough` m either side (none when left out) and an edge's `tilt`
 * (`Stamp.tilt`, none when left out) — the cut, laid as a wedge on its
 * deep side, or the trench's `sloughDeep` round it, whichever is the
 * deeper, the berm thrown up past the trench's edge, heaped on the side
 * away from the edge. The GLSL in `trail-map.ts` is this, verbatim. */
export function furrowProfile(
  d: number,
  half: number,
  wall = TRAIL.wall,
  slough = half,
  tilt = 0,
): { press: number; berm: number } {
  const a = Math.abs(d);
  const u = a / Math.max(half, 1e-6);
  const outer = Math.max(half, slough);
  const w = a / outer;
  const lean = Math.max(-1, Math.min(1, d / Math.max(half, 1e-6)));
  const wedge = 1 - Math.abs(tilt) * 0.5 * (1 - Math.sign(tilt) * lean);
  const cut = u < 1 ? (1 - u ** wallPower(wall)) * wedge : 0;
  const bowl = outer > half && w < 1 ? TRAIL.sloughDeep * (1 - w * w * w) : 0;
  const press = Math.max(cut, bowl);
  const reach = TRAIL.bermReach;
  const v = (w - 0.8) / reach;
  const heap = Math.max(0, 1 - 0.8 * tilt * Math.sign(d));
  const berm = v > 0 && v < 1 ? Math.sin(Math.PI * v) * heap : 0;
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
