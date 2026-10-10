// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKYDIVE (`engine/game/chute.ts`, its numbers `defs/chute.ts`, the
// canopy's maths shared with the paramotor in `canopy.ts`): out of the
// plane's door, the freefall, the staged opening, the canopy flown on the
// toggles, the brakes and the risers, landed on the skis and skied on — or
// cut away, caught in a crown or on a lift, and begun again in the door. On
// the synthetic flat map (`flatLevel`), a lone tree (`shapedLevel`) and a
// generated mountain's lift (`levelFor`).

import { describe, expect, it } from "vitest";
import {
  CHUTE,
  NEUTRAL_INPUT,
  PLANE,
  TUNING,
  chutePilot,
  createGame,
  liftPlans,
  planeAloft,
  ropeAt,
  skydiveAt,
  skydiveInput,
  step,
  upRope,
  type ChuteEvent,
  type GameEvent,
  type GameState,
  type Level,
  type SkierInput,
} from "@engine";

import { levelFor } from "./support/levels.ts";
import { flatLevel, shapedLevel } from "./support/synthetic.ts";

const dt = TUNING.dt;
const SIZE = 4000;
const N = NEUTRAL_INPUT;
const ask = (o: Partial<SkierInput> = {}): SkierInput => ({ ...N, ...o });
const steps = (s: number): number => Math.round(s / dt);

const game = (level: Level = flatLevel({ size: SIZE })): GameState =>
  createGame({ level, mode: "free", plane: true, crowd: 0, quiet: true });

/** A ride stood `agl` m over the flat map's middle, in freefall (or `at`'s). */
function dive(agl: number, at: Partial<Parameters<typeof skydiveAt>[1]> = {}): GameState {
  const s = game();
  skydiveAt(s, { x: SIZE / 2, z: SIZE / 2 - 1000, agl, ...at });
  return s;
}

/** The chute events of this step. */
const chuteEvents = (events: readonly GameEvent[]): ChuteEvent[] =>
  events.filter((e): e is ChuteEvent => e.kind === "chute");
const said = (s: GameState, phase: ChuteEvent["phase"]): boolean =>
  chuteEvents(s.events).some((e) => e.phase === phase);

/** Step `s` until `until` holds or `seconds` run out, on `input`; every
 * chute event kept. */
function fly(
  s: GameState,
  seconds: number,
  input: SkierInput | ((s: GameState) => SkierInput),
  until: (s: GameState) => boolean = () => false,
): ChuteEvent[] {
  const out: ChuteEvent[] = [];
  for (let i = 0; i < steps(seconds) && !until(s); i++) {
    step(s, typeof input === "function" ? input(s) : input);
    out.push(...chuteEvents(s.events));
  }
  return out;
}

describe("out of the door and in freefall", () => {
  it("leaves the plane's door into the exit and turns into freefall over the hill", () => {
    const s = game();
    planeAloft(s, {
      x: SIZE / 2,
      y: 2500,
      z: 800,
      heading: 0,
      speed: PLANE.pilot.jumpRun,
      power: 0.5,
    });
    step(s, ask({ machine: true }));
    expect(s.chute?.mode).toBe("exit");
    expect(said(s, "exit")).toBe(true);
    expect(s.plane?.rider).toBe(false);
    fly(s, 15, N, (r) => r.chute!.mode === "freefall");
    expect(s.chute!.mode).toBe("freefall");
    // The relative wind turns from the prop blast to plumb up over 8–10 s.
    expect(s.chute!.since).toBeGreaterThan(7);
    expect(s.chute!.since).toBeLessThan(CHUTE.exit.most + dt);
  });

  it("falls belly to earth at the class's terminal speed, faster high up and head down", () => {
    const terminal = (agl: number, input: SkierInput = N): number => {
      const s = dive(agl + 900, { fall: 50 });
      fly(s, 60, input, (r) => r.chute!.agl <= agl);
      return -s.skier.vy;
    };
    const low = terminal(300);
    expect(low).toBeGreaterThan(53);
    expect(low).toBeLessThan(57);
    const high = terminal(3800);
    expect(high).toBeGreaterThan(62);
    expect(high).toBeLessThan(68);
    const head = terminal(1500, ask({ tuck: 1 }));
    expect(head).toBeGreaterThan(84);
    expect(head).toBeLessThan(91);
  });

  it("tracks forward on the lean, gliding across the air", () => {
    const s = dive(2400, { fall: 50 });
    fly(s, 20, ask({ lean: -1 }));
    const across = Math.hypot(s.skier.vx, s.skier.vz);
    expect(across / -s.skier.vy).toBeGreaterThan(0.5);
    expect(across / -s.skier.vy).toBeLessThan(1.05);
  });
});

