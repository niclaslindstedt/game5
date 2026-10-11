// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE AND THE SKYDIVE, HEARD — the turboprop as a bed
// (`plane-voice.ts`, `plane-bed.ts`), the jump's air as a bed
// (`chute-voice.ts`, `chute-bed.ts`), and their moments as one-shots
// (`plane-bank.ts`, `chute-bank.ts`, `route.ts`). The faults here are
// silences and constants: a propeller whose buzz never follows the power, a
// cabin as quiet with the door open as shut, a plane as loud flying away as
// in its door, a freefall that roars twice (the ride bed's wind and this
// one's), a canopy as loud as the freefall — read by layer name against a
// recording synth, no DOM.

import { describe, expect, it } from "vitest";

import {
  NEUTRAL_INPUT,
  PLANE,
  TUNING,
  createGame,
  planeAloft,
  planeFireOf,
  skydiveAt,
  step,
  type GameEvent,
  type GameState,
} from "@engine";

import { RUN_BANK } from "../pwa/src/game/audio/bank.ts";
import {
  chuteTargets,
  humOf,
  postureOf,
  type ChuteVoice,
} from "../pwa/src/game/audio/chute-voice.ts";
import {
  chuteVoiceOf,
  createChuteBed,
  creakAt,
  pullOf,
  rideShares,
} from "../pwa/src/game/audio/chute-bed.ts";
import { createPlaneBed, planeVoiceOf, propRpmOf } from "../pwa/src/game/audio/plane-bed.ts";
import {
  PLANE_LAYERS,
  planeTargets,
  propOf,
  stallWarnOf,
  tipMachOf,
  type PlaneVoice,
} from "../pwa/src/game/audio/plane-voice.ts";
import { LISTENERS } from "../pwa/src/game/audio/listener.ts";
import { soundForEvent } from "../pwa/src/game/audio/route.ts";
import {
  safeCutoff,
  type LayerSpec,
  type LayerTarget,
  type Synth,
} from "@niclaslindstedt/oss-game-framework/audio/voice";
import { flatLevel } from "./support/synthetic.ts";

type RecordedLayer = { spec: LayerSpec; sets: LayerTarget[]; stopped: boolean };

/** A synth that plays nothing and remembers its layers and one-shots. */
function recorder(): Synth & { layers: RecordedLayer[]; plays: number } {
  const rec = {
    layers: [] as RecordedLayer[],
    plays: 0,
    unlock: () => {},
    autostart: () => {},
    resume: () => {},
    now: () => 0,
    tone: () => void rec.plays++,
    noise: () => void rec.plays++,
    layer(spec: LayerSpec) {
      const layer: RecordedLayer = { spec, sets: [], stopped: false };
      rec.layers.push(layer);
      return {
        set: (target: LayerTarget) => void layer.sets.push(target),
        stop: () => {
          layer.stopped = true;
        },
        alive: () => !layer.stopped,
      };
    },
  };
  return rec;
}

const PROP = propOf(PLANE);
const HEADSET = safeCutoff(1e9, 16000);
const SIZE = 4000;
const flat = flatLevel({ size: SIZE });

/** The plane at full power on the climb, the ear in its door. */
const climbing = (o: Partial<PlaneVoice> = {}): PlaneVoice => ({
  rpm: 1,
  ng: 1,
  rise: 0,
  power: 1,
  load: 0.6,
  airspeed: 40,
  door: 1,
  cabin: 1,
  roll: 0,
  rough: 0,
  warn: 0,
  flapRun: 0,
  distance: 4,
  doppler: 1,
  pan: 0,
  fire: 0,
  t: 0,
  ...o,
});
const plane = (o: Partial<PlaneVoice> = {}) => planeTargets(climbing(o), PROP, { machine: 1 });

function ride(): GameState {
  return createGame({ level: flat, mode: "free", plane: true, crowd: 0, quiet: true });
}

