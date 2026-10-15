// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CONTRAILS — three-free and DOM-free: which airliners cross the sky
// over a map, when, how high and how fast, whether each one lays a trail,
// how long that trail lives, how wide it has spread and where the wind
// aloft has carried it, at any moment of a run. A PURE FUNCTION of the
// map's seed and the run's clock `t` (real seconds: the planes fly at
// their real speed, whatever the sky's clock does with the sun), dealt off
// hashes on a salt of its own — never `state.rng` — so nothing in it can
// move a digest. `contrail-glsl.ts` draws what it hands out in the dome,
// and `docs/contrails.md` is the research behind every number.
//
// WHETHER A TRAIL FORMS is the Schmidt–Appleman criterion: the exhaust's
// heat and water mixed into the air outside run through water saturation
// only when that air is colder than a threshold that hangs on the pressure
// at the flight's height and the air's humidity — about −40 °C saturated
// and −46 °C dry at a cruise's 250 hPa. Warmer than that, no trail at all.
// HOW LONG IT LIVES is the humidity over ICE: in air short of ice
// saturation the crystals sublimate within seconds to a minute (a short
// trail a few hundred metres to fifteen kilometres behind the plane); in
// ICE-SUPERSATURATED air — a slab a kilometre or two deep, far commoner
// under a high veil or ahead of a front — they grow, and the trail PERSISTS
// for an hour and more, spreading kilometres wide and drifting on the wind
// at its height, so a humid day builds a cross-hatch of them.
//
// A TRAIL IS ONE STRAIGHT SEGMENT. The plane flies straight and the wind
// aloft is one vector at its height, so every point of the trail laid at
// time s now stands at P(s) + W·(t − s): linear in s, a straight line from
// the plane (or where it left the sky) back to the oldest part still
// there, its age running linearly along it. Everything that grows with age
// — the width, the thinning, the puffs — is read by the shader off that.

import {
  freeAirTempAt,
  frontAt,
  hasLid,
  weatherOf,
  windFromOf,
  type Level,
  type WeatherKind,
} from "@engine";

import { cloudHash, veerAloft, windAloft } from "./cloud-field.ts";