describe("the opening", () => {
  it("runs its stages in order to full inflation in 3–4 s, at a shock in band", () => {
    const s = dive(1150, { fall: 55 });
    fly(s, 10, N, (r) => r.chute!.agl <= 1000);
    const y0 = s.skier.y;
    step(s, ask({ machine: true }));
    expect(s.chute!.mode).toBe("deploying");
    expect(said(s, "open-start")).toBe(true);
    const stages: string[] = [s.chute!.deploy!.stage];
    let stretch = NaN;
    let full = NaN;
    for (let i = 0; i < steps(8) && Number.isNaN(full); i++) {
      step(s, N);
      const d = s.chute!.deploy;
      if (d && stages[stages.length - 1] !== d.stage) stages.push(d.stage);
      if (said(s, "line-stretch")) stretch = d!.t;
      if (said(s, "open")) full = d?.t ?? NaN;
    }
    expect(stages).toEqual(CHUTE.deploy.stages.map((st) => st.id));
    expect(stretch).toBeGreaterThanOrEqual(1);
    expect(stretch).toBeLessThanOrEqual(1.5);
    expect(full).toBeGreaterThanOrEqual(3);
    expect(full).toBeLessThanOrEqual(4);
    expect(s.chute!.mode).toBe("open");
    fly(s, 1.5, N);
    expect(s.chute!.peak).toBeGreaterThanOrEqual(CHUTE.shock.least);
    expect(s.chute!.peak).toBeLessThanOrEqual(CHUTE.shock.most);
    const lost = y0 - s.skier.y;
    expect(lost).toBeGreaterThan(140);
    expect(lost).toBeLessThan(260);
  });

  it("ignores the press in the door's first moments, and takes it in freefall", () => {
    const s = game();
    planeAloft(s, {
      x: SIZE / 2,
      y: 2500,
      z: 800,
      heading: 0,
      speed: PLANE.pilot.jumpRun,
      power: 0.5,
    });
    step(s, ask({ machine: true }));
    step(s, ask({ machine: true }));
    expect(s.chute!.mode).toBe("exit");
    fly(s, CHUTE.exit.clear, N);
    step(s, ask({ machine: true }));
    expect(s.chute!.mode).toBe("deploying");
  });
});

