// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HIS LEGS ARE SPRINGS (`skier-spring.ts`'s `LEGS`, `skier-pose.ts`): skied
// by the real engine over a run of rollers, the skis go up and down with
// the snow and his knees take it while his body rides on far steadier than
// the skis; the engine's own compression folds his knees rather than
// lifting his hips; a landing folds him and he comes back up; a hop off a
// crest is not a flight — his stroke and his stance ride on over it —
// while a jump he springs himself is, and carries his body with it; and
// his trunk keeps its pitch while the skis rock under him. A steady change
// of climb (a stop) is ridden on its line, and a fold his knees have no
// room for (a tuck's) is never bowed at the waist. The climb his
// own skate makes across a side slope is not a bump, and a skier thrown
// is stood back up at rest.

import { describe, expect, it } from "vitest";
import {
  NEUTRAL_INPUT,
  TUNING,
  createGame,
  mayGetUp,
  placeRun,
  step,
  type GameState,
} from "@engine";

import { flying, gaitOf } from "../pwa/src/game/skier-gait.ts";
import {
  createSkierSpring,
  pitchHeld,
  restSkierSpring,
  skierPose,
  stepSkierSpring,
} from "../pwa/src/game/skier-pose.ts";
import { legsLift } from "../pwa/src/game/skis-body.ts";
import { flatLevel } from "./support/synthetic.ts";

const base = {
  hipRight: 0,
  hipAft: 0,
  lean: 0,
  steer: 0,
  crouch: 0,
  airborne: false,
  landing: 5,
};

/** How much of a reading goes up and down with the rollers, m: its
 * component at the rollers' own wavelength `length` along the run (`z`
 * where each was read) — the bounce they put in it, and nothing slower
 * or faster. */
function bounce(v: number[], z: number[], length: number): number {
  const mean = v.reduce((a, y) => a + y, 0) / v.length;
  let re = 0;
  let im = 0;
  v.forEach((y, i) => {
    const a = (2 * Math.PI * z[i]) / length;
    re += (y - mean) * Math.cos(a);
    im += (y - mean) * Math.sin(a);
  });
  return (2 * Math.hypot(re, im)) / v.length;
}

/** Skied hands off over rollers `height` m high every `length` m at
 * `kmh`, the body's spring stepped at 60 Hz as the game steps it: the
 * world height of the boots (the engine's CoG less his height, plus the
 * drawn skis' lift), of the engine's CoG and of his body as the spring
 * carries it, each less the slope's fall; the legs' fold; and where along
 * the run each was read. */
function overRollers(height: number, length: number, kmh: number) {
  const level = flatLevel({
    packed: 1,
    grade: 0.12,
    slopeFrom: 0,
    size: 1200,
    bumps: { height, length, from: 300, to: 900 },
  });
  const state = createGame({ level, rivals: 0, countdown: 0, quiet: true });
  placeRun(state, { x: 600, z: 290, heading: 0, speed: kmh / 3.6 });
  const c = state.skier;
  const legs = createSkierSpring();
  const feet: number[] = [];
  const cog: number[] = [];
  const body: number[] = [];
  const fold: number[] = [];
  const at: number[] = [];
  for (let i = 0; i < 4 * TUNING.physicsHz; i++) {
    step(state, NEUTRAL_INPUT);
    if (i % 2) continue;
    const lift = legsLift(c);
    stepSkierSpring(legs, c.vy, c.airborne, 2 * TUNING.dt, 0, c, false, undefined, lift);
    if (i < TUNING.physicsHz * 1.5) continue;
    feet.push(c.y - c.spec.cogHeight + lift);
    cog.push(c.y);
    body.push(c.y - legs.bump);
    fold.push(legs.bump + Math.max(0, lift));
    at.push(c.z);
  }
  // The slope's own fall taken out, so only the rollers are left.
  const flat = (v: number[]) => v.map((y, i) => y + 0.12 * at[i]);
  return { feet: flat(feet), cog: flat(cog), body: flat(body), fold, at };
}

/** `seconds` skied with `tuck` held off a standstill, the body's spring
 * stepped at 60 Hz as the game steps it (`skis-body.ts`: at rest while he
 * is thrown) — the fold of his legs at every frame past `from` s. */
function folds(
  state: GameState,
  seconds: number,
  from = 0,
  legs = createSkierSpring(),
  input = { ...NEUTRAL_INPUT, tuck: 1 },
) {
  const c = state.skier;
  const out: number[] = [];
  for (let i = 0; i < seconds * TUNING.physicsHz; i++) {
    step(state, i === 0 ? input : { ...input, reset: false });
    if (i % 2) continue;
    if (c.thrown) restSkierSpring(legs);
    else
      stepSkierSpring(legs, c.vy, c.airborne, 2 * TUNING.dt, 0, c, false, undefined, legsLift(c));
    if (i >= from * TUNING.physicsHz) out.push(legs.bump);
  }
  return { legs, out };
}

