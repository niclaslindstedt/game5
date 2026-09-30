// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE SKIER FEELS — the seam that carries a pulse out to the phone, and
// the vibration table behind it.
//
// A pulse is named in THREE files that cannot import each other — the page's
// `shell-host.ts` (the event), the store app's injected bridge (the listener
// that posts it) and the store app's parser (the message it reads). A rename
// in one of them is a phone that silently stops buzzing, and on a desktop or
// in a simulator there is no haptic engine to notice with. So the bridge is
// RUN here, against a stub window, fed by the page's own `askShellRumble`,
// and what it posts goes through the shell's own parser: the whole trip from
// the page to the tap, with no device.
//
// No DOM: the window is an EventTarget and a postMessage that keeps a list.

import { describe, expect, it } from "vitest";

import { TUNING, type GameEvent } from "@engine";

import { RUMBLE_BRIDGE } from "../native/src/injected.ts";
import { RUMBLE_KIND, parseRumble, rumbleBurst } from "../native/src/rumble.ts";
import {
  ROLL_OVER,
  RUMBLE,
  createRunRumble,
  rumbleForChatter,
  rumbleForEvent,
  type Rumble,
} from "../pwa/src/game/rumble.ts";
import { SHELL_RUMBLE, askShellRumble } from "../pwa/src/shell-host.ts";

/** Run the injected bridge the way a WebView does — as a PROGRAM against a
 * `window` — with the page's own dispatch wired to the same bus, and hand
 * back every message it posted to the shell. */
function postedBy(asks: [ms: number, strength: number][]): string[] {
  const posted: string[] = [];
  const bus = new EventTarget();
  const window = {
    addEventListener: bus.addEventListener.bind(bus),
    ReactNativeWebView: { postMessage: (message: string) => posted.push(message) },
  };
  new Function("window", RUMBLE_BRIDGE)(window);
  const globals = globalThis as unknown as Record<string, unknown>;
  const before = globals.dispatchEvent;
  globals.dispatchEvent = bus.dispatchEvent.bind(bus);
  try {
    for (const [ms, strength] of asks) askShellRumble(ms, strength);
  } finally {
    if (before === undefined) delete globals.dispatchEvent;
    else globals.dispatchEvent = before;
  }
  return posted;
}

describe("the seam out to the phone", () => {
  it("the bridge listens for the event the page dispatches", () => {
    expect(RUMBLE_BRIDGE).toContain(SHELL_RUMBLE);
  });

  it("the bridge posts what the shell's parser reads", () => {
    expect(RUMBLE_BRIDGE).toContain(`sh: "${RUMBLE_KIND}"`);
  });

  it("carries a pulse from the page to the parser, all the way through", () => {
    const posted = postedBy([
      [70, 0.5],
      [260, 1],
    ]);
    expect(posted.map(parseRumble)).toEqual([
      { ms: 70, strength: 0.5 },
      { ms: 260, strength: 1 },
    ]);
  });

  it("drops everything that is not a rumble, rather than throwing", () => {
    for (const raw of [
      "",
      "{",
      "null",
      "[]",
      JSON.stringify({ sh: "something-else", ms: 100, strength: 0.5 }),
      JSON.stringify({ sh: RUMBLE_KIND, ms: "100", strength: 0.5 }),
      JSON.stringify({ sh: RUMBLE_KIND, ms: 0, strength: 0.5 }),
      JSON.stringify({ sh: RUMBLE_KIND, ms: Number.NaN, strength: 0.5 }),
      JSON.stringify({ sh: RUMBLE_KIND, ms: 100 }),
    ]) {
      expect(parseRumble(raw), raw).toBe(null);
    }
  });

  it("clamps a strength the page had no business sending", () => {
    expect(parseRumble(JSON.stringify({ sh: RUMBLE_KIND, ms: 50, strength: 4 }))?.strength).toBe(1);
    expect(parseRumble(JSON.stringify({ sh: RUMBLE_KIND, ms: 50, strength: -2 }))?.strength).toBe(
      0,
    );
  });

  it("spends a duration as a COUNT of taps, because a phone has no duration", () => {
    expect(rumbleBurst({ ms: 26, strength: 0.3 }).count).toBe(1);
    expect(rumbleBurst({ ms: 70, strength: 0.5 }).count).toBe(1);
    expect(rumbleBurst({ ms: 190, strength: 0.9 }).count).toBe(2);
    expect(rumbleBurst({ ms: 260, strength: 1 }).count).toBe(3);
    // …and never more, however long the page asks for.
    expect(rumbleBurst({ ms: 5000, strength: 1 }).count).toBe(3);
  });

  it("spends a strength as a STYLE, because that is the axis a phone has", () => {
    expect(rumbleBurst({ ms: 26, strength: 0.2 }).style).toBe("light");
    expect(rumbleBurst({ ms: 90, strength: 0.55 }).style).toBe("medium");
    expect(rumbleBurst({ ms: 200, strength: 0.95 }).style).toBe("heavy");
  });

  it("leaves the Taptic Engine time to re-arm between the taps in a burst", () => {
    // Under about 40 ms the second tap is simply dropped.
    expect(rumbleBurst({ ms: 260, strength: 1 }).gapMs).toBeGreaterThanOrEqual(40);
  });
});