/** THE NUMBERS. Their sources are `docs/contrails.md`'s. */
export const CONTRAIL = {
  /** The flights' timetable: one slot a minute, and the odds a slot holds
   * none, one, two or three crossings (a mean of one a minute — sometimes
   * two close together, sometimes a quiet spell). */
  slot: 60,
  perSlot: [0.3, 0.45, 0.2, 0.05],
  /** The sky a flight is followed through: within `reach` m (level) of the
   * map's middle, passing at most `miss` m off it. */
  reach: 80000,
  miss: 42000,
  /** Cruise: m/s over the ground, and the altitude over the sea, m — most
   * at the airways' levels, a share lower (climbing, descending, short
   * hops). */
  speed: [225, 255] as const,
  cruise: [9400, 12200] as const,
  low: [7200, 9400] as const,
  lowShare: 0.22,
  /** Of the flights, the share that keep to one of a map's two AIRWAYS
   * (bearings dealt off the seed, ± `lane` rad), the rest anywhere. */
  airway: 0.65,
  lane: 0.12,
  /** THE TRAIL AS LAID: its width once the engines' lines have merged, m,
   * and the optical depth it starts at. */
  width: [22, 40] as const,
  tau: [0.3, 0.55] as const,
  /** A trail's first seconds are its densest — the crystals packed into
   * the wake before it spreads — `young` times the optical depth more,
   * falling off over `youngTime` s. */
  young: 2.5,
  youngTime: 40,
  /** The dark gap behind the plane, s: the exhaust's water has not yet
   * frozen out (a few hundred metres). */
  gap: 1.2,
  /** How fast the trail widens, m/s: a short one barely; a persistent one
   * at the lidar's measured 0.3–2.3 m/s, a little over so a player sees it
   * within a minute or two. */
  spread: [0.5, 2.8] as const,
  dryspread: 0.25,
  /** The wake's sink: the vortex pair takes the trail down `sink` m over
   * its first minutes (e-folding `sinkTime` s). */
  sink: 180,
  sinkTime: 70,
  /** A short trail's life, s, at an ice humidity of 40 % and of 99 %. */
  life: [6, 75] as const,
  /** A persistent trail's: how old it may be, s, and when it starts to
   * thin out for good. */
  persist: 5400,
  fade: 3600,
  /** The humid layer: dealt per `window` s of the run, its odds under each
   * sky, its depth and its humidity over ice. */
  window: 2400,
  humid: {
    clear: 0.08,
    fair: 0.22,
    flurries: 0.3,
    high: 0.8,
    overcast: 0.85,
    snow: 0.85,
    storm: 0.85,
    fog: 0.18,
  } satisfies Record<WeatherKind, number>,
  layer: [900, 2400] as const,
  /** The share of the flights through a humid layer's heights that cross
   * its supersaturated air: the layer is patchy, so some planes over it
   * trail for an hour and the next leaves a short line. */
  patch: 0.55,
  wet: [1.03, 1.3] as const,
  /** The ice humidity of a flight outside the humid layer. */
  dry: [0.3, 0.97] as const,
  /** THE AIR MASS a map is dealt aloft (`airAloft`), ± °C. */
  airMass: 8,
  /** How many trails the dome draws at most. */
  most: 16,
  /** WHAT A SKIER SEES OF THE TRAFFIC: a plane's glint only within
   * `glintReach` m slant of the lens (fading from `glintClear`) and only
   * while the sun is on it; a short trail only within `shortReach`; and at
   * most `busy` crossings (a plane or a short trail) at once, the nearest —
   * a dry day shows one or two, never a sky of specks. Lasting bands are
   * ranked on their own. */
  glintReach: 55000,
  glintClear: 25000,
  shortReach: 55000,
  shortClear: 30000,
  busy: 3,
  /** The most a trail shows by a full moon high in the sky: a faint grey
   * line against the stars (`contrails.ts`'s `nightShow`). */
  moonShow: 0.12,
} as const;

const SALT = 0x0c7a11a5;
const TAU = Math.PI * 2;
const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;
const band = (b: readonly [number, number], u: number): number => lerp(b[0], b[1], u);
const h = (seed: number, salt: number): number => cloudHash((seed ^ SALT) >>> 0, salt);

// --- THE AIR ALOFT ---------------------------------------------------------

/** A lab's hand on the air mass (°C), or null for the map's own. */
let forcedMass: number | null = null;
export function forceAirMass(next: number | null): void {
  forcedMass = next;
  SLOTS = new WeakMap();
}

/** The air mass a map is dealt: how much warmer or colder than the
 * season's mean its air is, °C. */
export function airMassOf(level: Pick<Level, "seed">): number {
  if (forcedMass !== null) return forcedMass;
  const u = (h(level.seed, 11) + h(level.seed, 12)) / 2;
  return (u * 2 - 1) * CONTRAIL.airMass;
}

/** What of a map the plan reads. */
type PlanLevel = Pick<Level, "seed" | "sun" | "region" | "weather" | "front" | "mountain">;

/**
 * THE FREE AIR'S TEMPERATURE at `altitude` m over the sea on `level` at
 * run time `t`, °C — THE ONE PLACE THE PLAN READS A TEMPERATURE: the
 * engine's free air (`freeAirTempAt`: the valley's day mean, the sky's
 * offset and the TEMPERATURE knob's shift, falling 6.5 °C a kilometre to a
 * tropopause set by the latitude and the season, isothermal over it), and
 * the air mass the map is dealt aloft on top — the day-to-day swing of the
 * upper air a mean cannot know.
 */
export function airAloft(level: PlanLevel, t: number, altitude: number): number {
  return freeAirTempAt(level, t, altitude) + airMassOf(level);
}

/** The pressure at `altitude` m over the sea, hPa (the standard
 * atmosphere). */
export function pressureAt(altitude: number): number {
  if (altitude <= 11000) return 1013.25 * Math.pow(1 - 2.25577e-5 * altitude, 5.25588);
  return 226.32 * Math.exp(-(altitude - 11000) / 6341.6);
}

