// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CLOUD FIELD UNDER A MOVING SKY — a free ride's FRONT (`front.ts` in
// the engine) turning the dealt sky into others over the sky's clock, drawn
// as one field that MORPHS rather than one swapped for another. Three-free,
// so the suite holds its continuity (`tests/weather_front_test.ts`).
//
// THREE SLOTS. Every sky R19 deals stacks at most one layer in each of
// three places (`SLOT_OF`): LOW (the heaps, a stratocumulus deck, the scud
// under the snow), MID (the mackerel sky, the grey altostratus, the deep
// nimbostratus, the thin cirrostratus veil) and HIGH (the ice streaks). A
// change of sky works slot by slot: a layer of the same genus on both sides
// eases its numbers across (its base, depth, cover, optical depth); one
// genus turning into another — the veil thickening and lowering into an
// altostratus ahead of a warm front, the altostratus into the snow's
// nimbostratus — eases across the same way and swaps its name half way, its
// cover dipped there so the swap is never seen whole; a layer on one side
// only grows from nothing or thins to nothing. So the shaders' three layers
// are never more than three, and nothing pops.
//
// THE DRIFT IS ADDED UP. A layer's place in the noise is its drift so far,
// `speed · t`; when a change moves the wind aloft or the cell's size, a drift
// reckoned as the new speed times the whole run's time would jump the whole
// field kilometres in a breath. So each slot's drift (and the life its cells
// evolve on) is the INTEGRAL of what it was at every moment since the start
// (`frontEaseArea`), and the layer's offsets are laid so the field reads
// exactly that — continuous through every change.
//
// THE INVERSION DECK. A front's skies deal none (`cloudFieldOf`'s
// `lowDeck`): a deck lies in its own slot of the stack and would make four.
// The valley fog keeps its SEA, which sinks into the valley and is gone as
// the fog burns off, or rises out of it as one forms.

import { frontAt, frontEaseArea, type Level, type WeatherFront } from "@engine";
import {
  CLOUD_LAYERS,
  NOISE_CELLS,
  cloudFieldOf,
  cloudHash,
  coverCut,
  veilOf,
  type CloudField,
  type CloudKind,
  type CloudLayer,
} from "./cloud-field.ts";
import type { LowDeck } from "./low-deck.ts";

/** The slot each genus stands in: 0 low, 1 mid, 2 high. */
export const SLOT_OF: Record<CloudKind, number> = {
  cumulus: 0,
  congestus: 0,
  strato: 0,
  fractus: 0,
  altocumulus: 1,
  altostratus: 1,
  nimbo: 1,
  veil: 1,
  cirrus: 2,
};

/** How much a layer's cover dips where one genus turns into another, and
 * over how much of the change either side of its middle. */
const SWAP = { dip: 0.4, half: 0.3 } as const;

/** A sea thinner than this, m, is none. */
const SEA_LEAST = 8;

type Motion = {
  /** How fast it drifts through the noise along the wind, periods/s. */
  p: number;
  /** How fast its cells live through the noise's time axis, periods/s. */
  q: number;
};

type Skies = {
  /** Each leg's field, its layers by slot. */
  fields: CloudField[];
  slots: (CloudLayer | null)[][];
  /** Each leg's motion by slot — a slot a leg leaves empty moves as its
   * nearest neighbour's, so a layer growing from nothing drifts already. */
  motions: Motion[][];
  /** Each slot's place in the noise at the start. */
  start: { ox: number; oz: number; ow: number }[];
};

const motionOf = (l: CloudLayer): Motion => ({
  p: l.speed / (NOISE_CELLS * l.size * l.stretch),
  q: 1 / (NOISE_CELLS * l.life),
});

const skiesOf = new WeakMap<WeatherFront, Skies>();

function skies(
  level: Pick<Level, "seed" | "weather" | "mountain" | "sun">,
  front: WeatherFront,
): Skies {
  const had = skiesOf.get(front);
  if (had) return had;
  const fields = front.legs.map((leg) => cloudFieldOf({ ...level, weather: leg.weather }, false));
  const slots = fields.map((f) => {
    const row: (CloudLayer | null)[] = [null, null, null];
    for (const l of f.layers) row[SLOT_OF[l.kind]] = l;
    return row;
  });
  const motions = slots.map((row, i) =>
    row.map((l, k) => {
      if (l) return motionOf(l);
      // The nearest leg that has one — later first, so a layer growing in
      // already moves as it will.
      for (let d = 1; d < slots.length; d++) {
        const next = slots[i + d]?.[k] ?? slots[i - d]?.[k];
        if (next) return motionOf(next);
      }
      return { p: 0, q: 0 };
    }),
  );
  const start = [0, 1, 2].map((k) => ({
    ox: cloudHash(level.seed, 3001 + k * 7),
    oz: cloudHash(level.seed, 3002 + k * 7),
    ow: cloudHash(level.seed, 3003 + k * 7),
  }));
  const made = { fields, slots, motions, start };
  skiesOf.set(front, made);
  return made;
}