describe("his legs are springs", () => {
  it("skates across a side slope standing as he does on the flat, every stride alike", () => {
    // Across the fall line his skate glides UP on one arm of the V and down
    // on the other: his legs push him there, so his body goes with them —
    // taken as a bump, he sat deep on every uphill stride and stood tall on
    // every downhill one, some 17 cm between them.
    const level = flatLevel({ packed: 1, grade: 0.2, slopeFrom: 100, size: 3000 });
    const state = createGame({ level, rivals: 0, countdown: 0, quiet: true });
    placeRun(state, { x: 1500, z: 1400, heading: Math.PI / 2, speed: 1 });
    const { out } = folds(state, 3, 1);
    expect(state.skier.drive).toBeGreaterThan(0.9);
    expect(Math.max(...out.map(Math.abs))).toBeLessThan(0.01);
  });

  it("stands back up at rest after a fall, not in the fold he went down in", () => {
    const state = createGame({
      level: flatLevel({ packed: 1 }),
      rivals: 0,
      countdown: 0,
      quiet: true,
    });
    placeRun(state, { x: 1500, z: 200, heading: 0, speed: 70 / 3.6, height: 9 });
    const { legs } = folds(state, 3, 3);
    expect(state.skier.thrown).not.toBeNull();
    // Reset once he may get up, and away off the poles at once.
    while (!mayGetUp(state.skier.thrown)) step(state, NEUTRAL_INPUT);
    step(state, { ...NEUTRAL_INPUT, reset: true });
    expect(state.skier.thrown).toBeNull();
    const { out } = folds(state, 1, 0, legs);
    expect(Math.max(...out.map(Math.abs))).toBeLessThan(0.01);
    // ...and the rest is a fresh spring on his own clock.
    const s = createSkierSpring(2);
    s.bump = 0.3;
    s.lastVy = -9;
    s.clock = 7;
    restSkierSpring(s);
    expect(s).toEqual({ ...createSkierSpring(7) });
  });
  it("takes rollers in the knees while his body rides on", () => {
    const r = overRollers(0.15, 4, 35);
    const b = (v: number[]) => bounce(v, r.at, 4);
    // The skis go up and down with the snow, and the engine's centre of
    // gravity with them nearly all the way...
    expect(b(r.feet)).toBeGreaterThan(0.04);
    expect(b(r.cog)).toBeGreaterThan(0.8 * b(r.feet));
    // ...but his body keeps well under half of that bounce, the legs
    // folding and letting out the rest.
    expect(b(r.body)).toBeLessThan(0.45 * b(r.feet));
    const range = Math.max(...r.fold) - Math.min(...r.fold);
    expect(range).toBeGreaterThan(0.08);
    // Never past the legs' reach.
    expect(Math.max(...r.fold)).toBeLessThan(0.41);
  });

  it("folds his knees, not his hips, as the engine's legs bring the skis up", () => {
    const stood = skierPose(base);
    const folded = skierPose({ ...base, lift: [0.12, 0.12] });
    // The skis came up 12 cm toward him; his hips stayed where his mass is.
    expect(folded.feet[0].y).toBeCloseTo(stood.feet[0].y + 0.12, 6);
    expect(Math.abs(folded.hips.y - stood.hips.y)).toBeLessThan(0.01);
    expect(folded.knees[0].y - folded.feet[0].y).toBeLessThan(stood.knees[0].y - stood.feet[0].y);
    // Hanging in the air with his legs long, his hips come down toward them.
    const hung = skierPose({ ...base, lift: [-0.08, -0.08] });
    expect(hung.hips.y).toBeLessThan(stood.hips.y - 0.03);
  });

  it("takes a landing in his legs and comes back up within the second", () => {
    const s = createSkierSpring();
    const ride = { way: 15, pitch: 0, airTime: 1 };
    stepSkierSpring(s, -6, true, 1 / 60, 0, { ...RIDE, ...ride });
    let deepest = 0;
    let at = 0;
    for (let i = 1; i <= 90; i++) {
      stepSkierSpring(s, 0, false, 1 / 60, 0, { ...RIDE, ...ride, airTime: 0 });
      if (s.bump > deepest) {
        deepest = s.bump;
        at = i / 60;
      }
    }
    // A deep fold, peaking within a quarter of a second of the skis
    // stopping (a ski jumper's landing's impact takes some 0.19 s)...
    expect(deepest).toBeGreaterThan(0.15);
    expect(deepest).toBeLessThan(0.41);
    expect(at).toBeLessThan(0.25);
    // ...and stood back up a second and a half on.
    expect(Math.abs(s.bump)).toBeLessThan(0.02);
  });

  it("rides a steady change of climb on its line, not sunk to his deepest fold by it", () => {
    // Braking down a pitch: the fall taken out of him at half a metre a
    // second every second, for six seconds. The legs' spring sags a couple
    // of centimetres under that push (a/ω²) — a line followed a lag behind
    // pinned them at their deepest fold for as long as it lasted.
    const s = createSkierSpring();
    for (let i = 0; i <= 360; i++) stepSkierSpring(s, -5 + (3 * i) / 360, false, 1 / 60, 0, RIDE);
    expect(s.bump).toBeGreaterThan(0);
    expect(s.bump).toBeLessThan(0.04);
  });

  it("takes a fold his knees have no room for in his hips, never bowed to his skis", () => {
    // Stood up, the knees take a fold and the trunk follows the shins.
    const stood = skierPose(base);
    const sunk = skierPose({ ...base, bump: 0.15 });
    expect(sunk.hips.y).toBeLessThan(stood.hips.y - 0.1);
    expect(sunk.pitch).toBeGreaterThan(stood.pitch + 0.1);
    // In a tuck they are folded as far as knees go: the compression is not
    // taken by bowing at the waist, his head kept over his hips.
    const tuck = { ...base, crouch: 1, tuck: 1 };
    const low = skierPose(tuck);
    const pressed = skierPose({ ...tuck, bump: 0.3 });
    expect(pressed.pitch).toBeLessThan(low.pitch + 0.1);
    expect(pressed.head.y - pressed.hips.y).toBeGreaterThan(0.2);
  });

  it("carries his body with a jump he springs himself", () => {
    const s = createSkierSpring();
    for (let i = 0; i < 30; i++) stepSkierSpring(s, 0, false, 1 / 60, 1, RIDE);
    // The pop: the engine throws the pair up off the snow at 3.5 m/s, his
    // own legs having done it.
    stepSkierSpring(s, 3.5, false, 1 / 60, 0, { ...RIDE, popped: 0 });
    expect(Math.abs(s.bump)).toBeLessThan(0.02);
  });

  it("rides a hop off a crest as he rides the snow, and flies a flight", () => {
    expect(flying({ airborne: true, airTime: 0.05 })).toBe(false);
    expect(flying({ airborne: true, airTime: 0.3 })).toBe(true);
    // A jump he sprang flies from its first frame; any air unread flies.
    expect(flying({ airborne: true, airTime: 0.02, popped: 0.02 })).toBe(true);
    expect(flying({ airborne: true })).toBe(true);
    expect(flying({ airborne: false, airTime: 0 })).toBe(false);
    // Double-poling over a crest, the stroke goes on through the hop.
    const poling = { drive: 1, stride: 3.4, speed: 1, pitch: 0, thrown: null, way: 1 };
    const hop = gaitOf({ ...poling, airborne: true, airTime: 0.03 });
    expect(hop.pole).toBeGreaterThan(0);
    expect(hop.pole).toBeCloseTo(gaitOf({ ...poling, airborne: false }).pole, 6);
    expect(gaitOf({ ...poling, airborne: true, airTime: 0.4 }).pole).toBe(0);
  });

  it("keeps his trunk's pitch while the skis rock under him, and turns with a flip", () => {
    const s = createSkierSpring();
    for (let i = 0; i < 60; i++) stepSkierSpring(s, 0, false, 1 / 60, 0, { ...RIDE, pitch: 0 });
    // The skis rocked tips-up over a bump in a tenth of a second: his trunk
    // hardly follows, so it stands that much further forward of them.
    for (let i = 0; i < 6; i++) stepSkierSpring(s, 0, false, 1 / 60, 0, { ...RIDE, pitch: 0.15 });
    expect(pitchHeld(s, 0.15)).toBeGreaterThan(0.07);
    const leant = skierPose({ ...base, pitchHeld: pitchHeld(s, 0.15) });
    expect(leant.pitch).toBeGreaterThan(skierPose(base).pitch + 0.07);
    // A second in the air and he turns with the pair.
    for (let i = 0; i < 60; i++) {
      stepSkierSpring(s, 0, true, 1 / 60, 0, { ...RIDE, pitch: 1, airTime: i / 60 });
    }
    expect(Math.abs(pitchHeld(s, 1))).toBeLessThan(0.01);
  });
});

/** A ride on the flat at a cruise, every reading a run hands the spring. */
const RIDE = {
  edge: 0,
  speed: 12,
  crouch: 0,
  drive: 0,
  hipRight: 0,
  roll: 0,
  way: 12,
  pitch: 0,
  stride: 0,
};