describe("the jump plane's voice (plane-voice.ts)", () => {
  it("passes its blades at the propeller's own rate, and its tips near sonic flat out", () => {
    expect(PROP.blade).toBeCloseTo((3 * 2200) / 60, 6);
    expect(plane().thrum.hz).toBeCloseTo(PROP.blade, 6);
    expect(plane({ rpm: 0.62 }).thrum.hz).toBeCloseTo(PROP.blade * 0.62, 6);
    expect(tipMachOf(PROP, 1, 30)).toBeGreaterThan(0.85);
    expect(tipMachOf(PROP, 1, 30)).toBeLessThan(1);
  });

  it("is silent with the engine stopped and nothing burning", () => {
    const still = plane({ rpm: 0, ng: 0, power: 0, load: 0, airspeed: 0, door: 0 });
    for (const [name, t] of Object.entries(still)) expect(t.level, name).toBe(0);
  });

  it("buzzes harder as the blades bite, and rasps only at full power", () => {
    const out = { cabin: 0 };
    expect(plane({ ...out, load: 1 }).buzz.level).toBeGreaterThan(
      plane({ ...out, load: 0.2 }).buzz.level,
    );
    expect(plane({ ...out, power: 0.3 }).rasp.level).toBe(0);
    expect(plane({ ...out, power: 1, airspeed: 30 }).rasp.level).toBeGreaterThan(0);
  });

  it("whines ahead of the propeller on the start, and louder while it runs up", () => {
    const start = plane({ rpm: 0.3, ng: Math.sqrt(0.3), power: 0.04, load: 0, rise: 1 });
    const held = plane({ rpm: 0.3, ng: Math.sqrt(0.3), power: 0.04, load: 0, rise: 0 });
    expect(start.whine.level).toBeGreaterThan(held.whine.level);
    expect(start.whine.hz!).toBeGreaterThan(plane().whine.hz! * 0.5);
  });

  it("fills the cabin with the slipstream through the open door, by the airspeed", () => {
    expect(plane({ airspeed: 60 }).door.level).toBeGreaterThan(plane({ airspeed: 30 }).door.level);
    expect(plane({ door: 0 }).door.level).toBe(0);
    // Outside, the door is only a breath; inside, the engine's top is dull
    // and the boom up.
    expect(plane({ cabin: 0 }).door.level).toBeLessThan(plane().door.level * 0.2);
    // The cockpit, up front, hears the door's slipstream well under the
    // door lens does.
    const cockpit = plane({ doorway: LISTENERS.tips.doorway }).door.level;
    expect(cockpit).toBeLessThan(plane({ doorway: LISTENERS.helmet.doorway }).door.level * 0.5);
    expect(cockpit).toBeGreaterThan(0);
    expect(plane().boom.level).toBeGreaterThan(plane({ cabin: 0 }).boom.level);
    expect(plane().whine.level).toBeLessThan(plane({ cabin: 0 }).whine.level);
    expect(plane().buzz.cutoff!).toBeLessThan(plane({ cabin: 0 }).buzz.cutoff!);
  });

  it("sounds the stall horn in the cabin only, near the stall", () => {
    const stall = 0.335;
    expect(stallWarnOf({ aoa: 0.1, stall, stalled: 0, grounded: false })).toBe(0);
    expect(stallWarnOf({ aoa: 0.32, stall, stalled: 0, grounded: false })).toBe(1);
    expect(stallWarnOf({ aoa: 0.32, stall, stalled: 0, grounded: true })).toBe(0);
    expect(plane({ warn: 1 }).horn.level).toBeGreaterThan(0);
    expect(plane({ warn: 1, cabin: 0 }).horn.level).toBe(0);
  });

  it("rumbles and hisses on the snow with the ground speed, and nothing in the air", () => {
    expect(plane({ roll: 0 }).rumble.level).toBe(0);
    expect(plane({ roll: 25 }).rumble.level).toBeGreaterThan(plane({ roll: 8 }).rumble.level);
    expect(plane({ roll: 25, rough: 1 }).rumble.level).toBeGreaterThan(
      plane({ roll: 25 }).rumble.level,
    );
    expect(plane({ roll: 25 }).hiss.level).toBeGreaterThan(0);
  });

  it("falls off with distance, losing its top first, and its pitch follows the Doppler", () => {
    const near = plane({ cabin: 0, distance: 6 });
    const far = plane({ cabin: 0, distance: 800 });
    expect(far.thrum.level).toBeLessThan(near.thrum.level * 0.2);
    expect(far.whine.level / near.whine.level).toBeLessThan(far.thrum.level / near.thrum.level);
    const coming = plane({ cabin: 0, distance: 300, doppler: 1.15 });
    const going = plane({ cabin: 0, distance: 300, doppler: 0.87 });
    expect(coming.thrum.hz!).toBeGreaterThan(going.thrum.hz!);
    expect(coming.whine.hz!).toBeGreaterThan(going.whine.hz!);
  });

  it("keeps every cutoff and pitch under the headset's ceiling, flat out and coming on", () => {
    const loud = plane({ doppler: 1.3, airspeed: 90, roll: 40, warn: 1, flapRun: 1, fire: 1 });
    for (const [name, t] of Object.entries(loud)) {
      if (t.cutoff !== undefined) expect(t.cutoff, name).toBeLessThanOrEqual(HEADSET);
      if (t.hz !== undefined) expect(t.hz, name).toBeLessThanOrEqual(HEADSET);
      expect(t.level, name).toBeLessThan(0.15);
    }
  });
});

