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

import {
  TUNING,
  createGame,
  placeRun,
  step,
  withSky,
  type GameEvent,
  type GameState,
} from "@engine";

import { RUN_BANK } from "../pwa/src/game/audio/bank.ts";
import {
  WIND_FULL,
  WIND_LAYERS,
  WIND_TOP,
  windTargets,
  type WindLayer,
  type WindVoice,
} from "../pwa/src/game/audio/wind-voice.ts";
import { LISTENERS, listenerFor } from "../pwa/src/game/audio/listener.ts";
import { DEFAULT_VOLUME, playDef } from "@niclaslindstedt/oss-game-framework/audio/play";
import { createRideBed, plantVoice } from "../pwa/src/game/audio/ride-bed.ts";
import { gaitOf } from "../pwa/src/game/skier-gait.ts";
import { heardFrom, soundForEvent, soundsForStep, trunkAt } from "../pwa/src/game/audio/route.ts";
import {
  NEUTRAL_SKI,
  SNOW_LAYERS,
  skiVoiceOf,
  snowTargets,
  type SnowLayer,
  type SnowUnder,
  type SnowVoice,
} from "../pwa/src/game/audio/snow-voice.ts";
import { SNOW_KINDS, type SnowKind } from "../pwa/src/game/snowpack.ts";
import { SKI_CATALOG } from "@engine";
import { RUN_CAMERAS } from "../pwa/src/game/settings.ts";
import {
  safeCutoff,
  type LayerSpec,
  type LayerTarget,
  type NoiseOptions,
  type Synth,
  type ToneOptions,
} from "@niclaslindstedt/oss-game-framework/audio/voice";
import { flatLevel, syntheticLevel } from "./support/synthetic.ts";

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
  out: { kind: "out", t: 9, out: { status: "dsq", why: "missed", gate: 4 } },
  pole: { kind: "pole", t: 9, gate: 3, speed: 2 },
  stake: { kind: "stake", t: 9, speed: 6, broke: false, x: 0, z: 0 },
  trap: { kind: "trap", t: 40, speed: 36 },
  net: { kind: "net", t: 40, speed: 8, x: 0, z: 0 },
  grimbear: { kind: "grimbear", t: 40, phase: "burst", x: 0, z: 0 },
  afterski: { kind: "afterski", t: 40, phase: "beer", beers: 1, buzz: 0.14 },
  fetch: { kind: "fetch", t: 40, phase: "ski", skis: 1 },
  groomer: { kind: "groomer", t: 40, phase: "strike", id: 0, x: 0, z: 0, speed: 5 },
  air: { kind: "air", t: 1, vy: 4, speed: 20 },
  jump: { kind: "jump", t: 1, pop: 4, held: 1 },
  land: {
    kind: "land",
    t: 1,
    airTime: 0.9,
    impact: 5,
    speed: 20,
    harsh: false,
    lost: 0,
    g: 3,
    off: 0.1,
  },
  hit: { kind: "hit", t: 1, speed: 9, x: 0, z: 0 },
  bump: { kind: "bump", t: 1, rival: 1, speed: 6 },
  checkpoint: { kind: "checkpoint", t: 1, index: 3, lap: 0, split: 30 },
  missed: { kind: "missed", t: 1, index: 3 },
  lap: { kind: "lap", t: 1, lap: 1, time: 60 },
  finish: { kind: "finish", t: 1, time: 180, place: 1 },
  reset: { kind: "reset", t: 1, checkpoint: 2, auto: false },
  wipeout: { kind: "wipeout", t: 1, cause: "tree", speed: 14, x: 0, z: 0 },
  save: { kind: "save", t: 1, save: "tree", size: 0.7 },
  stuck: { kind: "stuck", t: 1 },
  damage: { kind: "damage", t: 1, part: "skiLeft", level: 0.3 },
  injury: { kind: "injury", t: 1, part: "kneeL", injury: "tornAcl", ais: 2 },
  trick: { kind: "trick", t: 1, trick: "backflip", spins: 1, points: 300, mult: 3 },
  combo: { kind: "combo", t: 1, points: 2000, base: 700, mult: 3, sketchy: false },
  bail: { kind: "bail", t: 1, lost: 2000, cause: "wipeout" },
  tunnel: { kind: "tunnel", t: 1, id: "W1", phase: "in" },
  lift: { kind: "lift", t: 1, id: "C1", lift: "chair", phase: "tower" },
  heli: { kind: "heli", t: 1, phase: "crash", x: 0, y: 0, z: 0, speed: 12 },
  sled: { kind: "sled", t: 1, phase: "crash", x: 0, y: 0, z: 0, speed: 12 },
  para: { kind: "para", t: 1, phase: "drop", x: 0, y: 0, z: 0, speed: 14 },
  jam: { kind: "jam", t: 1, hit: 1, fell: false },
  jib: { kind: "jib", t: 1, id: "J1L", jib: "rail", phase: "on", whole: true },
};