describe("under the canopy", () => {
  /** The canopy flown 8 s to settle, then `seconds` on `input`. */
  function canopy(input: SkierInput, seconds: number) {
    const s = dive(1500, { mode: "open" });
    fly(s, 8, N);
    const c = s.skier;
    const [x0, y0, z0] = [c.x, c.y, c.z];
    let turned = 0;
    let h = s.chute!.canopyHeading;
    for (let i = 0; i < steps(seconds); i++) {
      step(s, input);
      const now = s.chute!.canopyHeading;
      turned += Math.atan2(Math.sin(now - h), Math.cos(now - h));
      h = now;
    }
    const across = Math.hypot(c.x - x0, c.z - z0);
    return {
      forward: Math.hypot(c.vx, c.vz),
      sink: (y0 - c.y) / seconds,
      glide: across / (y0 - c.y),
      turned,
    };
  }

  it("glides at a sport main's polar hands off", () => {
    const f = canopy(N, 20);
    expect(f.forward).toBeGreaterThan(10);
    expect(f.forward).toBeLessThan(13);
    expect(f.sink).toBeGreaterThan(4);
    expect(f.sink).toBeLessThan(5);
    expect(f.glide).toBeGreaterThan(2.5);
    expect(f.glide).toBeLessThan(3);
  });

  it("turns on a toggle, the way it is pulled, and dives in the turn", () => {
    const right = canopy(ask({ steer: 1 }), 8);
    const left = canopy(ask({ steer: -1 }), 8);
    expect(right.turned).toBeGreaterThan(Math.PI);
    expect(left.turned).toBeLessThan(-Math.PI);
    expect(right.sink).toBeGreaterThan(canopy(N, 8).sink * 1.5);
    const half = canopy(ask({ steer: 0.5 }), 8);
    expect(half.turned).toBeGreaterThan(0.5);
    expect(half.turned).toBeLessThan(right.turned);
  });

  it("is flared onto the snow slower than it comes down hands off, let go of, and skied on", () => {
    const touchdown = (flare: boolean) => {
      const s = dive(300, { mode: "open" });
      let sink = NaN;
      for (let i = 0; i < steps(120) && Number.isNaN(sink); i++) {
        const before = -s.skier.vy;
        step(s, flare ? { ...chutePilot(s), steer: 0 } : N);
        if (said(s, "land")) sink = before;
      }
      return { s, sink };
    };
    const flared = touchdown(true);
    const hands = touchdown(false);
    expect(flared.sink).toBeLessThan(2);
    expect(hands.sink).toBeGreaterThan(3.5);
    // Let go of on the skis: the canopy lies, he skis on.
    const s = flared.s;
    expect(s.chute!.mode).toBe("landed");
    expect(s.chute!.done).toBe(true);
    expect(s.chute!.piece).not.toBeNull();
    fly(s, 2, N);
    expect(s.skier.thrown).toBeFalsy();
    expect(s.skier.airborne).toBe(false);
    expect(s.skier.speed).toBeGreaterThan(0.5);
    expect(s.chute!.piece!.down).toBe(true);
  });
});

describe("cut away, caught and begun again", () => {
  it("cuts the canopy away on the press: it falls on its own and lies, he falls on", () => {
    const s = dive(400, { mode: "open" });
    fly(s, 2, N);
    step(s, ask({ machine: true }));
    expect(said(s, "release")).toBe(true);
    expect(s.chute!.mode).toBe("released");
    const piece = s.chute!.piece!;
    expect(piece).not.toBeNull();
    fly(s, 3, N);
    // He falls away from the cloth, which sinks slowly as cloth.
    expect(s.skier.vy).toBeLessThan(-15);
    expect(-piece.vy).toBeLessThan(10);
    expect(piece.y).toBeGreaterThan(s.skier.y);
    // Lower down the piece lies on the snow.
    const t = dive(40, { mode: "open" });
    fly(t, 1, N);
    step(t, ask({ machine: true }));
    const low = t.chute!.piece!;
    fly(t, 30, N, () => low.down);
    expect(low.down).toBe(true);
    expect(low.y).toBeCloseTo(t.level.groundAt(low.x, low.z), 3);
  });

  it("throws him at the snow after a cut-away high up, and begins the ride again in the door", () => {
    const s = dive(400, { mode: "open" });
    fly(s, 2, N);
    step(s, ask({ machine: true }));
    const events = fly(s, 60, N, (r) => !!r.plane?.rider);
    expect(events.some((e) => e.phase === "restart")).toBe(true);
    expect(s.chute).toBeUndefined();
    expect(s.plane?.rider).toBe(true);
    expect(s.plane?.grounded).toBe(true);
  });

  it("is caught in a crown, hangs over the snow, and restarts from the snag in the door", () => {
    const tree = { x: SIZE / 2, z: 700, y: 0, height: 18, radius: 0.4, crown: 3 };
    const level = shapedLevel(() => 0, { size: SIZE, cell: 10, trees: [tree as never] });
    const s = game(level);
    skydiveAt(s, { x: tree.x, z: tree.z - 70, agl: 30, heading: 0, mode: "open" });
    fly(s, 25, N, (r) => r.chute!.mode === "snagged");
    expect(s.chute!.mode).toBe("snagged");
    expect(s.chute!.snag!.on).toBe("tree");
    fly(s, 6, N);
    expect(s.chute!.mode).toBe("snagged");
    expect(s.chute!.agl).toBeGreaterThan(0.5);
    expect(s.skier.thrown).toBeFalsy();
    step(s, ask({ reset: true }));
    expect(s.chute).toBeUndefined();
    expect(s.plane?.rider).toBe(true);
    expect(s.plane?.grounded).toBe(true);
  });

  it("is caught on a lift's rope flown down across it", () => {
    const level = levelFor(1);
    const s = game(level);
    const plans = liftPlans(level).filter((p) => p.lift.kind !== "drag");
    expect(plans.length).toBeGreaterThan(0);
    const plan = plans.reduce((a, b) => (b.length > a.length ? b : a));
    const u = plan.length * 0.5;
    const r = upRope(plan);
    const rx = plan.lift.bottom.x + plan.dx * u + plan.dz * r;
    const rz = plan.lift.bottom.z + plan.dz * u - plan.dx * r;
    const rope = ropeAt(plan, u);
    const across = Math.atan2(-plan.dz, plan.dx);
    const over = 12;
    const back = over * (CHUTE.flies.forward / CHUTE.flies.sink);
    const x = rx - Math.sin(across) * back;
    const z = rz - Math.cos(across) * back;
    const agl = rope + over - CHUTE.canopy.lines - level.groundAt(x, z) - s.skier.spec.cogHeight;
    skydiveAt(s, { x, z, agl, heading: across, mode: "open" });
    fly(s, 12, N, (st) => st.chute?.mode === "snagged");
    expect(s.chute!.mode).toBe("snagged");
    expect(s.chute!.snag!.on).toBe("rope");
    fly(s, 3, N);
    expect(s.chute!.agl).toBeGreaterThan(1);
  });
});