/** Water's and ice's saturation pressures, hPa, at `T` °C (Magnus). */
const eWater = (T: number): number => 6.112 * Math.exp((17.62 * T) / (243.12 + T));
const eIce = (T: number): number => 6.112 * Math.exp((22.46 * T) / (272.62 + T));

/**
 * THE SCHMIDT–APPLEMAN THRESHOLD, °C: the warmest air at `hPa` and water
 * humidity `rhw` (0..1) a trail forms in. Schumann's fit for saturated air
 * off the mixing line's slope G (a modern engine's overall efficiency of
 * 0.3, kerosene's heat and water), and the dry air's a few degrees colder.
 */
export function formationTemp(hPa: number, rhw: number): number {
  const G = (1.25 * 1004 * hPa * 100) / (0.622 * 43.2e6 * (1 - 0.3));
  const l = Math.log(Math.max(G - 0.053, 1e-3));
  const saturated = -46.46 + 9.43 * l + 0.72 * l * l;
  return saturated - 4.6 * (1 - Math.min(1, Math.max(0, rhw)));
}

// --- THE HUMID LAYER ---------------------------------------------------------

/** The sky over the map at run time `t` (a front's nearer one). */
function kindAt(level: Pick<Level, "weather" | "front">, t: number): WeatherKind {
  const f = frontAt(level, t);
  return f.share < 0.5 ? f.a.kind : f.b.kind;
}

export type HumidLayer = { base: number; top: number; rhi: number } | null;

/** THE ICE-SUPERSATURATED LAYER over the map through the window holding
 * `t`, or null: dealt a window at a time, its odds the sky's. */
export function humidLayerAt(
  level: Pick<Level, "seed" | "weather" | "front">,
  t: number,
): HumidLayer {
  const k = Math.floor(t / CONTRAIL.window);
  const salt = 1000 + ((k & 0xffff) << 3);
  const kind = kindAt(level, (k + 0.5) * CONTRAIL.window);
  if (h(level.seed, salt) >= CONTRAIL.humid[kind]) return null;
  const depth = band(CONTRAIL.layer, h(level.seed, salt + 1));
  const base = lerp(
    CONTRAIL.low[0] + 600,
    CONTRAIL.cruise[1] - depth * 0.5,
    h(level.seed, salt + 2),
  );
  return { base, top: base + depth, rhi: band(CONTRAIL.wet, h(level.seed, salt + 3)) };
}

// --- THE FLIGHTS --------------------------------------------------------------

/** One airliner's crossing. Positions in the map's world frame (x, z, m;
 * heading 0 along +z, clockwise from above). */
export type Flight = {
  /** Its own number, for the hashes. */
  id: number;
  /** When it passes nearest the map's middle, s of run time. */
  tc: number;
  /** Its heading, rad; its speed, m/s; its altitude over the sea, m. */
  heading: number;
  speed: number;
  altitude: number;
  /** How far off the map's middle it passes, m (signed: to its right). */
  miss: number;
  /** The free air's temperature there, °C; its humidity over ice. */
  temp: number;
  rhi: number;
  /** Whether a trail forms; whether it persists; how long a short one
   * lives, s; how fast it spreads, m/s. */
  forms: boolean;
  persists: boolean;
  life: number;
  spread: number;
  /** As laid: its width, m, and optical depth; the puffs' phase. */
  width: number;
  tau: number;
  phase: number;
};

/** A map's two airways, rad. */
function airways(seed: number): [number, number] {
  return [h(seed, 21) * Math.PI, h(seed, 22) * Math.PI + Math.PI / 2];
}

/** How many flights slot `k` holds. */
function countIn(seed: number, k: number): number {
  let u = h(seed, 100000 + k * 7);
  for (let n = 0; n < CONTRAIL.perSlot.length; n++) {
    u -= CONTRAIL.perSlot[n];
    if (u < 0) return n;
  }
  return 0;
}

