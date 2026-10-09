// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER, HEARD — the free ride's machine as a bed (`heli-voice.ts`,
// `heli-bed.ts`) and its moments as one-shots (`heli-bank.ts`, `route.ts`).
// The faults here are silences and constants: a rotor whose rate never
// follows its spool, a machine as loud a kilometre off as on the skid, a
// whine that outlives a crash, a fire that does not crackle — so the
// suite reads the targets by name, against a recording synth, no DOM.

import { describe, expect, it } from "vitest";

import { HELI, createGame, freshHeli, placeRun, type GameEvent, type GameState } from "@engine";

import { RUN_BANK } from "../pwa/src/game/audio/bank.ts";
import { createHeliBed, fireOf, heliVoiceOf } from "../pwa/src/game/audio/heli-bed.ts";
import {
  HEARD_FAR,
  HELI_LAYERS,
  crackleAt,
  dopplerOf,
  heliHeard,
  heliTargets,
  rotorsOf,
  slapOf,
  washOf,
  type HeliVoice,
} from "../pwa/src/game/audio/heli-voice.ts";
import { LISTENERS } from "../pwa/src/game/audio/listener.ts";
import { soundForEvent } from "../pwa/src/game/audio/route.ts";
import {
  safeCutoff,
  type LayerSpec,
  type LayerTarget,
  type NoiseOptions,
  type Synth,
  type ToneOptions,
} from "@niclaslindstedt/oss-game-framework/audio/voice";
import { syntheticLevel } from "./support/synthetic.ts";

type RecordedLayer = { spec: LayerSpec; sets: LayerTarget[]; stopped: boolean };

