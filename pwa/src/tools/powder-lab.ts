// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD LAB'S POWDER VIEWS (`make world ARGS="--snow=2.5 --views=…"`):
// the skier down in deep snow, standing and fallen.
//
//   deep, deep-side     stood in the nearest open meadow and let stop, from
//                       the chase lens and from beside it, low
//   plunge-<s>          a FALL IN DEEP POWDER, `s` s after he left his skis:
//                       stood in the meadow at a crawl, edged hard over with
//                       the weight back until the snow lays him down, and
//                       drawn from a lens planted beside where he went in —
//                       a run of them is the frames of one fall
//   plunge-chase-<s>    ...the same moment from the chase boom, the lens a
//                       player sees it through
//   plunge-top-<s>      ...and from over him: the hole and the snow thrown
//                       round it
//   chute-land-<s>      UNDER A CANOPY into the meadow (`skydiveAt`, open a
//                       dozen metres up), `s` s after his skis meet the snow,
//                       from a lens beside where they did
//   chute-fall-<s>      ...and out of the sky with none, 120 m of freefall
//                       into it, `s` s after he hits; `-top` over him,
//                       `-chase` through the lens the player falls with
//   chute-tree-<s>      ...and caught in a crown, cut away and dropped into
//                       the snow under it
//
// Every view's note says how deep the body lies under the untouched snow and
// the fastest it has risen since it left the skis — the bounce this lab was
// built to catch (a body thrown up out of the powder) reads there as a number
// before it reads in the picture.

import { NEUTRAL_INPUT, placeRun, skydiveAt, step, type GameState } from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { wildGround } from "../game/wild-ground.ts";

export type PowderLab = {
  /** Draw the moment, unseen (the trail maps and the spray moved on). */
  draw: () => void;
  still: () => void;
  setOverride: (pose: LensPose | null) => void;
  setCamera: (rung: "chase") => void;
};

/** An open, gentle stretch of virgin powder near the skier: forty metres
 * of it clear of the loop and the trees, and the heading along it. */
export function meadow(state: GameState): { x: number; z: number; heading: number } | null {
  const level = state.level;
  const s = state.skier;
  const open = (x: number, z: number) =>
    level.packedAt(x, z) < 0.02 &&
    level.trees.every((t) => Math.hypot(t.x - x, t.z - z) > t.crown + 4);
  for (let r = 20; r < 600; r += 10) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) {
      const x = s.x + Math.sin(a) * r;
      const z = s.z + Math.cos(a) * r;
      for (const heading of [a, a + Math.PI / 2, a - Math.PI / 2]) {
        let ok = true;
        for (let d = -6; d <= 40 && ok; d += 4) {
          const px = x + Math.sin(heading) * d;
          const pz = z + Math.cos(heading) * d;
          ok =
            open(px, pz) &&
            Math.abs(level.groundAt(px, pz) - level.groundAt(x, z)) < 0.12 * Math.abs(d) + 0.3;
        }
        if (ok) return { x, z, heading };
      }
    }
  }
  return null;
}

/** The input that lays him down in deep snow: edged hard over, skidding,
 * the weight back — the fall a player leaning on the powder rides into. */
const LAID_DOWN = { ...NEUTRAL_INPUT, steer: 1, brake: 1, lean: 1 };

