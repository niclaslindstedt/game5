// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AUDIO GUARDS — the faults in this subsystem that are invisible without
// a test, because every one of them is a SILENCE rather than a crash:
//
//   * AN EVENT NOTHING ANSWERS. A `GameEvent` the race should be heard for
//     arrives and simply makes no noise; nothing anywhere reports it.
//   * A MIX THAT CREEPS. Every retune nudges one sound up to be heard over
//     the last one, until the limiter is doing all the work.
//   * A BED THAT SAYS NOTHING. A wind that does not change with the speed,
//     a hiss as loud at rest as at pace — a bed whose numbers are constants
//     is the loudest thing in the mix for the whole race.
//   * A BED THAT HOLDS. The pause card up and the wind blowing on behind
//     it — a layer that is not told to stop does not.
//   * A CUTOFF PAST NYQUIST. Fine on a laptop, a torn speaker on the 16 kHz
//     session iOS hands a Bluetooth headset.
//
// No DOM: the synth is replaced with a recorder, which is also the only way
// to assert what a sound actually asked the instrument for.

import { describe, expect, it } from "vitest";

import { createGame, placeRun, type GameEvent, type GameState } from "@engine";

import { RUN_BANK } from "../pwa/src/game/audio/bank.ts";
import {
  WIND_FULL,
  WIND_LAYERS,
  windTargets,
  type WindLayer,
  type WindVoice,
} from "../pwa/src/game/audio/wind-voice.ts";
import { LISTENERS, listenerFor } from "../pwa/src/game/audio/listener.ts";
import { DEFAULT_VOLUME, playDef } from "@niclaslindstedt/oss-game-framework/audio/play";
import { createRideBed } from "../pwa/src/game/audio/ride-bed.ts";
import { heardFrom, soundForEvent, soundsForStep } from "../pwa/src/game/audio/route.ts";
import {
  SNOW_LAYERS,
  snowTargets,
  type SnowLayer,
  type SnowVoice,
} from "../pwa/src/game/audio/snow-voice.ts";
import { RUN_CAMERAS } from "../pwa/src/game/settings.ts";
import {
  safeCutoff,
  type LayerSpec,
  type LayerTarget,
  type NoiseOptions,
  type Synth,
  type ToneOptions,
} from "@niclaslindstedt/oss-game-framework/audio/voice";
import { syntheticLevel } from "./support/synthetic.ts";

/** One layer the recorder built: what it was made of, every target it was
 * steered to, and whether it is still standing. */
type RecordedLayer = { spec: LayerSpec; sets: LayerTarget[]; stopped: boolean };

/** A synth that plays nothing and remembers everything, with a lock the test
 * can throw. */
