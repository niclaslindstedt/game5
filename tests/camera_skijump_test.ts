// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI JUMP AS TELEVISION SHOWS IT (`camera-skijump.ts`): a whole jump
// jumped by the bot on a generated map's hill and watched through the
// broadcast's director frame by frame. These hold that every frame has him
// in it and the line to him open — past the raised in-run's deck, truss
// and tower (`ski-jump-raised.ts`'s solids in the line clear) and the snow
// — that no shot is cut away from in under `JUMP_CAM.hold` seconds, that
// the shots run in the order the jump does, and that the long lenses keep
// him big in the frame however far off they stand.

import { describe, expect, it } from "vitest";

import { TUNING, botInput, createGame, step, type GameState } from "@engine";
import { createLineClear } from "../pwa/src/game/camera-clear.ts";
import {
  JUMP_CAM,
  JUMP_SHOTS,
  createJumpBroadcast,
  createJumpDirector,
  jumpMoment,
  type JumpShot,
} from "../pwa/src/game/camera-skijump.ts";
import type { LensPose, Vec3 } from "../pwa/src/game/camera-rigs.ts";
import { SLOW, createShotCollector, directAt } from "../pwa/src/game/replay-shots.ts";
import { levelFor } from "./support/levels.ts";

type Seen = {
  t: number;
  /** The snow under the eye, m. */
  under: number;
  shot: JumpShot;
  lens: LensPose;
  racer: Vec3;
  open: number;
  stage: string;
};

/** A bot's jump off `hill` on seed 1, a frame every 1/30 s through the
 * director, from the bar to a few seconds into the out-run. */
function watch(hill: "normal" | "large"): Seen[] {
  const state: GameState = createGame({
    level: levelFor(1),
    mode: "skiJump",
    hill,
    quiet: true,
  });
  const clear = createLineClear(state.level);
  const director = createJumpDirector();
  const per = Math.round(1 / 30 / TUNING.dt);
  const seen: Seen[] = [];
  let downAt = -1;
  for (let i = 0; i < Math.round(60 / TUNING.dt); i++) {
    step(state, botInput(state));
    if (i % per !== 0) continue;
    const c = state.skier;
    const racer = { x: c.x, y: c.y, z: c.z };
    const m = jumpMoment(state, racer);
    const lens = director.frame(m, clear);
    if (!m || !lens) continue;
    const target = { x: racer.x, y: racer.y + 0.2, z: racer.z };
    seen.push({
      t: state.t,
      under: state.level.groundAt(lens.eye.x, lens.eye.z),
      shot: director.shot()!,
      lens,
      racer,
      open: clear(target, lens.eye),
      stage: m.stage,
    });
    if (m.stage === "down" && downAt < 0) downAt = state.t;
    if (downAt >= 0 && state.t > downAt + 5) break;
  }
  return seen;
}

const off = (l: LensPose, p: Vec3): number => {
  const ax = l.target.x - l.eye.x;
  const ay = l.target.y - l.eye.y;
  const az = l.target.z - l.eye.z;
  const bx = p.x - l.eye.x;
  const by = p.y - l.eye.y;
  const bz = p.z - l.eye.z;
  const dot = ax * bx + ay * by + az * bz;
  const cos = dot / (Math.hypot(ax, ay, az) * Math.hypot(bx, by, bz));
  return (Math.acos(Math.min(1, cos)) * 180) / Math.PI;
};
const dist = (l: LensPose, p: Vec3): number =>
  Math.hypot(p.x - l.eye.x, p.y - l.eye.y, p.z - l.eye.z);