/** A slot's drift and life added up from the start to `t` (periods). */
function addedUp(front: WeatherFront, motions: Motion[][], k: number, t: number): Motion {
  const legs = front.legs;
  let p = 0;
  let q = 0;
  let prev = motions[0][k];
  let at = 0;
  for (let i = 1; i < legs.length; i++) {
    const { from, full } = legs[i];
    if (t <= from) break;
    p += prev.p * (from - at);
    q += prev.q * (from - at);
    const span = Math.max(1e-6, full - from);
    const x = Math.min(1, (t - from) / span);
    const next = motions[i][k];
    const area = frontEaseArea(x) * span;
    p += prev.p * x * span + (next.p - prev.p) * area;
    q += prev.q * x * span + (next.q - prev.q) * area;
    if (t < full) return { p, q };
    prev = next;
    at = full;
  }
  p += prev.p * (t - at);
  q += prev.q * (t - at);
  return { p, q };
}

const mix = (a: number, b: number, s: number): number => a + (b - a) * s;

/** Two layers of one slot `s` of the way from `a` to `b`. */
function blendLayer(a: CloudLayer, b: CloudLayer, s: number): CloudLayer {
  const same = a.kind === b.kind;
  const dip = same ? 1 : 1 - SWAP.dip * Math.max(0, 1 - Math.abs(s - 0.5) / SWAP.half);
  const cover = mix(a.cover, b.cover, s) * dip;
  return {
    kind: s < 0.5 ? a.kind : b.kind,
    base: mix(a.base, b.base, s),
    depth: mix(a.depth, b.depth, s),
    cover,
    size: mix(a.size, b.size, s),
    stretch: mix(a.stretch, b.stretch, s),
    dome: mix(a.dome, b.dome, s),
    opacity: mix(a.opacity, b.opacity, s),
    tau: mix(a.tau, b.tau, s),
    life: mix(a.life, b.life, s),
    speed: mix(a.speed, b.speed, s),
    heading: mix(a.heading, b.heading, s),
    cut: coverCut(cover),
    veil: mix(veilOf(a), veilOf(b), s),
    ox: 0,
    oz: 0,
    ow: 0,
  };
}

/** A layer on one side only, grown `w` of the way (0 none, 1 whole). */
function grown(l: CloudLayer, w: number): CloudLayer {
  const cover = l.cover * w;
  return { ...l, cover, cut: coverCut(cover) };
}

/** The valley fog's sea `s` of the way from `a` to `b`. */
function blendSea(
  a: LowDeck | null,
  b: LowDeck | null,
  fogA: number,
  fogB: number,
  s: number,
): LowDeck | null {
  if (!a && !b) return null;
  // A fog's own deck says no density (its fog is the weather's): the sea
  // carries the fog it is made of, so either side's look reads it.
  const fog = Math.max(fogA, fogB);
  const top = mix(a?.top ?? 0, b?.top ?? 0, s);
  const base = mix(a?.base ?? 0, b?.base ?? 0, s);
  return top < SEA_LEAST ? null : { base, top, fog };
}

/** THE FIELD over a map carrying a FRONT, at run time `t`: the skies either
 * side morphed slot by slot, every slot's drift added up. Off a front, the
 * dealt field (`cloudFieldOf`). */
export function frontFieldAt(
  level: Pick<Level, "seed" | "weather" | "mountain" | "sun" | "front">,
  t: number,
): CloudField {
  const front = level.front;
  if (!front || front.legs.length === 0) return cloudFieldOf(level);
  const sk = skies(level, front);
  const now = frontAt(level, t);
  const i = now.leg;
  const s = now.share;
  const fb = sk.fields[i];
  const layers: CloudLayer[] = [];
  for (let k = 0; k < 3; k++) {
    const lb = sk.slots[i][k];
    const la = s > 0 ? sk.slots[i - 1][k] : lb;
    let l: CloudLayer | null;
    if (s <= 0) l = lb ? { ...lb } : null;
    else if (la && lb) l = blendLayer(la, lb, s);
    else if (la) l = grown(la, 1 - s);
    else if (lb) l = grown(lb, s);
    else l = null;
    if (!l) continue;
    // The layer's offsets laid so the noise reads the drift added up.
    const sum = addedUp(front, sk.motions, k, t);
    const st = sk.start[k];
    const ku = 1 / (NOISE_CELLS * l.size * l.stretch);
    l.ox = st.ox - sum.p + l.speed * t * ku;
    l.oz = st.oz;
    l.ow = st.ow + sum.q - t / (NOISE_CELLS * l.life);
    layers.push(l);
  }
  const fa = s > 0 ? sk.fields[i - 1] : fb;
  const wa = s > 0 ? front.legs[i - 1].weather : front.legs[i].weather;
  const wb = front.legs[i].weather;
  const fogOf = (w: typeof wa): number => (w.kind === "fog" ? w.fog : 0);
  const deck = blendSea(fa.deck, fb.deck, fogOf(wa), fogOf(wb), s);
  return {
    layers: layers.slice(0, CLOUD_LAYERS),
    floorY: fb.floorY,
    floorAltitude: fb.floorAltitude,
    seaTop: deck ? deck.top : 0,
    deck,
    deckLayer: -1,
  };
}

/** The genera a field stands, low to high — what the cloud's drawing keys
 * its kept picture on, so a morph moving numbers never throws it away. */
export function fieldShape(field: CloudField): string {
  return field.layers
    .map((l) => l.kind)
    .join(",")
    .concat(`|${field.deck ? "sea" : ""}`);
}