describe("the edge, the start and the bot", () => {
  it("is blown back in and turned at the map's edge, tracking and under the canopy", () => {
    const s = dive(2500, { x: SIZE - 300, heading: Math.PI / 2, fall: 50 });
    let near = SIZE;
    fly(s, 30, (r) => {
      near = Math.min(near, SIZE - r.skier.x);
      return ask({ lean: -1 });
    });
    expect(near).toBeGreaterThan(0);
    const t = dive(800, { x: SIZE - 300, heading: Math.PI / 2, mode: "open" });
    let flown = SIZE;
    fly(t, 120, (r) => {
      flown = Math.min(flown, SIZE - r.skier.x);
      return N;
    });
    expect(flown).toBeGreaterThan(0);
  });

  it("stands a free ride in freefall over the map on its start option", () => {
    const s = createGame({
      level: flatLevel({ size: SIZE }),
      mode: "free",
      chute: 1500,
      crowd: 0,
      quiet: true,
    });
    expect(s.chute?.mode).toBe("freefall");
    expect(s.chute!.agl).toBeCloseTo(1500, 0);
    expect(s.plane?.rider).toBe(false);
    // Never on a race.
    const race = createGame({ level: flatLevel({ size: SIZE }), chute: 1500, quiet: true });
    expect(race.chute).toBeUndefined();
  });

  it("flies the whole jump on the bot's hands: out on the jump run, opened, down on the skis", () => {
    const level = levelFor(1);
    const s = game(level);
    const events = fly(s, 1500, skydiveInput, (r) => !!r.chute?.done || !!r.skier.thrown);
    const phases = events.map((e) => e.phase);
    expect(phases.indexOf("exit")).toBeGreaterThanOrEqual(0);
    expect(phases.indexOf("open")).toBeGreaterThan(phases.indexOf("exit"));
    expect(phases.indexOf("land")).toBeGreaterThan(phases.indexOf("open"));
    expect(s.skier.thrown).toBeFalsy();
    const open = events.find((e) => e.phase === "open")!;
    expect(open.y - level.groundAt(open.x, open.z)).toBeGreaterThan(500);
  });

  it("flies the same twice", () => {
    const run = () => {
      const s = dive(1500, { fall: 40 });
      fly(s, 40, (r) => ({ ...chutePilot(r), steer: Math.sin(r.t) * 0.6 }));
      const c = s.skier;
      return [c.x, c.y, c.z, c.vx, c.vy, c.vz, s.chute!.x, s.chute!.y, s.chute!.z];
    };
    expect(run()).toEqual(run());
  });
});
