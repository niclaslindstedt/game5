// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A MAP'S FINGERPRINT — one word that moves when the map a seed builds
// moves, and does not when it does not.
//
// The campaign pins its maps to a generator version (`versions.ts`), and the
// version registry is a promise the generator cannot check on its own:
// nothing in `generateLevel` knows that seed 38 used to put its third gate
// somewhere else. So every pinned map carries the digest it was curated
// with, and the suite rebuilds it and compares. The digest reads what a
// SKIER meets — the piste (a station every twenty metres: where it runs,
// how high, how wide), every gate, the start line, every kicker (the park's
// among them on a map built for a tricks run, R20 — no campaign map is, so
// asking for one is asking for a different map), the cliffs, the drifts,
// every trunk, the day and the sky — and the ground under every gate and
// every lip, so the mountain moving under an unmoved piste is caught too.
// It reads none of the heightfields whole: a million samples of ground
// would make the comparison cost what building the map cost, and the piste
// and the woods stand on that ground already.
//
// FNV-1a over the values rounded to centimetres, the way the sim's
// determinism digest is built (`sim/simulate.ts`), printed as eight hex
// digits so it reads as one word in a campaign map's row.

import { sampleField } from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { DEFAULT_REGION, regionOf } from "./regions.ts";
import { weatherOf } from "./weather.ts";
import type { Level } from "./types.ts";

/** Stations between two the digest reads: the piste is stored every 2 m,
 * and a line that moved at all moved over more than twenty. */
const TRACK_STRIDE = 10;

/** The digest of what a map puts in a skier's way — see the header. */
export function levelDigest(level: Level): string {
  let hash = 0x811c9dc5;
  const mix = (v: number): void => {
    // Four bytes of the centimetre-rounded value, so a metre of drift in any
    // one number changes the word and not only its low byte.
    const n = Math.round(v * 100) | 0;
    for (let shift = 0; shift < 32; shift += 8) {
      hash ^= (n >>> shift) & 0xff;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  };
  const word = (s: string): void => {
    for (let i = 0; i < s.length; i++) {
      hash ^= s.charCodeAt(i) & 0xff;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  };
  mix(level.size);
  mix(level.laps);
  mix(level.track.length);
  const points = level.track.points;
  mix(points.length);
  for (let i = 0; i < points.length; i += TRACK_STRIDE) {
    const p = points[i];
    mix(p.x);
    mix(p.z);
    mix(p.y);
    mix(p.width);
  }
  for (const c of level.checkpoints) {
    mix(c.x);
    mix(c.z);
    mix(c.heading);
    mix(c.width);
    mix(c.s);
    mix(sampleField(level.ground, c.x, c.z));
  }
  for (const g of level.grid) {
    mix(g.x);
    mix(g.z);
    mix(g.heading);
  }
  for (const k of level.kickers ?? []) {
    word(k.id);
    mix(k.x);
    mix(k.z);
    mix(k.heading);
    mix(k.height);
    mix(k.ramp);
    mix(k.landing);
    mix(k.width);
    mix(sampleField(level.ground, k.x, k.z));
    // R20's size, on a park's kickers only: none adds nothing.
    if (k.size) word(k.size);
  }
  for (const c of level.cliffs ?? []) {
    word(c.id);
    mix(c.x);
    mix(c.z);
    mix(c.heading);
    mix(c.drop);
    mix(sampleField(level.ground, c.x, c.z));
  }
  for (const d of level.drifts ?? []) {
    mix(d.from);
    mix(d.to);
  }
  mix(level.trees.length);
  for (const t of level.trees) {
    mix(t.x);
    mix(t.z);
    mix(t.height);
  }
  mix(level.sun.hour);
  mix(level.sun.dayOfYear);
  mix(level.sun.latitude);
  const sky = weatherOf(level);
  word(sky.kind);
  mix(sky.snowfall);
  mix(sky.fog);
  mix(sky.wind);
  mix(sky.windFrom);
  word(sky.evening ? "evening" : "day");
  // R21 — a region other than the alpine is named, so two regions' maps of
  // one seed never share a word; the alpine adds nothing.
  const region = regionOf(level).id;
  if (region !== DEFAULT_REGION) word(region);
  return hash.toString(16).padStart(8, "0");
}
