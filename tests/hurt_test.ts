// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SKIING HURT (`engine/game/hurt.ts`): on a run that carries its injuries
// through a fall (the INJURIES switch, `GameState.gore`), a reset stands
// the skier back up as hurt as he lay, back where he left the piste and
// facing down it, and he skis worse for it — the leg on the outside of a
// turn standing the skis over less, the tuck shallower, the drive weaker.
// Off the switch nothing of it exists, and a run is the same to the bit.

import { describe, expect, it } from "vitest";

import {
  BODY_PARTS,
  HURT,
  NEUTRAL_INPUT,
  TUNING,
  createGame,
  freshBody,
  hurtEdge,
  hurtOf,
  nearestTrackPoint,
  placeRun,
  resetSkier,
  step,
  stepHurt,
  trackPointAt,
  type BodyPart,
  type BodyState,
  type GameState,
  type InjuryKind,
  type RunMoment,
  type SkierInput,
} from "@engine";
import { pisteX, SLOPE, syntheticLevel } from "./support/synthetic.ts";

function staged(moment: RunMoment, gore: boolean): GameState {
  const state = createGame({
    level: syntheticLevel({ noKicker: true }),
    rivals: 0,
    countdown: 0,
    quiet: true,
    gore,
  });
  placeRun(state, moment);
  return state;
}

function ride(state: GameState, seconds: number, input: SkierInput = NEUTRAL_INPUT): void {
  for (let i = 0; i < Math.round(seconds * TUNING.physicsHz); i++) step(state, input);
}

/** An injury of rank `ais` on `part`, as the body would have taken it. */
function hurt(
  body: BodyState,
  part: BodyPart,
  ais: number,
  kind: InjuryKind = "bruisedKnee",
): void {
  body.worst[BODY_PARTS.indexOf(part)] = Math.max(body.worst[BODY_PARTS.indexOf(part)], ais);
  body.injuries.push({ part, kind, ais, t: 0 });
}

const ON_THE_STRAIGHT: RunMoment = { x: SLOPE.x, z: 520, heading: 0, speed: 12 };

describe("what an injury costs", () => {
  it("is nothing to a sound body", () => {
    const h = hurtOf(freshBody());
    expect(h.edge).toEqual([1, 1]);
    expect(h.rate).toEqual([1, 1]);
    expect(h.grip).toEqual([1, 1]);
    expect([h.drive, h.tuck, h.landing]).toEqual([1, 1, 1]);
  });

  it("costs the turns a hurt leg carries: a left knee its right turns", () => {
    const body = freshBody();
    hurt(body, "kneeL", 3);
    const h = hurtOf(body);
    expect(h.edge[0]).toBeLessThan(0.8);
    expect(h.edge[1]).toBe(1);
    const c = { hurt: h } as unknown as GameState["skier"];
    expect(hurtEdge(c, 1)).toBeLessThan(hurtEdge(c, -1));
  });

  it("grows with the rank and never takes everything", () => {
    const shares = [1, 2, 3, 4, 5].map((ais) => {
      const body = freshBody();
      for (const p of ["thighL", "thighR", "chest", "armL", "head"] as const) hurt(body, p, ais);
      return hurtOf(body);
    });
    for (let i = 1; i < shares.length; i++) {
      expect(shares[i].edge[0]).toBeLessThanOrEqual(shares[i - 1].edge[0]);
      expect(shares[i].drive).toBeLessThanOrEqual(shares[i - 1].drive);
    }
    for (const h of shares)
      for (const v of [...h.edge, ...h.rate, ...h.grip, h.drive, h.tuck, h.landing])
        expect(v).toBeGreaterThanOrEqual(HURT.floor);
  });
});