describe("the jump plane's bed (plane-bed.ts)", () => {
  it("builds nothing on a run with no plane", () => {
    const synth = recorder();
    const bed = createPlaneBed(synth);
    bed.update(createGame({ level: flat, mode: "free", crowd: 0, quiet: true }), 1 / 60);
    expect(bed.live()).toBe(0);
  });

  it("idles the propeller slower on the snow and holds it governed in the air", () => {
    expect(propRpmOf({ spin: 1, power: PLANE.engine.idle, grounded: true })).toBeCloseTo(0.62, 6);
    expect(propRpmOf({ spin: 1, power: PLANE.engine.idle, grounded: false })).toBe(1);
    expect(propRpmOf({ spin: 1, power: 1, grounded: true })).toBe(1);
  });

  it("keeps the wreck's fire heard, sinking, after the restart puts him back aboard", () => {
    const s = ride();
    planeAloft(s, {
      x: SIZE / 2,
      y: flat.groundAt(SIZE / 2, SIZE / 2) + 120,
      z: SIZE / 2,
      heading: 0,
      speed: 50,
      pitch: -1.1,
      power: 1,
    });
    const synth = recorder();
    const bed = createPlaneBed(synth);
    bed.setView("chase");
    const dt = TUNING.dt;
    const fireOf = () =>
      synth.layers.find((l) => l.spec === PLANE_LAYERS.fire)?.sets.at(-1)?.level ?? 0;
    for (let i = 0; i < 20 / dt && s.plane!.mode !== "wreck"; i++) {
      step(s, { ...NEUTRAL_INPUT, tuck: 1 });
      if (i % 4 === 0) bed.update(s, 4 * dt);
    }
    expect(s.plane!.mode).toBe("wreck");
    const w = s.plane!.wreck!;
    const fire = planeFireOf(w.fuel, w.speed, w.kind);
    // Burning while the wreck lies there…
    for (let i = 0; i < 3 / dt; i++) {
      step(s, NEUTRAL_INPUT);
      if (i % 4 === 0) bed.update(s, 4 * dt);
    }
    const burning = fireOf();
    expect(burning).toBeGreaterThan(0);
    // …and on past the restart, for as long as the drawn pool fire burns.
    for (let i = 0; i < (PLANE.crash.wreck + 4) / dt; i++) {
      step(s, { ...NEUTRAL_INPUT, reset: true });
      if (i % 4 === 0) bed.update(s, 4 * dt);
    }
    expect(s.plane!.mode).not.toBe("wreck");
    expect(fire.out).toBeGreaterThan(PLANE.crash.wreck + 4);
    expect(fireOf()).toBeGreaterThan(0);
    expect(fireOf()).toBeLessThan(burning);
  });

  it("hears the cabin from a lens aboard, the machine from a boom", () => {
    const s = ride();
    planeAloft(s, { x: SIZE / 2, y: 900, z: SIZE / 2, heading: 0, speed: 50, power: 0.8 });
    const heard = { spin: 1, rise: 0, rough: 0, flapRun: 0 };
    expect(s.plane!.rider).toBe(true);
    expect(planeVoiceOf(s, heard, LISTENERS.helmet.cabin).cabin).toBe(1);
    expect(planeVoiceOf(s, heard, LISTENERS.chase.cabin).cabin).toBe(0);
    const synth = recorder();
    const bed = createPlaneBed(synth);
    bed.setView("tips");
    bed.update(s, 1 / 60);
    expect(bed.live()).toBe(Object.keys(PLANE_LAYERS).length);
    const door = synth.layers.find((l) => l.sets.length && l.spec === PLANE_LAYERS.door)!;
    expect(door.sets.at(-1)!.level).toBeGreaterThan(0.01);
  });

  it("is heard going away once he has jumped: far, and lowered by the Doppler", () => {
    const s = ride();
    planeAloft(s, { x: SIZE / 2, y: 900, z: SIZE / 2, heading: 0, speed: 50, power: 0.8 });
    const p = s.plane!;
    p.rider = false;
    const c = s.skier;
    c.x = p.x;
    c.y = p.y - 200;
    c.z = p.z - 400;
    c.vx = c.vz = 0;
    c.vy = -50;
    const v = planeVoiceOf(s, { spin: 1, rise: 0, rough: 0, flapRun: 0 }, 1);
    expect(v.cabin).toBe(0);
    expect(v.distance).toBeGreaterThan(400);
    // Going away north while he falls: the plane's closing speed is
    // negative.
    expect(v.doppler).toBeLessThan(1);
  });
});