function recorder(): Synth & {
  tones: ToneOptions[];
  noises: NoiseOptions[];
  layers: RecordedLayer[];
  locked: boolean;
} {
  const rec = {
    tones: [] as ToneOptions[],
    noises: [] as NoiseOptions[],
    layers: [] as RecordedLayer[],
    locked: false,
    unlock: () => {},
    autostart: () => {},
    resume: () => {},
    now: () => (rec.locked ? null : 0),
    tone: (o: ToneOptions) => void rec.tones.push(o),
    noise: (o: NoiseOptions) => void rec.noises.push(o),
    layer(spec: LayerSpec) {
      if (rec.locked) return null;
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

/** One sample of every event the engine can emit, keyed by kind so the TYPE
 * keeps the list complete: a new `GameEvent` does not compile until a
 * sample for it is written here. */
const EVERY_EVENT_BY_KIND: { [K in GameEvent["kind"]]: Extract<GameEvent, { kind: K }> } = {
  count: { kind: "count", t: 1, left: 3 },
  go: { kind: "go", t: 3 },
  air: { kind: "air", t: 1, vy: 4, speed: 20 },
  jump: { kind: "jump", t: 1, pop: 4, held: 1 },
  land: { kind: "land", t: 1, airTime: 0.9, impact: 5, speed: 20, harsh: false, lost: 0 },
  hit: { kind: "hit", t: 1, speed: 9, x: 0, z: 0 },
  bump: { kind: "bump", t: 1, rival: 1, speed: 6 },
  checkpoint: { kind: "checkpoint", t: 1, index: 3, lap: 0, split: 30 },
  missed: { kind: "missed", t: 1, index: 3 },
  lap: { kind: "lap", t: 1, lap: 1, time: 60 },
  finish: { kind: "finish", t: 1, time: 180, place: 1 },
  reset: { kind: "reset", t: 1, checkpoint: 2, auto: false },
  wipeout: { kind: "wipeout", t: 1, cause: "tree", speed: 14, x: 0, z: 0 },
  stuck: { kind: "stuck", t: 1 },
  damage: { kind: "damage", t: 1, part: "skiLeft", level: 0.3 },
  trick: { kind: "trick", t: 1, trick: "backflip", spins: 1, points: 300, mult: 3 },
  combo: { kind: "combo", t: 1, points: 2000, base: 700, mult: 3, sketchy: false },
  bail: { kind: "bail", t: 1, lost: 2000, cause: "wipeout" },
};

/** The kinds the bank says nothing about, with the reason: the lip is the
 * wind's moment — it comes up with the snow gone — not a one-shot's; a
 * skier bogged is the powder's hush, which the snow bed already is; and
 * what a blow bent is heard in the blow. */
const SILENT_KINDS: GameEvent["kind"][] = ["air", "stuck", "damage"];

/** The ceiling a context at 16 kHz holds a cutoff under. */
const HEADSET = safeCutoff(1e9, 16000);

describe("the bank and the route (bank.ts, route.ts)", () => {
  it("answers every event the race should be heard for, from a def that exists", () => {
    for (const event of Object.values(EVERY_EVENT_BY_KIND)) {
      const hit = soundForEvent(event);
      if (SILENT_KINDS.includes(event.kind)) {
        expect(hit, event.kind).toBe(null);
        continue;
      }
      expect(hit, event.kind).not.toBe(null);
      expect(RUN_BANK[hit!.id], `${event.kind} → ${hit!.id}`).toBeDefined();
    }
  });

  it("describes every sound, and keeps every voice under the mixing ceiling", () => {
    for (const [id, def] of Object.entries(RUN_BANK)) {
      expect(def.description.length, id).toBeGreaterThan(60);
      expect(def.voices.length, id).toBeGreaterThan(0);
      for (const v of def.voices) {
        expect(v.volume ?? DEFAULT_VOLUME[v.call], id).toBeLessThanOrEqual(0.08);
        if (v.filter) {
          expect(v.filter.frequency, id).toBeLessThanOrEqual(HEADSET);
          if (v.filter.to !== undefined) expect(v.filter.to, id).toBeLessThanOrEqual(HEADSET);
        }
      }
    }
  });

  it("picks the hard landing for a harsh one, and sizes both by the impact", () => {
    const soft = soundForEvent({ ...EVERY_EVENT_BY_KIND.land, impact: 2 })!;
    const big = soundForEvent({ ...EVERY_EVENT_BY_KIND.land, impact: 10 })!;
    expect(soft.id).toBe("land_soft");
    expect(big.shape!.gain!).toBeGreaterThan(soft.shape!.gain!);
    expect(soundForEvent({ ...EVERY_EVENT_BY_KIND.land, harsh: true })!.id).toBe("land_hard");
    // A skip over a mogul is the bed's, not a landing.
    expect(soundForEvent({ ...EVERY_EVENT_BY_KIND.land, airTime: 0.1 })).toBe(null);
  });

  it("plays one sound once per step, and lets the flag stand over the lap it closes", () => {
    const step: GameEvent[] = [
      EVERY_EVENT_BY_KIND.checkpoint,
      { ...EVERY_EVENT_BY_KIND.checkpoint, index: 4 },
      EVERY_EVENT_BY_KIND.lap,
      EVERY_EVENT_BY_KIND.finish,
    ];
    expect(soundsForStep(step).map((s) => s.id)).toEqual(["checkpoint", "finish"]);
  });

  it("shapes a one-shot by the seat it is heard from, filters and all", () => {
    const rec = recorder();
    const shape = heardFrom({ gain: 1, pitch: 1 }, LISTENERS.high);
    playDef(rec, RUN_BANK.hit_tree, shape);
    const crack = rec.noises[0];
    expect(crack.volume!).toBeLessThan(RUN_BANK.hit_tree.voices[0].volume!);
    expect(crack.filter!.frequency).toBeLessThan(RUN_BANK.hit_tree.voices[0].filter!.frequency);
  });
});

describe("the wind bed (wind-voice.ts)", () => {
  const mix = { wind: 1, tone: 1 };
  const voice = (o: Partial<WindVoice>): WindVoice => ({
    wind: 20,
    crouch: 0,
    airborne: false,
    ...o,
  });

  it("rises with the airspeed and is silent at rest", () => {
    const rest = windTargets(voice({ wind: 0 }), mix);
    for (const name of Object.keys(rest) as WindLayer[]) expect(rest[name].level, name).toBe(0);
    const slow = windTargets(voice({ wind: 10 }), mix);
    const fast = windTargets(voice({ wind: 30 }), mix);
    expect(fast.rush.level).toBeGreaterThan(slow.rush.level);
    expect(fast.rush.cutoff!).toBeGreaterThan(slow.rush.cutoff!);
    expect(windTargets(voice({ wind: WIND_FULL * 2 }), mix).rush.level).toBe(
      windTargets(voice({ wind: WIND_FULL }), mix).rush.level,
    );
  });

  it("roars in the tuck and flutters stood up", () => {
    const tall = windTargets(voice({ crouch: 0 }), mix);
    const tuck = windTargets(voice({ crouch: 1 }), mix);
    expect(tuck.roar.level).toBeGreaterThan(tall.roar.level * 3);
    expect(tall.flutter.level).toBeGreaterThan(tuck.flutter.level * 3);
  });

  it("comes up in the air, with the snow gone from under it", () => {
    const air = windTargets(voice({ airborne: true }), mix);
    const ground = windTargets(voice({}), mix);
    expect(air.rush.level).toBeGreaterThan(ground.rush.level);
  });

  it("whistles only at speed", () => {
    expect(windTargets(voice({ wind: 8 }), mix).whistle.level).toBe(0);
    expect(windTargets(voice({ wind: 30 }), mix).whistle.level).toBeGreaterThan(0);
  });

  it("keeps every cutoff under the headset's Nyquist and every level non-negative", () => {
    for (const wind of [0, 5, 15, 30, 45, 80]) {
      for (const crouch of [0, 0.5, 1]) {
        for (const airborne of [false, true]) {
          const t = windTargets(voice({ wind, crouch, airborne }), mix);
          for (const name of Object.keys(t) as WindLayer[]) {
            if (t[name].cutoff !== undefined)
              expect(t[name].cutoff!, name).toBeLessThanOrEqual(HEADSET);
            expect(t[name].level, name).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
    expect(Object.keys(WIND_LAYERS).sort()).toEqual(
      Object.keys(windTargets(voice({}), mix)).sort(),
    );
  });
});

describe("the snow bed (snow-voice.ts)", () => {
  const mix = { snow: 1 };
  const voice = (o: Partial<SnowVoice>): SnowVoice => ({
    speed: 20,
    pace: 0.6,
    packed: 1,
    hard: 0.5,
    grounded: 1,
    edge: 0,
    skid: 0,
    airborne: false,
    ...o,
  });

  it("crossfades the hiss of the packed piste into the hush of powder", () => {
    const piste = snowTargets(voice({ packed: 1 }), mix);
    const powder = snowTargets(voice({ packed: 0 }), mix);
    expect(piste.hiss.level).toBeGreaterThan(0);
    expect(piste.powder.level).toBe(0);
    expect(powder.powder.level).toBeGreaterThan(0);
    expect(powder.hiss.level).toBe(0);
  });

  it("is silent at rest and says nothing of the snow in the air", () => {
    const rest = snowTargets(voice({ speed: 0, pace: 0 }), mix);
    for (const name of Object.keys(rest) as SnowLayer[]) expect(rest[name].level, name).toBe(0);
    const air = snowTargets(voice({ airborne: true, edge: 1, skid: 1 }), mix);
    for (const name of Object.keys(air) as SnowLayer[]) expect(air[name].level, name).toBe(0);
  });

  it("tears on the edge, chatters on hard snow at speed, and rasps in a skid", () => {
    expect(snowTargets(voice({ edge: 0 }), mix).edge.level).toBe(0);
    expect(snowTargets(voice({ edge: 1 }), mix).edge.level).toBeGreaterThan(0);
    // A skidded ski is not carving: the skid takes the edge's tear down.
    expect(snowTargets(voice({ edge: 1, skid: 1 }), mix).edge.level).toBeLessThan(
      snowTargets(voice({ edge: 1 }), mix).edge.level,
    );
    expect(snowTargets(voice({ edge: 1, hard: 1, speed: 8 }), mix).chatter.level).toBe(0);
    expect(snowTargets(voice({ edge: 1, hard: 1, speed: 28 }), mix).chatter.level).toBeGreaterThan(
      snowTargets(voice({ edge: 1, hard: 0.2, speed: 28 }), mix).chatter.level,
    );
    expect(snowTargets(voice({ skid: 0 }), mix).skid.level).toBe(0);
    expect(snowTargets(voice({ skid: 1 }), mix).skid.level).toBeGreaterThan(0);
  });

  it("keeps its cutoffs under the headset", () => {
    for (const pace of [0, 0.5, 1.2]) {
      const t = snowTargets(voice({ pace, speed: pace * 33, edge: 1, skid: 1, hard: 1 }), mix);
      for (const name of Object.keys(t) as SnowLayer[]) {
        expect(t[name].cutoff!, name).toBeLessThanOrEqual(HEADSET);
      }
    }
    expect(Object.keys(SNOW_LAYERS).sort()).toEqual(
      Object.keys(snowTargets(voice({}), mix)).sort(),
    );
  });
});

describe("the listener (listener.ts)", () => {
  it("has a seat for every rung of the ladder and the cards' orbit", () => {
    for (const rung of [...RUN_CAMERAS, "orbit" as const])
      expect(LISTENERS[rung], rung).toBeDefined();
    expect(listenerFor("nowhere")).toBe(LISTENERS.chase);
  });

  it("thins the wind as the camera stands back", () => {
    expect(LISTENERS.high.wind).toBeLessThan(LISTENERS.chase.wind);
    expect(LISTENERS.orbit.wind).toBeLessThan(LISTENERS.high.wind);
    expect(LISTENERS.tips.snow).toBeGreaterThan(LISTENERS.chase.snow);
    expect(LISTENERS.helmet.wind).toBeGreaterThan(LISTENERS.chase.wind);
  });
});

describe("the ride bed (ride-bed.ts)", () => {
  /** A skier on the slope, going. */
  function going(speed: number): GameState {
    const state = createGame({
      level: syntheticLevel(),
      seed: 3,
      rivals: 0,
      countdown: 0,
      quiet: true,
    });
    placeRun(state, { x: 400, z: 400, heading: Math.PI / 2, speed });
    return state;
  }
  const LAYERS = Object.keys(WIND_LAYERS).length + Object.keys(SNOW_LAYERS).length;

  it("builds every layer once and steers it every frame, booking nothing ahead", () => {
    const rec = recorder();
    const bed = createRideBed(rec);
    const state = going(20);
    for (let i = 0; i < 30; i++) bed.update(state, 1 / 60);
    expect(rec.layers.length).toBe(LAYERS);
    expect(bed.live()).toBe(LAYERS);
    for (const layer of rec.layers) expect(layer.sets.length).toBe(30);
    expect(rec.tones.length + rec.noises.length).toBe(0);
  });

  it("is silent while the context is locked and builds the moment it is back", () => {
    const rec = recorder();
    const bed = createRideBed(rec);
    rec.locked = true;
    bed.update(going(10), 1 / 60);
    expect(rec.layers.length).toBe(0);
    rec.locked = false;
    bed.update(going(10), 1 / 60);
    expect(bed.live()).toBe(LAYERS);
  });

  it("says its silence: every layer comes down, and comes back on the next frame", () => {
    const rec = recorder();
    const bed = createRideBed(rec);
    const state = going(15);
    bed.update(state, 1 / 60);
    bed.silence();
    expect(bed.live()).toBe(0);
    expect(rec.layers.every((l) => l.stopped)).toBe(true);
    bed.update(state, 1 / 60);
    expect(bed.live()).toBe(LAYERS);
  });

  it("plays the wind through its own fader's view and the snow through the other", () => {
    const effects = recorder();
    const voice = recorder();
    createRideBed(effects, voice).update(going(20), 1 / 60);
    expect(voice.layers.length).toBe(Object.keys(WIND_LAYERS).length);
    expect(effects.layers.length).toBe(Object.keys(SNOW_LAYERS).length);
  });

  it("scales the whole bed by the duck under a card", () => {
    const loud = recorder();
    const quiet = recorder();
    const state = going(20);
    createRideBed(loud).update(state, 1 / 60, 1);
    createRideBed(quiet).update(state, 1 / 60, 0.5);
    const sum = (r: ReturnType<typeof recorder>) =>
      r.layers.reduce((acc, l) => acc + (l.sets[0]?.level ?? 0), 0);
    expect(sum(quiet)).toBeCloseTo(sum(loud) / 2, 6);
  });
});