/** A synth that plays nothing and remembers everything. */
function recorder(): Synth & {
  tones: ToneOptions[];
  noises: NoiseOptions[];
  layers: RecordedLayer[];
} {
  const rec = {
    tones: [] as ToneOptions[],
    noises: [] as NoiseOptions[],
    layers: [] as RecordedLayer[],
    unlock: () => {},
    autostart: () => {},
    resume: () => {},
    now: () => 0,
    tone: (o: ToneOptions) => void rec.tones.push(o),
    noise: (o: NoiseOptions) => void rec.noises.push(o),
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

const ROTORS = rotorsOf(HELI);
const NAMES = Object.keys(HELI_LAYERS);
const HEADSET = safeCutoff(1e9, 16000);

/** A helicopter hovering beside the ear at full rpm. */
const hover = (o: Partial<HeliVoice> = {}): HeliVoice => ({
  spool: 1,
  rise: 0,
  collective: 0.6,
  slap: 0,
  wash: 0,
  distance: 4,
  doppler: 1,
  pan: 0,
  fire: 0,
  t: 0,
  ...o,
});
const targets = (o: Partial<HeliVoice> = {}) => heliTargets(hover(o), ROTORS, { machine: 1 });

describe("the helicopter's voice (heli-voice.ts)", () => {
  it("passes its blades at the machine's own rates", () => {
    expect(ROTORS.main).toBeCloseTo((3 * 390) / 60, 6);
    expect(ROTORS.tail).toBeCloseTo((2 * 2050) / 60, 6);
  });

  it("is silent with the rotor still and nothing burning", () => {
    for (const [name, t] of Object.entries(targets({ spool: 0 }))) expect(t.level, name).toBe(0);
  });

  it("whops at the blade passage times the spool, and the turbine runs up ahead of it", () => {
    const full = targets();
    const half = targets({ spool: 0.5 });
    expect(full.whop.hz).toBeCloseTo(ROTORS.main, 6);
    expect(half.whop.hz).toBeCloseTo(ROTORS.main * 0.5, 6);
    expect(full.tail.hz).toBeCloseTo(ROTORS.tail, 6);
    expect(half.whop.level).toBeLessThan(full.whop.level);
    // The gas generator leads: half the rotor's rpm is well over half the whine.
    expect(half.whine.hz! / full.whine.hz!).toBeGreaterThan(0.75);
    // Spooling up, the start's whine is louder than the same rpm held.
    expect(targets({ spool: 0.3, rise: 1 }).whine.level).toBeGreaterThan(
      targets({ spool: 0.3 }).whine.level,
    );
    expect(full.whine2.hz).toBeCloseTo(full.whine.hz! * 2, 6);
  });

  it("slaps in a descent and a hard turn, never in a level hover", () => {
    expect(slapOf({ sink: 0, speed: 0, yawRate: 0, collective: 0.5 })).toBe(0);
    const descent = slapOf({ sink: 5, speed: 15, yawRate: 0, collective: 0.4 });
    const turn = slapOf({ sink: 0, speed: 30, yawRate: 0.8, collective: 0.5 });
    expect(descent).toBeGreaterThan(0.5);
    expect(turn).toBeGreaterThan(0.5);
    expect(targets({ slap: 0 }).slap.level).toBe(0);
    expect(targets({ slap: 1 }).slap.level).toBeGreaterThan(0);
    expect(targets({ slap: 1 }).whop.cutoff!).toBeGreaterThan(targets().whop.cutoff!);
  });

  it("blows the snow up near it and pulling, and none high over it", () => {
    const at = (agl: number, push: number) =>
      washOf({ agl, radius: HELI.rotor.radius, reach: HELI.wash.reach, push, spool: 1 });
    expect(at(3, 1)).toBeGreaterThan(at(15, 1));
    expect(at(3, 1)).toBeGreaterThan(at(3, 0.3));
    expect(at(60, 1)).toBe(0);
    expect(targets({ wash: 1 }).wash.level).toBeGreaterThan(0);
    expect(targets({ wash: 0 }).wash.level).toBe(0);
  });

  it("falls off with distance, the whine first and the thump last", () => {
    const near = targets({ distance: 4 });
    const far = targets({ distance: 600 });
    expect(far.whop.level).toBeLessThan(near.whop.level * 0.05);
    expect(far.whine.level / near.whine.level).toBeLessThan(far.thump.level / near.thump.level);
    expect(far.whop.cutoff!).toBeLessThan(near.whop.cutoff!);
    for (const t of Object.values(targets({ distance: HEARD_FAR + 1 }))) expect(t.level).toBe(0);
    // Nothing gets louder inside the reference distance: the skid is the top.
    expect(heliHeard(1).gain).toBe(heliHeard(4).gain);
  });

  it("is raised by its closing speed and lowered going away", () => {
    expect(dopplerOf(0)).toBe(1);
    expect(dopplerOf(40)).toBeGreaterThan(1.1);
    expect(dopplerOf(-40)).toBeLessThan(0.92);
    expect(targets({ doppler: dopplerOf(40) }).whop.hz!).toBeGreaterThan(targets().whop.hz!);
  });

  it("burns only as a wreck, and crackles off the slot, the same every time", () => {
    expect(targets({ fire: 0 }).fire.level).toBe(0);
    expect(targets({ spool: 0, fire: 1 }).fire.level).toBeGreaterThan(0);
    expect(crackleAt(17, 0)).toBe(null);
    let pops = 0;
    for (let s = 0; s < 4000; s++) if (crackleAt(s, 1)) pops++;
    expect(pops / 4000).toBeGreaterThan(0.2);
    expect(pops / 4000).toBeLessThan(0.4);
    for (let s = 0; s < 50; s++) expect(crackleAt(s, 1)).toEqual(crackleAt(s, 1));
  });

  it("keeps every cutoff and pitch under the headset and every level non-negative", () => {
    for (const spool of [0, 0.1, 0.5, 1])
      for (const doppler of [dopplerOf(-60), 1, dopplerOf(60)])
        for (const distance of [0, 4, 200, 2500])
          for (const t of Object.values(
            targets({ spool, doppler, distance, slap: 1, wash: 1, fire: 1, rise: 1, t: 3 }),
          )) {
            expect(t.level).toBeGreaterThanOrEqual(0);
            if (t.cutoff !== undefined) expect(t.cutoff).toBeLessThanOrEqual(HEADSET);
            if (t.hz !== undefined) expect(t.hz).toBeLessThanOrEqual(HEADSET);
          }
  });
});

describe("the helicopter's moments (heli-bank.ts, route.ts)", () => {
  const at = (phase: Extract<GameEvent, { kind: "heli" }>["phase"], x = 0, speed = 10) =>
    ({ kind: "heli", t: 1, phase, x, y: 0, z: 0, speed }) as const;

  it("answers the skid, the drop and the crash from defs that exist, and says nothing else", () => {
    const want = {
      board: "heli_board",
      liftoff: "heli_liftoff",
      land: "heli_land",
      drop: "heli_drop",
      slip: "heli_drop",
      rotor: "heli_chop",
      crash: "heli_crash",
    } as const;
    for (const [phase, id] of Object.entries(want)) {
      const hit = soundForEvent(at(phase as keyof typeof want));
      expect(hit?.id, phase).toBe(id);
      expect(RUN_BANK[id], id).toBeDefined();
    }
    expect(soundForEvent(at("home"))).toBe(null);
    expect(soundForEvent(at("restart"))).toBe(null);
    expect(RUN_BANK.heli_crackle).toBeDefined();
  });

  it("blows up loudest beside the ear and duller and longer far off", () => {
    const ear = { x: 0, y: 0, z: 0 };
    const near = soundForEvent(at("crash", 5), { ear })!.shape!;
    const far = soundForEvent(at("crash", 1500), { ear })!.shape!;
    expect(far.gain!).toBeLessThan(near.gain! * 0.1);
    expect(far.gain!).toBeGreaterThan(0);
    expect(far.pitch!).toBeLessThan(near.pitch!);
    expect(far.stretch!).toBeGreaterThan(near.stretch!);
    // A harder crash is a bigger blast.
    const hard = soundForEvent(at("crash", 5, 30), { ear })!.shape!;
    const soft = soundForEvent(at("crash", 5, 2), { ear })!.shape!;
    expect(hard.gain!).toBeGreaterThan(soft.gain!);
  });

  it("is the loudest def in the bank, and the longest", () => {
    const end = (id: string) =>
      Math.max(...RUN_BANK[id].voices.map((v) => (v.delayMs ?? 0) + v.durationMs));
    const sum = (id: string) => RUN_BANK[id].voices.reduce((a, v) => a + (v.volume ?? 0.05), 0);
    expect(end("heli_crash")).toBeGreaterThan(3000);
    for (const id of Object.keys(RUN_BANK))
      if (id !== "heli_crash") expect(sum(id), id).toBeLessThan(sum("heli_crash"));
  });
});

describe("the helicopter's bed (heli-bed.ts)", () => {
  /** A free-ride-shaped state on the synthetic slope with a helicopter on it. */
  function withHeli(): GameState {
    const state = createGame({
      level: syntheticLevel(),
      seed: 3,
      rivals: 0,
      countdown: 0,
      quiet: true,
    });
    placeRun(state, { x: 400, z: 400, heading: 0, speed: 0 });
    state.heli = freshHeli(state);
    Object.assign(state.heli, { x: 400, y: state.skier.y - 0.5, z: 402 });
    return state;
  }

  it("builds nothing on a run without a helicopter, nor for a still rotor", () => {
    const rec = recorder();
    const bed = createHeliBed(rec);
    const state = withHeli();
    const heli = state.heli;
    state.heli = undefined;
    bed.update(state, 1 / 60);
    state.heli = heli;
    bed.update(state, 1 / 60);
    expect(rec.layers.length).toBe(0);
  });

  it("is deafening on the skid and a thud a kilometre off", () => {
    const whopAt = (dx: number): number => {
      const rec = recorder();
      const bed = createHeliBed(rec);
      const state = withHeli();
      Object.assign(state.heli!, { spool: 1, collective: 0.6, x: 400 + dx });
      for (let i = 0; i < 10; i++) bed.update(state, 1 / 60);
      expect(bed.live()).toBe(NAMES.length);
      const whop = rec.layers[NAMES.indexOf("whop")];
      return whop.sets[whop.sets.length - 1].level;
    };
    const near = whopAt(0);
    const far = whopAt(1000);
    expect(near).toBeGreaterThan(0.04);
    expect(far).toBeGreaterThan(0);
    expect(far).toBeLessThan(near * 0.02);
  });

  it("hears a machine flying away lower than one coming on", () => {
    const state = withHeli();
    Object.assign(state.heli!, { spool: 1, x: 400, z: 700, vz: 45 });
    const away = heliVoiceOf(state, 1, 0);
    state.heli!.vz = -45;
    const coming = heliVoiceOf(state, 1, 0);
    expect(away.doppler).toBeLessThan(1);
    expect(coming.doppler).toBeGreaterThan(1);
    // Riding it, the two move together.
    Object.assign(state.heli!, { rider: true, vz: 45 });
    expect(heliVoiceOf(state, 1, 0).doppler).toBe(1);
  });

  it("chokes the rotor in a crash and burns, crackling, until the wreck goes out", () => {
    const rec = recorder();
    const bed = createHeliBed(rec);
    const state = withHeli();
    Object.assign(state.heli!, { spool: 1, collective: 0.6 });
    bed.update(state, 1 / 60);
    // The engine stops it dead; the ear hears it wind down instead.
    Object.assign(state.heli!, { mode: "wreck", spool: 0, t: 0.5 });
    const whop = rec.layers[NAMES.indexOf("whop")];
    const fire = rec.layers[NAMES.indexOf("fire")];
    bed.update(state, 1 / 60);
    const first = whop.sets[whop.sets.length - 1];
    expect(first.level).toBeGreaterThan(0);
    for (let i = 0; i < 120; i++) {
      state.t += 1 / 60;
      state.heli!.t += 1 / 60;
      bed.update(state, 1 / 60);
    }
    const later = whop.sets[whop.sets.length - 1];
    expect(later.level).toBeLessThan(first.level * 0.01);
    expect(later.hz!).toBeLessThan(first.hz!);
    expect(fire.sets[fire.sets.length - 1].level).toBeGreaterThan(0);
    // Two seconds of fire crackle, off the bank's own pop.
    expect(rec.noises.length).toBeGreaterThan(10);
    expect(fireOf({ mode: "wreck", t: HELI.crash.wreck })).toBe(0);
    expect(fireOf({ mode: "flown", t: 1 })).toBe(0);
  });

  it("says its silence, and lets go of a run that has no helicopter", () => {
    const rec = recorder();
    const bed = createHeliBed(rec);
    const state = withHeli();
    state.heli!.spool = 0.8;
    bed.update(state, 1 / 60);
    bed.silence();
    expect(bed.live()).toBe(0);
    bed.update(state, 1 / 60);
    expect(bed.live()).toBe(NAMES.length);
    state.heli = undefined;
    bed.update(state, 1 / 60);
    expect(bed.live()).toBe(0);
  });

  it("leans on the machine from every seat, loudest in the helmet", () => {
    for (const [seat, row] of Object.entries(LISTENERS))
      expect(row.machine, seat).toBeGreaterThan(0);
    expect(LISTENERS.helmet.machine).toBeGreaterThan(LISTENERS.high.machine);
  });
});
