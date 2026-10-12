// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WINGSUIT ON THE APP'S SIDE: the START row's WINGSUIT stop — its own
// thing, never worn up a craft from the cards (`free-ride.ts`), the links (`url-params.ts`), where a dead flyer's next
// rider stands (`againAt`), its HUD strip (`plane-hud.ts`'s `chuteOf`), its
// news (`run-news.ts`) and its voice (`chute-bed.ts`, `chute-voice.ts`).

import { describe, expect, it } from "vitest";
import { SKIS, createGame, skydiveAt, step, NEUTRAL_INPUT, WINGSUIT } from "@engine";

import {
  BALLOON_RUN,
  HELI_RUN,
  PLANE_RUN,
  WINGSUIT_RUN,
  againAt,
  freeGameOptions,
  freshRide,
  mergeRide,
  type FreeRide,
} from "../pwa/src/game/free-ride.ts";
import { overLink, readParams } from "../pwa/src/game/url-params.ts";
import { chuteOf } from "../pwa/src/game/plane-hud.ts";
import { chuteVoiceOf } from "../pwa/src/game/audio/chute-bed.ts";
import { chuteTargets } from "../pwa/src/game/audio/chute-voice.ts";
import { flatLevel } from "./support/synthetic.ts";

const skier = { spec: SKIS, assist: { yaw: 1, air: 1 } };
const on = (id: string, o: Partial<FreeRide> = {}): FreeRide => ({
  ...freshRide(),
  run: { seed: 7, region: freshRide().region, id },
  ...o,
});

describe("the START row's WINGSUIT stop", () => {
  it("stands the ride up in the wingsuit on its own exit, never by lift", () => {
    const o = freeGameOptions(on(WINGSUIT_RUN), 7, skier);
    expect(o.wingsuit).toBe(true);
    expect(o.byLift).toBe(false);
    expect(o.plane || o.heli || o.para || o.balloon).toBeFalsy();
  });

  it("never puts him in the suit up a craft: the aircraft jump in the parachute", () => {
    for (const id of [HELI_RUN, BALLOON_RUN, PLANE_RUN]) {
      expect(freeGameOptions(on(id), 7, skier).wingsuit).toBeUndefined();
      // A blob from when the cards asked a SUIT row is read without it.
      const old = mergeRide({ ...on(id), suit: "wingsuit" } as never);
      expect("suit" in old).toBe(false);
      expect(freeGameOptions(old, 7, skier).wingsuit).toBeUndefined();
    }
  });

  it("stands the next rider on the exit when a flyer dies there", () => {
    const s = createGame({ level: flatLevel(), mode: "free", quiet: true });
    expect(againAt(s.rules, { wingsuit: true })).toBe("exit");
    expect(againAt(s.rules, { wingsuit: true, balloon: true })).toBe("basket");
  });
});

describe("the links", () => {
  it("reads ?wingsuit=1 as its own start and ?suit= over the card's craft", () => {
    expect(readParams("?start=free&wingsuit=1").wingsuit).toBe(true);
    expect(readParams("?start=free&suit=wing").suit).toBe("wing");
    expect(readParams("?start=free&suit=rig").suit).toBe("rig");
    expect(readParams("?start=free&suit=x").suit).toBeNull();
    const card = { heli: true, byLift: false };
    const own = overLink(card, readParams("?start=free&wingsuit=1"));
    expect(own.wingsuit).toBe(true);
    expect(own.heli).toBe(false);
    const up = overLink(card, readParams("?start=free&suit=wing"));
    expect(up.wingsuit).toBe(true);
    expect(up.heli).toBe(true);
    const rig = overLink({ ...card, wingsuit: true }, readParams("?start=free&suit=rig"));
    expect(rig.wingsuit).toBe(false);
  });
});

describe("the HUD, the news and the voice in the suit", () => {
  const SIZE = 8000;
  const flying = (agl: number) => {
    const s = createGame({
      level: flatLevel({ size: SIZE }),
      mode: "free",
      plane: true,
      wingsuit: true,
      quiet: true,
    });
    skydiveAt(s, { x: SIZE / 2, z: 1500, agl, suit: "wingsuit" });
    for (let i = 0; i < 240; i++) step(s, NEUTRAL_INPUT);
    return s;
  };

  it("reads the glide, the air, the sink and the press to PULL", () => {
    const hud = chuteOf(flying(2000))!;
    expect(hud.suit).not.toBeNull();
    expect(hud.press).toBe("open");
    expect(hud.suit!.glide).toBeGreaterThan(2.5);
    expect(hud.suit!.air * 3.6).toBeGreaterThan(120);
    expect(hud.suit!.sink).toBeGreaterThan(5);
    expect(hud.suit!.warn).toBe(false);
    expect(hud.pull).toBe(false);
  });

  it("warns as the height closes on the pull, and lights PULL! at it", () => {
    const warn = chuteOf(flying(WINGSUIT.bot.slow - 40))!;
    expect(warn.suit!.warn).toBe(true);
    const low = chuteOf(flying(WINGSUIT.bot.open - 40))!;
    expect(low.suit!.low).toBe(true);
    expect(low.pull).toBe(true);
  });

  it("calls the jump on the exit", () => {
    const s = createGame({
      level: flatLevel({ size: SIZE }),
      mode: "free",
      wingsuit: true,
      quiet: true,
    });
    const hud = chuteOf(s)!;
    expect(hud.mode).toBe("ready");
    expect(hud.press).toBe("jump");
  });

  it("is heard: the suit's low flutter rises with the air, and none in the box", () => {
    const s = flying(2000);
    const voice = chuteVoiceOf(s)!;
    expect(voice.suit).toBeGreaterThan(0.9);
    const mix = { wind: 1, machine: 1 };
    const slow = chuteTargets({ ...voice, airspeed: 35 }, mix).suit;
    const fast = chuteTargets({ ...voice, airspeed: 70 }, mix).suit;
    expect(fast.level).toBeGreaterThan(slow.level);
    expect(fast.cutoff).toBeLessThanOrEqual(80);
    expect(slow.cutoff).toBeGreaterThanOrEqual(20);
    expect(chuteTargets({ ...voice, suit: 0 }, mix).suit.level).toBe(0);
  });
});