/** The kinds the bank says nothing about, with the reason: the lip is the
 * wind's moment — it comes up with the snow gone — not a one-shot's; a
 * skier bogged is the powder's hush, which the snow bed already is; and
 * what a blow bent or hurt is heard in the blow, as a save is in the landing, the
 * trunk or the edges' scrape that started it. */
const SILENT_KINDS: GameEvent["kind"][] = ["air", "stuck", "damage", "save", "injury"];

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

describe("what a skier meets and comes down into (route.ts's Contact)", () => {
  const ground = (o: Partial<SnowUnder>): SnowUnder => ({
    groomed: 0,
    hard: 0,
    soft: 0,
    new: 0,
    wet: 0,
    ice: 0,
    ...o,
  });

  it("brushes a trunk slow and meets it fast, deeper for a fat one, dry for a snag", () => {
    const hit = EVERY_EVENT_BY_KIND.hit;
    expect(soundForEvent({ ...hit, speed: 2 })!.id).toBe("brush_tree");
    expect(soundForEvent({ ...hit, speed: 12 })!.id).toBe("hit_tree");
    const thin = soundForEvent(hit, { trunk: { radius: 0.15, snag: false } })!;
    const fat = soundForEvent(hit, { trunk: { radius: 0.6, snag: false } })!;
    expect(fat.shape!.pitch!).toBeLessThan(thin.shape!.pitch!);
    expect(fat.shape!.stretch!).toBeGreaterThan(thin.shape!.stretch!);
    expect(soundForEvent(hit, { trunk: { radius: 0.3, snag: true } })!.id).toBe("hit_snag");
  });

  it("finds the trunk a hit met on the map, and none where there is no tree", () => {
    const level = {
      trees: [
        { x: 10, z: 10, y: 0, height: 12, radius: 0.35, crown: 2 },
        { x: 11, z: 10, y: 0, height: 8, radius: 0.2, crown: 2, kind: "snag" as const },
      ],
    };
    expect(trunkAt(level, 11.2, 10)).toEqual({ radius: 0.2, snag: true });
    expect(trunkAt(level, 9.6, 10)).toEqual({ radius: 0.35, snag: false });
    expect(trunkAt(level, 40, 40)).toBe(null);
  });

  it("gives every way of being thrown a sound of its own, from a def that exists", () => {
    const causes = ["tree", "nose", "roll", "catch", "skier"] as const;
    const ids = causes.map((cause) => {
      const hit = soundForEvent({ ...EVERY_EVENT_BY_KIND.wipeout, cause })!;
      expect(RUN_BANK[hit.id], cause).toBeDefined();
      return hit.id;
    });
    expect(new Set(ids).size).toBe(causes.length);
  });

  it("lands in the snow it comes down into: a whumpf in powder, a slap on ice", () => {
    const land = EVERY_EVENT_BY_KIND.land;
    expect(soundForEvent(land, { ground: ground({ groomed: 1 }) })!.id).toBe("land_soft");
    expect(soundForEvent(land, { ground: ground({ soft: 1 }) })!.id).toBe("land_powder");
    expect(soundForEvent(land, { ground: ground({ new: 1 }) })!.id).toBe("land_powder");
    expect(soundForEvent(land, { ground: ground({ ice: 1 }) })!.id).toBe("land_ice");
    // A harsh one is the legs' failure, whatever it lands on.
    expect(soundForEvent({ ...land, harsh: true }, { ground: ground({ soft: 1 }) })!.id).toBe(
      "land_hard",
    );
    // Deep snow swallows the top of a fall.
    const fall = EVERY_EVENT_BY_KIND.wipeout;
    const inPowder = soundForEvent(fall, { ground: ground({ soft: 1 }) })!.shape!;
    const onPiste = soundForEvent(fall, { ground: ground({ groomed: 1 }) })!.shape!;
    expect(inPowder.pitch!).toBeLessThan(onPiste.pitch!);
    expect(inPowder.stretch!).toBeGreaterThan(onPiste.stretch!);
  });

  it("drops a ski cross's gate at GO, and counts no lights down on a heat", () => {
    const qualifying = { start: { gate: true, heat: false } };
    const heat = { start: { gate: true, heat: true } };
    // Its doors are the GO, the qualification's and a heat's alike.
    expect(soundForEvent(EVERY_EVENT_BY_KIND.go, qualifying)!.id).toBe("gate_drop");
    expect(soundForEvent(EVERY_EVENT_BY_KIND.go, heat)!.id).toBe("gate_drop");
    expect(RUN_BANK.gate_drop).toBeDefined();
    // The qualification is counted down as every race is; a heat is
    // started on the starter's word, the drop's moment never told.
    expect(soundForEvent(EVERY_EVENT_BY_KIND.count, qualifying)!.id).toBe("count");
    expect(soundForEvent(EVERY_EVENT_BY_KIND.count, heat)).toBe(null);
    // Every other start is the hut's beeps.
    expect(soundForEvent(EVERY_EVENT_BY_KIND.go)!.id).toBe("go");
    expect(soundForEvent(EVERY_EVENT_BY_KIND.count)!.id).toBe("count");
  });

  it("hands every event of a step its contact", () => {
    const seen: string[] = [];
    soundsForStep([EVERY_EVENT_BY_KIND.hit, EVERY_EVENT_BY_KIND.land], (e) => {
      seen.push(e.kind);
      return {};
    });
    expect(seen).toEqual(["hit", "land"]);
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
  });

  it("keeps climbing past a schuss, because a gale in the face IS that loud", () => {
    // 100 km/h of wind in the face of a skier doing 100 km/h is 200 km/h of
    // air: louder than any schuss in still air, and the buffet under it.
    const schuss = windTargets(voice({ wind: WIND_FULL }), mix);
    const gale = windTargets(voice({ wind: 200 / 3.6 }), mix);
    expect(gale.rush.level).toBeGreaterThan(schuss.rush.level * 1.8);
    expect(gale.buffet.level).toBeGreaterThan(schuss.buffet.level * 4);
    expect(windTargets(voice({ wind: 20 }), mix).buffet.level).toBe(0);
    // …and holds past the top, short of the limiter.
    expect(windTargets(voice({ wind: WIND_TOP * 2 }), mix).rush.level).toBe(
      windTargets(voice({ wind: WIND_TOP }), mix).rush.level,
    );
  });

  it("is heard on the side a crosswind comes from, and flaps the suit", () => {
    const ahead = windTargets(voice({}), mix);
    const left = windTargets(voice({ side: -1 }), mix);
    const right = windTargets(voice({ side: 1 }), mix);
    expect(ahead.rush.pan).toBe(0);
    expect(left.rush.pan!).toBeLessThan(0);
    expect(right.whistle.pan!).toBeGreaterThan(right.rush.pan!);
    expect(right.flutter.level).toBeGreaterThan(ahead.flutter.level * 1.5);
    expect(left.flutter.level).toBeCloseTo(right.flutter.level, 12);
    for (const name of Object.keys(right) as WindLayer[]) {
      expect(Math.abs(right[name].pan ?? 0), name).toBeLessThanOrEqual(1);
    }
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
    for (const wind of [0, 5, 15, 30, 45, 80, 200]) {
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
  /** One kind of snow everywhere under the skis. */
  const only = (kind: SnowKind): SnowUnder => {
    const under = { groomed: 0, hard: 0, soft: 0, new: 0, wet: 0, ice: 0 };
    under[kind] = 1;
    return under;
  };
  const voice = (o: Partial<SnowVoice>): SnowVoice => ({
    speed: 20,
    pace: 0.6,
    under: only("groomed"),
    ski: NEUTRAL_SKI,
    grounded: 1,
    edge: 0,
    skid: 0,
    airborne: false,
    ...o,
  });

  it("crossfades the hiss of the groomed piste into the hush of powder", () => {
    const piste = snowTargets(voice({ under: only("groomed") }), mix);
    const powder = snowTargets(voice({ under: only("soft") }), mix);
    expect(piste.hiss.level).toBeGreaterThan(0);
    expect(piste.powder.level).toBe(0);
    expect(powder.powder.level).toBeGreaterThan(0);
    expect(powder.hiss.level).toBe(0);
  });

  it("gives every kind of snow a layer of its own", () => {
    const heard: Record<SnowKind, SnowLayer> = {
      groomed: "hiss",
      hard: "crunch",
      soft: "powder",
      new: "powder",
      wet: "slush",
      ice: "scrape",
    };
    for (const kind of SNOW_KINDS) {
      const t = snowTargets(voice({ under: only(kind), edge: 0.6, skid: 0.2 }), mix);
      expect(t[heard[kind]].level, kind).toBeGreaterThan(0);
    }
    // Each kind's own layer is silent on every other kind.
    for (const [kind, layer] of [
      ["hard", "crunch"],
      ["wet", "slush"],
      ["ice", "scrape"],
    ] as const) {
      for (const other of SNOW_KINDS) {
        if (other === kind) continue;
        const t = snowTargets(voice({ under: only(other), edge: 1, skid: 1 }), mix);
        expect(t[layer].level, `${layer} on ${other}`).toBe(0);
      }
    }
  });

  it("hushes deeper and darker in new snow than in settled powder", () => {
    const settled = snowTargets(voice({ under: only("soft") }), mix).powder;
    const fresh = snowTargets(voice({ under: only("new") }), mix).powder;
    expect(fresh.level).toBeLessThan(settled.level);
    expect(fresh.cutoff!).toBeLessThan(settled.cutoff!);
  });

  it("takes the edge's tear off the ice and gives it to the scrape", () => {
    const groomer = snowTargets(voice({ edge: 1 }), mix);
    const ice = snowTargets(voice({ edge: 1, under: only("ice") }), mix);
    expect(ice.edge.level).toBe(0);
    expect(ice.scrape.level).toBeGreaterThan(0);
    expect(groomer.scrape.level).toBe(0);
    // A flat base running straight on ice does not screech.
    expect(snowTargets(voice({ under: only("ice") }), mix).scrape.level).toBe(0);
  });

  it("is silent at rest and says nothing of the snow in the air", () => {
    for (const kind of SNOW_KINDS) {
      const rest = snowTargets(voice({ speed: 0, pace: 0, under: only(kind), edge: 1 }), mix);
      for (const name of Object.keys(rest) as SnowLayer[])
        expect(rest[name].level, `${name} on ${kind}`).toBe(0);
      const air = snowTargets(voice({ airborne: true, edge: 1, skid: 1, under: only(kind) }), mix);
      for (const name of Object.keys(air) as SnowLayer[]) expect(air[name].level, name).toBe(0);
    }
  });

  it("tears on the edge, chatters on firm snow at speed, and rasps in a skid", () => {
    expect(snowTargets(voice({ edge: 0 }), mix).edge.level).toBe(0);
    expect(snowTargets(voice({ edge: 1 }), mix).edge.level).toBeGreaterThan(0);
    // A skidded ski is not carving: the skid takes the edge's tear down.
    expect(snowTargets(voice({ edge: 1, skid: 1 }), mix).edge.level).toBeLessThan(
      snowTargets(voice({ edge: 1 }), mix).edge.level,
    );
    const ice = only("ice");
    expect(snowTargets(voice({ edge: 1, under: ice, speed: 8 }), mix).chatter.level).toBe(0);
    expect(
      snowTargets(voice({ edge: 1, under: ice, speed: 28 }), mix).chatter.level,
    ).toBeGreaterThan(
      snowTargets(voice({ edge: 1, under: only("groomed"), speed: 28, pace: 0.2 }), mix).chatter
        .level,
    );
    expect(snowTargets(voice({ edge: 1, under: only("soft"), speed: 28 }), mix).chatter.level).toBe(
      0,
    );
    expect(snowTargets(voice({ skid: 0 }), mix).skid.level).toBe(0);
    expect(snowTargets(voice({ skid: 1 }), mix).skid.level).toBeGreaterThan(0);
  });

  it("hears the pair: a soft ski buzzes, a stiff one rings higher, a fat one hushes deeper", () => {
    const pair = (name: string) => skiVoiceOf(SKI_CATALOG.find((s) => s.name === name)!);
    const onIce = (ski: ReturnType<typeof skiVoiceOf>) =>
      snowTargets(voice({ ski, under: only("ice"), edge: 1, speed: 28, pace: 0.9 }), mix).chatter;
    expect(onIce(pair("Hare")).level).toBeGreaterThan(onIce(pair("Eagle")).level);
    expect(onIce(pair("Eagle")).cutoff!).toBeGreaterThan(onIce(pair("Hare")).cutoff!);
    const inPowder = (ski: ReturnType<typeof skiVoiceOf>) =>
      snowTargets(voice({ ski, under: only("soft") }), mix).powder;
    expect(inPowder(pair("Marmot")).level).toBeGreaterThan(inPowder(pair("Swift")).level);
    expect(inPowder(pair("Marmot")).cutoff!).toBeLessThan(inPowder(pair("Swift")).cutoff!);
    for (const spec of SKI_CATALOG) {
      const v = skiVoiceOf(spec);
      for (const n of [v.flex, v.width, v.length]) {
        expect(n, spec.name).toBeGreaterThanOrEqual(0);
        expect(n, spec.name).toBeLessThanOrEqual(1);
      }
    }
  });

  it("keeps its cutoffs under the headset", () => {
    for (const kind of SNOW_KINDS) {
      for (const pace of [0, 0.5, 1.2]) {
        for (const ski of [skiVoiceOf(SKI_CATALOG[0]), { flex: 1, width: 1, length: 1 }]) {
          const t = snowTargets(
            voice({ pace, speed: pace * 33, edge: 1, skid: 1, under: only(kind), ski }),
            mix,
          );
          for (const name of Object.keys(t) as SnowLayer[]) {
            expect(t[name].cutoff!, name).toBeLessThanOrEqual(HEADSET);
            expect(t[name].level, name).toBeGreaterThanOrEqual(0);
          }
        }
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

  it("hears the APPARENT wind: a headwind adds to the speed, a tailwind takes it away", () => {
    /** The rush's last level, skiing at 20 m/s along +x under `windFrom`. */
    const rushUnder = (sky: Parameters<typeof withSky>[1], speed = 20): number => {
      const voice = recorder();
      const bed = createRideBed(recorder(), voice);
      const state = going(speed);
      state.level = withSky(state.level, sky);
      for (let i = 0; i < 60; i++) bed.update(state, 1 / 60);
      const rush = voice.layers[Object.keys(WIND_LAYERS).indexOf("rush")];
      return rush.sets[rush.sets.length - 1].level;
    };
    const calm = rushUnder({ weather: { kind: "fog", wind: 0 } });
    // Facing +x: a wind FROM +x is in his face, one from -x is behind him.
    const head = rushUnder({ weather: { kind: "storm", wind: 20, windFrom: Math.PI / 2 } });
    const tail = rushUnder({ weather: { kind: "storm", wind: 20, windFrom: -Math.PI / 2 } });
    expect(head).toBeGreaterThan(calm * 2.5);
    expect(tail).toBeLessThan(calm * 0.5);
    // A storm is heard standing still.
    expect(rushUnder({ weather: { kind: "storm", wind: 20, windFrom: 0 } }, 0)).toBeGreaterThan(0);
  });

  it("plays the wind through its own fader's view and the snow through the other", () => {
    const effects = recorder();
    const voice = recorder();
    createRideBed(effects, voice).update(going(20), 1 / 60);
    expect(voice.layers.length).toBe(Object.keys(WIND_LAYERS).length);
    expect(effects.layers.length).toBe(Object.keys(SNOW_LAYERS).length);
  });

  it("reads what lies under the skis off the run's snowpack, a mix summing to one", () => {
    const bed = createRideBed(recorder());
    const state = going(20);
    bed.update(state, 1 / 60);
    const under = bed.ground();
    const sum = Object.values(under).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
    // Snow falling during the run buries what was there in new snow — gone
    // wet at once under the synthetic slope's high spring sun.
    state.fresh = 1;
    bed.update(state, 1 / 60);
    expect(bed.ground().new + bed.ground().wet).toBeGreaterThan(0.5);
    expect(bed.ground().groomed).toBe(0);
  });

  it("hears a pole plant off the snow it goes into: a tick, a pat, then nothing", () => {
    // The groomer: the tip's tick alone.
    expect(plantVoice(1, 0)).toEqual({ tick: 1, pat: 0, muffle: 1 });
    // A hand of loose snow: a pat, muffled; deeper, quieter and darker.
    const shallow = plantVoice(0, 0.1);
    const deeper = plantVoice(0, 0.4);
    expect(shallow.tick).toBe(0);
    expect(shallow.pat).toBeGreaterThan(deeper.pat);
    expect(deeper.pat).toBeGreaterThan(0);
    expect(deeper.muffle).toBeLessThan(shallow.muffle);
    // Deep powder swallows it.
    expect(plantVoice(0, 1)).toMatchObject({ tick: 0, pat: 0 });
  });

  /** Skating off a standstill on the flat with the tuck held, the bed fed
   * every step: the one-shots it played. */
  function plants(packed: number, depth = 1, poles = true) {
    const rec = recorder();
    const bed = createRideBed(rec);
    const state = createGame({
      level: flatLevel({ packed }),
      rivals: 0,
      countdown: 0,
      quiet: true,
      snowDepth: depth,
      poles,
    });
    placeRun(state, { x: 1500, z: 200, heading: 0, speed: 1 });
    for (let i = 0; i < 4 * TUNING.physicsHz; i++) {
      step(state, { steer: 0, tuck: 1, brake: 0, lean: 0, reset: false });
      bed.update(state, TUNING.dt);
    }
    return { rec, bed, state };
  }

  it("plants a pole where the figure plants one, and sounds the snow it goes into", () => {
    const groomer = plants(1);
    expect(groomer.state.skier.stride).toBeGreaterThan(2);
    // A tick (its sine) for every stroke the gait draws, and only those.
    expect(groomer.rec.tones.length).toBeGreaterThanOrEqual(
      Math.floor(groomer.state.skier.stride) - 1,
    );
    expect(groomer.rec.tones.length).toBeLessThanOrEqual(Math.floor(groomer.state.skier.stride));
    // Deep powder: the basket goes in without a sound.
    const deep = plants(0, 2.5);
    expect(deep.state.skier.stride).toBeGreaterThan(1);
    expect(deep.rec.tones.length + deep.rec.noises.length).toBe(0);
    // No poles, no plants.
    const bare = plants(1, 1, false);
    expect(bare.rec.tones.length + bare.rec.noises.length).toBe(0);
  });

  it("plants nothing while the arms have given the poles up, working or not", () => {
    // A way under the push's fade but past where a stroke keeps up with
    // the snow: he is still driving, and the figure has stopped poling.
    const keepAt = (w: number) =>
      gaitOf({ drive: 1, stride: 0.1, speed: w, way: w, airborne: false, thrown: null, pitch: 0 })
        .keep;
    let way = 1;
    while (keepAt(way) > 0.001 && way < TUNING.poles.fade) way += 0.05;
    expect(way).toBeLessThan(TUNING.poles.fade - 0.1);
    const rec = recorder();
    const bed = createRideBed(rec);
    const state = going(way);
    const c = state.skier;
    c.vx = 0;
    c.vz = way;
    c.way = c.speed = way;
    c.drive = 1;
    c.crouch = 0;
    c.pitch = 0;
    for (const p of c.contacts) p.touching = true;
    for (let i = 0; i < 120; i++) {
      c.stride += 0.05;
      bed.update(state, 1 / 60);
    }
    expect(rec.tones.length + rec.noises.length).toBe(0);
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