describe.each(["normal", "large"] as const)("the broadcast over a %s hill's jump", (hill) => {
  const seen = watch(hill);

  it("runs from the bar through the flight to the out-run", () => {
    expect(seen.length).toBeGreaterThan(200);
    const shots = new Set(seen.map((s) => s.shot));
    for (const shot of JUMP_SHOTS) expect(shots.has(shot), shot).toBe(true);
    expect(seen.some((s) => s.stage === "air")).toBe(true);
  });

  it("has him in every frame, inside the lens's field", () => {
    for (const s of seen)
      expect(off(s.lens, s.racer), `${s.shot} at ${s.t}`).toBeLessThan(s.lens.fov / 2 - 0.3);
  });

  it("never has the snow or the structure between the lens and him", () => {
    for (const s of seen) expect(s.open, `${s.shot} at ${s.t.toFixed(2)}`).toBeGreaterThan(0.999);
    for (const s of seen) expect(s.lens.eye.y, `${s.shot} at ${s.t}`).toBeGreaterThan(s.under + 1);
  });

  it("holds every shot its time, in the order the jump runs", () => {
    let on = seen[0].shot;
    let since = seen[0].t;
    for (const s of seen) {
      if (s.shot === on) continue;
      expect(s.t - since, `${on} → ${s.shot}`).toBeGreaterThanOrEqual(JUMP_CAM.hold - 1e-6);
      expect(JUMP_SHOTS.indexOf(s.shot)).toBeGreaterThan(JUMP_SHOTS.indexOf(on));
      on = s.shot;
      since = s.t;
    }
  });

  it("keeps him big: a few metres of world round him, from a bounded distance", () => {
    for (const s of seen) {
      const d = dist(s.lens, s.racer);
      expect(d, `${s.shot} at ${s.t}`).toBeLessThan(120);
      if (s.shot === "tower") continue; // the opening holds the hill
      const world = 2 * d * Math.tan((s.lens.fov * Math.PI) / 360);
      expect(world, `${s.shot} at ${s.t}`).toBeLessThan(JUMP_CAM.frame[s.shot] * 1.6 + 0.5);
    }
  });
});

describe("the broadcast as the renderer runs it", () => {
  it("gives way to a rung the player picks, and takes a replay's BROADCAST", () => {
    const state = createGame({ level: levelFor(1), mode: "skiJump", countdown: 0, quiet: true });
    for (let i = 0; i < Math.round(3 / TUNING.dt); i++) step(state, botInput(state));
    const racer = { x: state.skier.x, y: state.skier.y, z: state.skier.z };
    const b = createJumpBroadcast();
    expect(b.lens(state, racer, null)).not.toBeNull();
    b.pick(true);
    expect(b.lens(state, racer, null)).toBeNull();
    expect(b.lens(state, racer, { angle: "tv" })).not.toBeNull();
    expect(b.lens(state, racer, { angle: "side" })).toBeNull();
    // The run begun again is the broadcast's again.
    const again = createGame({ level: levelFor(1), mode: "skiJump", countdown: 0, quiet: true });
    expect(b.lens(again, racer, null)).not.toBeNull();
  });

  it("is nothing on a map with no hill", () => {
    const state = createGame({ level: levelFor(1), countdown: 0, quiet: true });
    step(state, botInput(state));
    const b = createJumpBroadcast();
    expect(
      b.lens(state, { x: state.skier.x, y: state.skier.y, z: state.skier.z }, null),
    ).toBeNull();
  });
});

describe("the replay's broadcast of a jump", () => {
  it("runs the take-off and the landing slow, and files no plain air", () => {
    const state = createGame({ level: levelFor(1), mode: "skiJump", quiet: true });
    const shots = createShotCollector();
    for (let i = 0; i < Math.round(30 / TUNING.dt); i++) {
      step(state, botInput(state));
      shots.step(state, i);
    }
    const plan = shots.plan();
    const kinds = plan.map((s) => s.kind);
    expect(kinds).toContain("takeoff");
    expect(kinds).toContain("landing");
    expect(kinds).not.toContain("air");
    for (const shot of plan.filter((s) => s.kind === "takeoff" || s.kind === "landing"))
      expect(directAt(plan, shot.at + 1).rate).toBeCloseTo(SLOW.rate, 6);
  });
});