describe("the skydive's voice and bed (chute-voice.ts, chute-bed.ts)", () => {
  const falling = (o: Partial<ChuteVoice> = {}): ChuteVoice => ({
    body: 1,
    exit: 0,
    airspeed: 55,
    attitude: Math.PI / 2,
    track: 0,
    flog: 0,
    open: 0,
    brake: 0,
    turn: 0,
    stalled: false,
    piece: 0,
    pieceDistance: 0,
    t: 0,
    ...o,
  });
  const mix = { wind: 1, machine: 1 };
  const air = (o: Partial<ChuteVoice> = {}) => chuteTargets(falling(o), mix);
  const sum = (t: Record<string, LayerTarget>) => Object.values(t).reduce((a, x) => a + x.level, 0);

  it("roars with the speed to terminal, brighter and tighter head down", () => {
    expect(air({ airspeed: 55 }).roar.level).toBeGreaterThan(air({ airspeed: 20 }).roar.level * 4);
    const head = air({ attitude: Math.PI, airspeed: 85 });
    const belly = air({ airspeed: 85 });
    expect(head.roar.cutoff!).toBeGreaterThan(belly.roar.cutoff!);
    expect(head.whistle.level).toBeGreaterThan(belly.whistle.level);
    expect(head.flap.level).toBeLessThan(belly.flap.level);
    expect(postureOf(Math.PI / 2, 1).track).toBe(1);
  });

  it("is quiet under the canopy: the rustle and the lines' hum a whisper of the freefall", () => {
    const canopy = air({ body: 0, open: 1, airspeed: 12 });
    expect(sum(canopy)).toBeLessThan(sum(air()) * 0.1);
    expect(canopy.hum.hz).toBeCloseTo(humOf(12), 6);
    expect(humOf(12)).toBeGreaterThan(1000);
    expect(air({ body: 0, open: 1, airspeed: 12, brake: 1 }).luff.level).toBeGreaterThan(
      canopy.luff.level,
    );
  });

  it("hears the toggles worked: the brake line zipping as it runs, the tail strained while held", () => {
    const canopy = { body: 0, open: 1, airspeed: 12 };
    expect(air(canopy).zip.level).toBe(0);
    expect(air({ ...canopy, pull: 1 }).zip.level).toBeGreaterThan(0);
    expect(air({ ...canopy, pull: 1 }).zip.cutoff!).toBeGreaterThan(
      air({ ...canopy, pull: 0.2 }).zip.cutoff!,
    );
    expect(air(canopy).tail.level).toBe(0);
    expect(air({ ...canopy, turn: 1 }).tail.level).toBeGreaterThan(0);
    expect(air({ ...canopy, riser: 1 }).tail.level).toBeGreaterThan(0);
    // Subtle: under the freefall's roar by far, and nothing in freefall.
    expect(air({ ...canopy, pull: 1, brake: 1 }).zip.level).toBeLessThan(air().roar.level * 0.1);
    expect(air({ pull: 1 }).zip.level).toBe(0);
    // A full throw in a quarter of a second is a whole pull; still, none.
    const was = { brake: 0, steer: 0, riser: 0 };
    expect(pullOf(was, { brake: 1, steer: 0, riser: 0 }, 0.25)).toBeCloseTo(1, 6);
    expect(pullOf(was, was, 1 / 60)).toBe(0);
  });

  it("flogs the canopy as it comes out, and flaps a cut-away off up the sky", () => {
    expect(air({ flog: 1 }).flog.level).toBeGreaterThan(0);
    expect(air({ flog: 0 }).flog.level).toBe(0);
    const near = air({ body: 0, piece: 15, pieceDistance: 10 }).piece.level;
    const far = air({ body: 0, piece: 15, pieceDistance: 300 }).piece.level;
    expect(far).toBeLessThan(near * 0.3);
  });

  it("owns the air in freefall, so the ride bed's wind stands down — and the plane's cabin", () => {
    const s = createGame({ level: flat, mode: "free", crowd: 0, quiet: true });
    expect(rideShares(s)).toEqual({ air: 1, snow: 1 });
    skydiveAt(s, { x: SIZE / 2, z: SIZE / 2, agl: 2000, fall: 50 });
    expect(rideShares(s).air).toBe(0);
    expect(chuteVoiceOf(s)!.body).toBe(1);
    skydiveAt(s, { x: SIZE / 2, z: SIZE / 2, agl: 300, mode: "open" });
    expect(rideShares(s).air).toBe(1);
    expect(chuteVoiceOf(s)!.open).toBe(1);
    const aboard = ride();
    expect(aboard.plane!.rider).toBe(true);
    expect(rideShares(aboard)).toEqual({ air: 0, snow: 0 });
  });

  it("builds nothing with no jump, and its layers in freefall", () => {
    const synth = recorder();
    const bed = createChuteBed(synth);
    const s = createGame({ level: flat, mode: "free", crowd: 0, quiet: true });
    bed.update(s, 1 / 60);
    expect(bed.live()).toBe(0);
    skydiveAt(s, { x: SIZE / 2, z: SIZE / 2, agl: 2000, fall: 50 });
    bed.update(s, 1 / 60);
    expect(bed.live()).toBeGreaterThan(0);
  });

  it("creaks what holds him off a hash of the clock — the same on every replay", () => {
    const a = Array.from({ length: 40 }, (_, i) => creakAt(i));
    const b = Array.from({ length: 40 }, (_, i) => creakAt(i));
    expect(a).toEqual(b);
    expect(a.filter(Boolean).length).toBeGreaterThan(5);
    expect(a.filter(Boolean).length).toBeLessThan(30);
  });
});