// THE VIBRATION TABLE is the website's, not the shell's — what is felt and
// how big is `pwa/src/game/rumble.ts` (`rumbleForEvent`, and the one-motor
// ledger over it), and `pwa/src/game/haptics.ts` is the one
// `navigator.vibrate` that also calls `askShellRumble`. These are the table's
// own promises, read without a device.
describe("what an event is worth in the hands (pwa/src/game/rumble.ts)", () => {
  const land = (impact: number, harsh = false): GameEvent => ({
    kind: "land",
    t: 1,
    airTime: 1,
    impact,
    speed: 20,
    harsh,
    lost: harsh ? 0.1 : 0,
    g: 3,
    off: 0.1,
  });

  it("sizes a landing by how fast the skier was coming down", () => {
    const soft = rumbleForEvent(land(2))!;
    const hard = rumbleForEvent(land(10))!;
    expect(hard.ms).toBeGreaterThan(soft.ms);
    expect(hard.strength).toBeGreaterThan(soft.strength);
    // ...and one the legs could not take is a step harder again.
    expect(rumbleForEvent(land(10, true))!.strength).toBeGreaterThan(hard.strength);
  });

  it("sizes a tree by how fast the skier met it", () => {
    const brush = rumbleForEvent({ kind: "hit", t: 1, speed: 3, x: 0, z: 0 })!;
    const wreck = rumbleForEvent({ kind: "hit", t: 1, speed: 25, x: 0, z: 0 })!;
    expect(wreck.ms).toBeGreaterThan(brush.ms);
    expect(wreck.strength).toBeGreaterThan(brush.strength);
    expect(wreck.ms).toBeLessThan(RUMBLE.longest);
  });

  it("gives rolling over the whole of what the motor has, and nothing else reaches it", () => {
    expect(ROLL_OVER).toEqual({ ms: RUMBLE.longest, strength: 1 });
    const felt: Rumble[] = [];
    const rumble = createRunRumble((p) => felt.push(p));
    rumble.step(skierRead({ overFor: 0 }));
    rumble.step(skierRead({ overFor: 0.01 }));
    // Once per fall: still down is not a second fall.
    rumble.step(skierRead({ overFor: 0.5 }));
    expect(felt).toEqual([ROLL_OVER]);
    for (const e of [land(40, true), { kind: "hit", t: 1, speed: 99, x: 0, z: 0 } as GameEvent]) {
      const p = rumbleForEvent(e)!;
      expect(p.strength).toBeLessThan(1);
      expect(p.ms).toBeLessThan(RUMBLE.longest);
    }
  });

  it("gives a wipeout the whole motor, bogging down a shudder, and a hurt part nothing", () => {
    const off = rumbleForEvent({ kind: "wipeout", t: 1, cause: "nose", speed: 15, x: 0, z: 0 });
    expect(off).toEqual(ROLL_OVER);
    const stuck = rumbleForEvent({ kind: "stuck", t: 1 })!;
    expect(stuck.strength).toBeLessThan(rumbleForEvent(land(0))!.strength);
    expect(rumbleForEvent({ kind: "damage", t: 1, part: "legs", level: 0.4 })).toBe(null);
  });

  it("leaves the news (a run, a miss, a reset, the finish) to the HUD and the sound", () => {
    const news: GameEvent[] = [
      { kind: "lap", t: 1, lap: 1, time: 60 },
      { kind: "missed", t: 1, index: 3 },
      { kind: "reset", t: 1, checkpoint: 2, auto: false },
      { kind: "finish", t: 1, time: 180, place: 1 },
      { kind: "air", t: 1, vy: 4, speed: 20 },
      { kind: "count", t: 1, left: 2 },
    ];
    for (const e of news) expect(rumbleForEvent(e), e.kind).toBe(null);
    // A gate is the one piece of news that is felt — as the lightest
    // tick in the table, never enough to cover a blow.
    const tick = rumbleForEvent({ kind: "checkpoint", t: 1, index: 2, lap: 0, split: 30 })!;
    expect(tick).toEqual(RUMBLE.checkpoint);
    expect(tick.strength).toBeLessThan(rumbleForEvent(land(0))!.strength);
    expect(tick.strength).toBeLessThan(RUMBLE.chatterStrength[0] * 2);
  });

  it("never lets the chatter of a rough piste truncate the landing it comes down into", () => {
    const felt: Rumble[] = [];
    const rumble = createRunRumble((p) => felt.push(p));
    rumble.events([land(10, true)]);
    expect(felt.length).toBe(1);
    const landing = felt[0];
    // The piste hammering the skis for the whole of the landing's pulse —
    // and the legs' slam on it is the landing's own for a moment.
    let comp = 0.05;
    const steps = Math.floor((0.9 * landing.ms) / 1000 / TUNING.dt);
    for (let i = 0; i < steps; i++) {
      comp = comp === 0.05 ? 0.12 : 0.05;
      rumble.step(skierRead({ comp, landing: 0.5 }));
      if (i % 2 === 0) rumble.frame(TUNING.dt * 2);
    }
    // Nothing weaker than the landing may have cut in while it was running.
    const during = felt.slice(1);
    for (const p of during) expect(p.strength).toBeGreaterThan(landing.strength);
    // ...and once it is over the chatter IS felt, so the guard is the
    // ledger's and not a switch that went off.
    for (let i = 0; i < 60; i++) {
      comp = comp === 0.05 ? 0.12 : 0.05;
      rumble.step(skierRead({ comp, landing: 1 }));
      rumble.frame(TUNING.dt);
    }
    expect(felt.length).toBeGreaterThan(1);
    // A chatter pulse is the short kind.
    expect(felt[felt.length - 1].ms).toBe(RUMBLE.chatterMs);
  });

  it("feels no chatter off smooth snow, and none in the air", () => {
    expect(rumbleForChatter(skierRead({ comp: 0.05 }), 0.05)).toBe(null);
    expect(rumbleForChatter(skierRead({ comp: 0.12, airborne: true }), 0.05)).toBe(null);
    expect(rumbleForChatter(skierRead({ comp: 0.12 }), 0.05)).not.toBe(null);
  });
});

/** Just what the rumble reads off a skier — typed off the reader itself, so
 * the name the module gives that slice is its own to choose. */
type SkierRead = Parameters<typeof rumbleForChatter>[0];

function skierRead(o: {
  comp?: number;
  landing?: number;
  overFor?: number;
  airborne?: boolean;
}): SkierRead {
  const c = o.comp ?? 0.05;
  return {
    skiCompression: [c, c],
    landing: o.landing ?? 10,
    overFor: o.overFor ?? 0,
    airborne: o.airborne ?? false,
  };
}