/** THE FLIGHTS OF SLOT `k` (run seconds `k·slot` to `(k + 1)·slot`). */
export function flightsOfSlot(level: PlanLevel, k: number): Flight[] {
  const seed = level.seed;
  const n = countIn(seed, k);
  const ways = airways(seed);
  const out: Flight[] = [];
  for (let j = 0; j < n; j++) {
    const id = k * 4 + j;
    const u = (s: number): number => h(seed, 200000 + id * 31 + s);
    const tc = (k + u(0)) * CONTRAIL.slot;
    // Along an airway (either way along it) or anywhere.
    const on = u(1) < CONTRAIL.airway;
    const way = ways[u(2) < 0.5 ? 0 : 1] + (u(3) < 0.5 ? 0 : Math.PI);
    const heading = on ? way + (u(4) * 2 - 1) * CONTRAIL.lane : u(4) * TAU;
    const altitude =
      u(5) < CONTRAIL.lowShare ? band(CONTRAIL.low, u(6)) : band(CONTRAIL.cruise, u(6));
    const temp = airAloft(level, tc, altitude);
    const layer = humidLayerAt(level, tc);
    const inside =
      layer !== null && altitude >= layer.base && altitude <= layer.top && u(14) < CONTRAIL.patch;
    const rhi = inside ? layer.rhi : band(CONTRAIL.dry, u(7));
    const rhw = (rhi * eIce(temp)) / eWater(temp);
    const forms = temp < formationTemp(pressureAt(altitude), rhw);
    const persists = forms && rhi >= 1;
    const dryness = Math.min(1, Math.max(0, (rhi - 0.4) / 0.59));
    out.push({
      id,
      tc,
      heading,
      speed: band(CONTRAIL.speed, u(8)),
      altitude,
      miss: (u(9) * 2 - 1) * CONTRAIL.miss,
      temp,
      rhi,
      forms,
      persists,
      life: persists
        ? CONTRAIL.persist
        : lerp(CONTRAIL.life[0], CONTRAIL.life[1], dryness * dryness),
      spread: persists ? band(CONTRAIL.spread, u(10)) : CONTRAIL.dryspread,
      width: band(CONTRAIL.width, u(11)),
      tau: band(CONTRAIL.tau, u(12)),
      phase: u(13),
    });
  }
  return out;
}

/** Every flight whose crossing comes nearest the middle in [from, to). */
export function flightsBetween(level: PlanLevel, from: number, to: number): Flight[] {
  const out: Flight[] = [];
  const k0 = Math.floor(from / CONTRAIL.slot);
  const k1 = Math.ceil(to / CONTRAIL.slot);
  for (let k = k0; k < k1; k++)
    for (const f of slotOf(level, k)) if (f.tc >= from && f.tc < to) out.push(f);
  return out;
}

// A small memo of the slots: the dome asks the same hour of slots every
// frame. Keyed by the level (a weak map, so a map let go takes it along).
let SLOTS = new WeakMap<object, Map<number, Flight[]>>();
function slotOf(level: PlanLevel, k: number): Flight[] {
  let m = SLOTS.get(level);
  if (!m) {
    m = new Map();
    SLOTS.set(level, m);
  }
  let f = m.get(k);
  if (!f) {
    f = flightsOfSlot(level, k);
    if (m.size > 400) m.clear();
    m.set(k, f);
  }
  return f;
}

// --- THE TRAILS AT A MOMENT ----------------------------------------------------

/** One trail as the dome draws it: a segment from its HEAD (the plane, or
 * where the plane left the sky) to its TAIL (its oldest part still there),
 * world x, z; the world y it was laid at; the ages at either end, s; the
 * distance along the flight path each end was laid at, m (fixed in the
 * air: the puffs ride it); and what the flight dealt it. */
export type Trail = {
  flight: Flight;
  head: [number, number];
  tail: [number, number];
  y: number;
  ageHead: number;
  ageTail: number;
  alongHead: number;
  alongTail: number;
  /** Whether the plane is still in the sky over the head: its glint. */
  plane: boolean;
  /** The rank it is drawn by: the more of the sky it fills, the higher. */
  score: number;
  /** The slant distance from the map's middle to the plane (or a gone
   * plane's trail's nearest point), m. */
  slant: number;
};