export function powderShots(
  state: GameState,
  lab: PowderLab,
): { shots: Record<string, () => string>; view(name: string): (() => string) | undefined } {
  const level = state.level;
  const ride = (input: typeof NEUTRAL_INPUT, seconds: number) => {
    const end = state.t + seconds;
    while (state.t < end) {
      for (let i = 0; i < 2; i++) step(state, input);
      lab.draw();
    }
  };
  // The fall's own record: where he went in and the fastest he rose since.
  let plunged: { x: number; z: number; heading: number } | null = null;
  let rose = 0;
  const onward = (input: typeof NEUTRAL_INPUT) => {
    for (let i = 0; i < 2; i++) {
      step(state, input);
      const off = state.skier.thrown;
      if (off && off.t > 0.05) rose = Math.max(rose, off.vy);
    }
    lab.draw();
  };
  const plunge = (t: number, lens: "beside" | "chase" | "top"): string => {
    if (!plunged) {
      // Stood in the nearest meadow, and in the next one on from there if
      // that one's snow did not lay him down (too firm, or too steep to stop).
      for (let tries = 0; tries < 3 && !state.skier.thrown; tries++) {
        const spot = meadow(state);
        if (!spot) return "no open meadow on this map";
        placeRun(state, { x: spot.x, z: spot.z, heading: spot.heading, speed: 12 / 3.6 });
        const until = state.t + 8;
        while (!state.skier.thrown && state.t < until) onward(LAID_DOWN);
      }
      const off = state.skier.thrown;
      if (!off) return "he did not fall";
      plunged = { x: off.x, z: off.z, heading: off.heading };
    }
    while (state.skier.thrown && state.skier.thrown.t < t - 1e-9) onward(NEUTRAL_INPUT);
    const off = state.skier.thrown;
    if (!off) return "already stood back up";
    const ground = wildGround(level);
    if (lens === "chase") {
      lab.setOverride(null);
      lab.setCamera("chase");
      for (let i = 0; i < 20; i++) lab.draw();
      lab.still();
    } else {
      const across = plunged.heading + Math.PI / 2;
      const far = lens === "top" ? 1.2 : 3.4;
      const ex = plunged.x + Math.sin(across) * far;
      const ez = plunged.z + Math.cos(across) * far;
      lab.setOverride({
        eye: { x: ex, y: ground.snowY(ex, ez) + (lens === "top" ? 4.2 : 1.1), z: ez },
        target: { x: off.x, y: level.groundAt(off.x, off.z) - 0.2, z: off.z },
        fov: 50,
        roll: 0,
      });
      lab.still();
      lab.setOverride(null);
    }
    const under = level.groundAt(off.x, off.z) - off.y;
    return `${off.cause}, ${off.t.toFixed(2)} s off his skis, his middle ${under.toFixed(2)} m under the untouched snow, rose at most ${rose.toFixed(2)} m/s, dial ${state.snowDepth}`;
  };
  // THE SKYDIVE INTO THE POWDER: where he met the snow, and when.
  let met: { x: number; z: number; t: number; heading: number } | null = null;
  const dropped = (
    t: number,
    how: "land" | "fall" | "tree",
    lens: "beside" | "top" | "chase",
  ): string => {
    if (!met && how === "tree") {
      // Flown into a crown, hung in it a moment, and cut away (the machine
      // press): down into the snow under the tree.
      const c = state.skier;
      for (let k = 0; k < level.trees.length && !met; k += 97) {
        const tree = level.trees[k];
        if (tree.height < 12 || level.packedAt(tree.x, tree.z) > 0.02) continue;
        skydiveAt(state, { x: tree.x, z: tree.z - 25, agl: 30, heading: 0, mode: "open" });
        lab.setCamera("chase");
        const until = state.t + 20;
        while (state.t < until && state.chute?.mode !== "snagged" && !c.thrown && c.airborne) {
          onward(NEUTRAL_INPUT);
        }
        if (state.chute?.mode !== "snagged") continue;
        for (let i = 0; i < 60; i++) onward(NEUTRAL_INPUT);
        step(state, { ...NEUTRAL_INPUT, machine: true });
        while (state.t < until + 10 && c.airborne && !c.thrown) onward(NEUTRAL_INPUT);
        const at = c.thrown ?? c;
        met = { x: at.x, z: at.z, t: state.t, heading: c.heading };
      }
      if (!met) return "no crown caught the canopy";
    }
    if (!met) {
      const spot = meadow(state);
      if (!spot) return "no open meadow on this map";
      const open = how === "land";
      // Under the canopy he glides a few metres for each he sinks: begun
      // back up the meadow so he comes down on it.
      const back = open ? -18 : 20;
      skydiveAt(state, {
        x: spot.x + Math.sin(spot.heading) * back,
        z: spot.z + Math.cos(spot.heading) * back,
        agl: open ? 7 : 120,
        heading: spot.heading,
        mode: open ? "open" : "freefall",
      });
      lab.setCamera("chase");
      const until = state.t + 30;
      const c = state.skier;
      while (state.t < until && c.airborne && !c.thrown) onward(NEUTRAL_INPUT);
      const at = c.thrown ?? c;
      met = { x: at.x, z: at.z, t: state.t, heading: c.heading };
    }
    while (state.t < met.t + t - 1e-9) onward(NEUTRAL_INPUT);
    const c = state.skier;
    const at = c.thrown ?? c;
    if (lens === "chase") {
      // The lens the player falls in with, as the run has carried it.
      lab.setOverride(null);
      lab.still();
    } else {
      const ground = wildGround(level);
      const across = met.heading + Math.PI / 2;
      const far = lens === "top" ? 1.2 : 3.4;
      const ex = met.x + Math.sin(across) * far;
      const ez = met.z + Math.cos(across) * far;
      lab.setOverride({
        eye: { x: ex, y: ground.snowY(ex, ez) + (lens === "top" ? 4.2 : 1.1), z: ez },
        target: { x: at.x, y: level.groundAt(at.x, at.z) - 0.2, z: at.z },
        fov: 50,
        roll: 0,
      });
      lab.still();
      lab.setOverride(null);
    }
    const under = level.groundAt(at.x, at.z) - at.y;
    return `${c.thrown ? c.thrown.cause : "on his skis"}, ${(state.t - met.t).toFixed(2)} s after the snow, his middle ${under.toFixed(2)} m under the untouched snow, the tail ${c.sinks[c.sinks.length - 1].toFixed(2)} m down, dial ${state.snowDepth}`;
  };
  const shots: Record<string, () => string> = {
    deep() {
      // THE SKIER DOWN IN THE POWDER (`--snow`): stood in the nearest open
      // meadow off the loop, ridden a few seconds at a crawl and let stop,
      // so it has sunk as far as the snow lets it, and the cloud its stop
      // threw has drifted off — from the chase lens.
      const spot = meadow(state);
      if (!spot) return "no open meadow on this map";
      placeRun(state, { x: spot.x, z: spot.z, heading: spot.heading, speed: 20 / 3.6 });
      ride({ ...NEUTRAL_INPUT, tuck: 0.5 }, 3);
      ride({ ...NEUTRAL_INPUT, brake: 1 }, 3);
      ride(NEUTRAL_INPUT, 8);
      lab.setCamera("chase");
      for (let i = 0; i < 30; i++) lab.draw();
      lab.still();
      const s = state.skier;
      return `stopped in a meadow, the tail ${s.sinks[s.sinks.length - 1].toFixed(2)} m down, dial ${state.snowDepth}`;
    },
    "deep-side"() {
      // ...and from beside it, low: how far down in the snow it sits.
      const s = state.skier;
      const across = s.heading + Math.PI / 2;
      const ex = s.x + Math.sin(across) * 4.5;
      const ez = s.z + Math.cos(across) * 4.5;
      const ground = wildGround(level);
      lab.setOverride({
        eye: { x: ex, y: ground.snowY(ex, ez) + 0.9, z: ez },
        target: { x: s.x, y: s.y - 0.2, z: s.z },
        fov: 50,
        roll: 0,
      });
      lab.still();
      lab.setOverride(null);
      return `beside it, the CoG ${(s.y - level.groundAt(s.x, s.z)).toFixed(2)} m over the untouched snow`;
    },
  };
  return {
    shots,
    view(name) {
      const d = /^chute-(land|fall|tree)(?:-(top|chase))?-(\d+(?:\.\d+)?)$/.exec(name);
      if (d) {
        const lens = (d[2] as "top" | "chase" | undefined) ?? "beside";
        return () => dropped(Number(d[3]), d[1] as "land" | "fall" | "tree", lens);
      }
      const m = /^plunge(?:-(chase|top))?-(\d+(?:\.\d+)?)$/.exec(name);
      if (!m) return undefined;
      return () => plunge(Number(m[2]), (m[1] as "chase" | "top" | undefined) ?? "beside");
    },
  };
}