describe("the plane's and the skydive's moments (route.ts)", () => {
  const at = { t: 1, x: 0, y: 0, z: 0, speed: 3 };
  const planeEvent = (phase: string): GameEvent => ({ kind: "plane", phase, ...at }) as GameEvent;
  const chuteEvent = (phase: string, g?: number): GameEvent =>
    ({ kind: "chute", phase, ...at, g }) as GameEvent;

  it("answers every phase that should be heard, from a def that exists", () => {
    const heard: Record<string, string> = {
      board: "plane_board",
      liftoff: "plane_liftoff",
      land: "plane_land",
      stall: "plane_stall",
      jump: "plane_jump",
      stepoff: "plane_stepoff",
      crash: "plane_crash",
    };
    for (const [phase, id] of Object.entries(heard)) {
      expect(soundForEvent(planeEvent(phase))?.id, phase).toBe(id);
      expect(RUN_BANK[id], id).toBeDefined();
    }
    // The pilot home and the ride begun again are the bed's wind-down and
    // run-up.
    expect(soundForEvent(planeEvent("home"))).toBe(null);
    expect(soundForEvent(planeEvent("restart"))).toBe(null);
    const chute: Record<string, string> = {
      exit: "chute_exit",
      "open-start": "chute_throw",
      "line-stretch": "chute_lines",
      open: "chute_open",
      release: "chute_release",
      land: "chute_land",
    };
    for (const [phase, id] of Object.entries(chute)) {
      expect(soundForEvent(chuteEvent(phase))?.id, phase).toBe(id);
      expect(RUN_BANK[id], id).toBeDefined();
    }
    expect(soundForEvent(chuteEvent("restart"))).toBe(null);
  });

  it("cracks the boughs of a crown and twangs a lift's steel when the canopy is caught", () => {
    expect(soundForEvent(chuteEvent("snag"), { caught: "tree" })?.id).toBe("chute_snag_tree");
    expect(soundForEvent(chuteEvent("snag"), { caught: "rope" })?.id).toBe("chute_snag_lift");
    expect(RUN_BANK.chute_creak).toBeDefined();
    expect(RUN_BANK.chute_creak_steel).toBeDefined();
  });

  it("opens harder with a harder opening shock, and hears the plane's moments by distance", () => {
    expect(soundForEvent(chuteEvent("open", 6))!.shape!.gain!).toBeGreaterThan(
      soundForEvent(chuteEvent("open", 3))!.shape!.gain!,
    );
    const ear = { x: 0, y: 0, z: 0 };
    const near = soundForEvent({ ...planeEvent("land"), x: 3 } as GameEvent, { ear })!;
    const far = soundForEvent({ ...planeEvent("land"), x: 600 } as GameEvent, { ear })!;
    expect(far.shape!.gain!).toBeLessThan(near.shape!.gain! * 0.1);
  });
});