/** What a trail is reckoned in: the map's middle (world x, z), the sea's
 * world y and the wind aloft. */
export type TrailFrame = {
  cx: number;
  cz: number;
  sea: number;
  /** The wind aloft at a trail's height, toward (x, z), m/s. */
  wind(altitude: number): [number, number];
};

/** The frame of `level`: its ground's middle, its sea, its wind aloft (the
 * dealt sky's: a front's changing wind would race a trail laid an hour ago
 * across the sky). */
export function trailFrameOf(
  level: Pick<Level, "ground" | "mountain" | "weather" | "sun">,
): TrailFrame {
  const g = level.ground;
  const cx = g ? g.originX + ((g.cols - 1) * g.cell) / 2 : 0;
  const cz = g ? g.originZ + ((g.rows - 1) * g.cell) / 2 : 0;
  const sea = level.mountain?.sea ?? 0;
  const floor = level.mountain ? level.mountain.altitude : 0;
  const w = weatherOf(level);
  const from = windFromOf(level);
  const lat = level.sun.latitude;
  return {
    cx,
    cz,
    sea,
    wind(altitude) {
      const over = Math.max(0, altitude - floor);
      const speed = windAloft(w.wind, over, 10);
      const to = from + Math.PI + veerAloft(over, lat);
      return [Math.sin(to) * speed, Math.cos(to) * speed];
    },
  };
}

/** How far the trail laid `age` s ago has sunk under its flight level, m. */
export function sinkOf(age: number): number {
  return CONTRAIL.sink * (1 - Math.exp(-age / CONTRAIL.sinkTime));
}

/** How wide a trail of `flight` is at `age` s, m. */
export function widthAt(flight: Flight, age: number): number {
  return flight.width + flight.spread * Math.max(0, age);
}

/** A trail's optical depth at `age` s (its middle, looking up): thinned
 * as it spreads, grown a while in humid air, gone with a short one's life
 * and a persistent one's last hour — the shader's own rule. */
export function tauAt(flight: Flight, age: number): number {
  const w = widthAt(flight, age);
  const grow = flight.persists ? 1 + 0.6 * smooth(0, 300, age) : 1;
  const fade = flight.persists
    ? 1 - smooth(CONTRAIL.fade, CONTRAIL.persist, age)
    : 1 - smooth(flight.life * 0.35, flight.life, age);
  const young = 1 + CONTRAIL.young * Math.exp(-age / CONTRAIL.youngTime);
  return (
    flight.tau *
    Math.pow(flight.width / w, 0.55) *
    grow *
    young *
    fade *
    smooth(0.2, CONTRAIL.gap, age)
  );
}

function smooth(e0: number, e1: number, x: number): number {
  const u = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return u * u * (3 - 2 * u);
}

/** THE TRAIL OF FLIGHT `f` at run time `t` in `frame` — or null while the
 * plane is not yet in the sky, or once it and its trail are gone. */