describe("a run that carries its injuries", () => {
  it("stands him back up hurt, on the piste where he left it, facing down it", () => {
    const state = staged(ON_THE_STRAIGHT, true);
    ride(state, 1, { ...NEUTRAL_INPUT, tuck: 1 });
    hurt(state.skier.body, "kneeR", 2, "tornAcl");
    // Every gate above taken, the next owed below.
    const left = nearestTrackPoint(state.level, pisteX(540), 540).s;
    const cps = state.level.checkpoints;
    const next = cps.findIndex((cp) => cp.s > left + 30);
    state.progress.lastCheckpoint = next - 1;
    state.progress.nextCheckpoint = next;
    // Off into the snow beside the piste, and down.
    placeRun(state, { x: pisteX(560) + 30, z: 560, heading: 0.4, speed: 0 });
    state.progress.lastOnRun = { id: state.progress.lastOnRun?.id ?? "", x: pisteX(540), z: 540 };
    resetSkier(state, [], true);
    const c = state.skier;
    expect(c.body.injuries.map((h) => h.kind)).toContain("tornAcl");
    const near = nearestTrackPoint(state.level, c.x, c.z);
    expect(near.distance).toBeLessThan(1);
    expect(Math.abs(near.s - left)).toBeLessThan(5);
    expect(Math.cos(c.heading - trackPointAt(state.level, near.s).heading)).toBeGreaterThan(0.99);
  });

  it("never stands him past a gate he owes", () => {
    const state = staged(ON_THE_STRAIGHT, true);
    const cps = state.level.checkpoints;
    const owed = state.progress.nextCheckpoint;
    const past = cps[owed].s + 40;
    const at = state.level.track.points.find((p) => p.s >= past)!;
    placeRun(state, { x: at.x, z: at.z, heading: at.heading, speed: 0 });
    state.progress.nextCheckpoint = owed;
    resetSkier(state, [], true);
    const s = nearestTrackPoint(state.level, state.skier.x, state.skier.z).s;
    expect(s).toBeLessThan(cps[owed].s);
  });

  it("is still mended by a reset on a run without the switch", () => {
    const state = staged(ON_THE_STRAIGHT, false);
    hurt(state.skier.body, "kneeR", 2, "tornAcl");
    resetSkier(state, [], true);
    expect(state.skier.body.injuries).toEqual([]);
  });

  it("skis slower and turns less hurt", () => {
    const tuck = { ...NEUTRAL_INPUT, tuck: 1 };
    const sound = staged(ON_THE_STRAIGHT, true);
    const lame = staged(ON_THE_STRAIGHT, true);
    for (const p of ["thighL", "thighR", "back"] as const) hurt(lame.skier.body, p, 3);
    ride(sound, 4, tuck);
    ride(lame, 4, tuck);
    expect(lame.skier.hurt).toBeDefined();
    expect(lame.skier.speed).toBeLessThan(sound.skier.speed);

    const right = { ...NEUTRAL_INPUT, steer: 1 };
    const turnSound = staged(ON_THE_STRAIGHT, true);
    const turnLame = staged(ON_THE_STRAIGHT, true);
    hurt(turnLame.skier.body, "kneeL", 3);
    ride(turnSound, 1.5, right);
    ride(turnLame, 1.5, right);
    expect(turnLame.skier.heading).toBeLessThan(turnSound.skier.heading);
  });
});

describe("off the switch", () => {
  it("writes nothing and skis the same to the bit", () => {
    const off = staged(ON_THE_STRAIGHT, false);
    hurt(off.skier.body, "kneeL", 3);
    stepHurt(off);
    expect(off.skier.hurt).toBeUndefined();
    const on = staged(ON_THE_STRAIGHT, true);
    const plain = staged(ON_THE_STRAIGHT, false);
    const carve = { ...NEUTRAL_INPUT, steer: 0.6, tuck: 0.5 };
    ride(on, 3, carve);
    ride(plain, 3, carve);
    expect([on.skier.x, on.skier.z, on.skier.speed]).toEqual([
      plain.skier.x,
      plain.skier.z,
      plain.skier.speed,
    ]);
  });
});