export function trailAt(f: Flight, frame: TrailFrame, t: number): Trail | null {
  const R = CONTRAIL.reach;
  const half = Math.sqrt(Math.max(0, R * R - f.miss * f.miss)) / f.speed;
  const te = f.tc - half;
  const tx = f.tc + half;
  if (t < te) return null;
  const plane = t <= tx;
  // The laid times still showing: [sa, sb].
  const sb = Math.min(t, tx);
  const sa = f.forms ? Math.max(te, t - f.life) : sb;
  if (!plane && (!f.forms || sb < t - f.life)) return null;
  const fx = Math.sin(f.heading);
  const fz = Math.cos(f.heading);
  const [wx, wz] = frame.wind(f.altitude);
  const at = (s: number): [number, number] => {
    const along = f.speed * (s - f.tc);
    const age = t - s;
    return [
      frame.cx + fz * f.miss + fx * along + wx * age,
      frame.cz - fx * f.miss + fz * along + wz * age,
    ];
  };
  const head = at(sb);
  const tail = at(sa);
  const ageHead = t - sb;
  const ageTail = t - sa;
  // Its rank: the sky it fills (its width × its length × how dense), the
  // far ones less.
  const mid = at((sa + sb) / 2);
  const off = Math.hypot(mid[0] - frame.cx, mid[1] - frame.cz);
  const ageMid = (ageHead + ageTail) / 2;
  const dense = f.forms ? tauAt(f, Math.min(ageMid, Math.max(ageHead, CONTRAIL.gap * 2))) : 0;
  const length = f.speed * (sb - sa);
  const fills = dense * Math.min(1, Math.sqrt(widthAt(f, ageMid) * (length + 500)) / 3000);
  // A plane still crossing is ranked by how near overhead it is now: a new
  // one over the lens is never crowded out by an old band.
  const near = plane ? 1.2 / (1 + Math.hypot(head[0] - frame.cx, head[1] - frame.cz) / 20000) : 0;
  const seg = segmentDistance(frame.cx, frame.cz, head, tail);
  const slant = Math.hypot(
    plane ? Math.hypot(head[0] - frame.cx, head[1] - frame.cz) : seg,
    f.altitude,
  );
  return {
    flight: f,
    head,
    tail,
    y: frame.sea + f.altitude,
    ageHead,
    ageTail,
    alongHead: f.speed * (sb - f.tc),
    alongTail: f.speed * (sa - f.tc),
    plane,
    score: fills / (1 + off / 30000) + near,
    slant,
  };
}

/** The plan distance from (x, z) to the segment a–b, m. */
function segmentDistance(x: number, z: number, a: [number, number], b: [number, number]): number {
  const ax = b[0] - a[0];
  const az = b[1] - a[1];
  const L2 = ax * ax + az * az;
  const u = L2 > 0 ? Math.min(1, Math.max(0, ((x - a[0]) * ax + (z - a[1]) * az) / L2)) : 0;
  return Math.hypot(x - a[0] - ax * u, z - a[1] - az * u);
}

/** HOW MUCH OF THE HIGH SKY SHOWS at run time `t`: none under a lid (a
 * front's lid eased in and out), all of it otherwise. The cloud drawn in
 * front of the trails hides the rest. */
export function contrailShow(level: Pick<Level, "weather" | "front">, t: number): number {
  const f = frontAt(level, t);
  const a = hasLid(f.a.kind) ? 0 : 1;
  const b = hasLid(f.b.kind) ? 0 : 1;
  return a + (b - a) * f.share;
}

/**
 * THE TRAILS IN THE SKY over `level` at run time `t`, best first, at most
 * `most` of them — every flight still crossing (its glint, and its trail
 * if one forms) and every trail laid in the last `CONTRAIL.persist` s that
 * is still there and still over the map.
 */
export function contrailsAt(
  level: PlanLevel,
  frame: TrailFrame,
  t: number,
  most: number = CONTRAIL.most,
): Trail[] {
  const out: Trail[] = [];
  if (contrailShow(level, t) <= 0) return out;
  // A crossing lasts at most 2R / v; a persistent trail an hour and a half.
  const span = (2 * CONTRAIL.reach) / CONTRAIL.speed[0];
  const crossing: Trail[] = [];
  for (const f of flightsBetween(level, t - CONTRAIL.persist - span, t + span)) {
    const r = trailAt(f, frame, t);
    if (!r) continue;
    // A plane too far off to glint is only its trail.
    if (r.plane && r.slant > CONTRAIL.glintReach) r.plane = false;
    const lasting = f.forms && f.persists && r.ageTail > 120;
    if (lasting) {
      if (r.score > 0.002) out.push(r);
      continue;
    }
    // A plane or a young or short trail: only the near ones read.
    const short = f.forms && r.slant <= CONTRAIL.shortReach;
    if (r.plane || short) crossing.push(r);
  }
  crossing.sort((a, b) => a.slant - b.slant);
  out.push(...crossing.slice(0, CONTRAIL.busy));
  // And no more than `busy` glints in all, the nearest.
  const planes = out.filter((r) => r.plane).sort((a, b) => a.slant - b.slant);
  for (const r of planes.slice(CONTRAIL.busy)) r.plane = false;
  out.sort((a, b) => b.score - a.score);
  if (out.length > most) out.length = most;
  return out;
}
