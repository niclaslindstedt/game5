// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKY'S CLOCK: the sun and the moon run on with the run's own clock at
// twelve times real time (`engine/game/clock.ts`'s `SKY_CLOCK`, `skyHourAt`),
// the app's rate (`pwa/src/game/sky-clock.ts`, `?skyclock=`), every reader
// of the hour reading the one moving hour — and nothing the physics or a
// create-time decision reads moving with it.

import { afterEach, describe, expect, it } from "vitest";

import {
  SKY_CLOCK,
  botInput,
  createGame,
  moonAtRun,
  skyHourAt,
  skyLevelAt,
  step,
  sunAtRun,
  withSky,
} from "@engine";

import { activityAt } from "../pwa/src/game/bird-plan.ts";
import { civilianHour } from "../pwa/src/game/civilian-plan.ts";
import { reproOf, reproQuery } from "../pwa/src/game/debug-readout.ts";
import { KEY_STEP, steadyKey } from "../pwa/src/game/shadow-box.ts";
import { keyAheadAt, skyLookAt } from "../pwa/src/game/sky.ts";
import { setSkyClock, skyClock, skyHourNow, sunNow } from "../pwa/src/game/sky-clock.ts";
import { readParams } from "../pwa/src/game/url-params.ts";
import { syntheticLevel } from "./support/synthetic.ts";

const level = syntheticLevel();

afterEach(() => setSkyClock(0));

describe("the sky's clock (clock.ts, sky-clock.ts)", () => {
  it("runs five real minutes to an hour of sun", () => {
    expect(SKY_CLOCK.rate).toBe(12);
    expect(skyHourAt(level, 300)).toBeCloseTo(level.sun.hour + 1, 9);
    expect(skyHourAt(level, 300, 0)).toBe(level.sun.hour);
    const later = skyLevelAt(level, 600);
    expect(later.sun.hour).toBeCloseTo(level.sun.hour + 2, 9);
    expect(skyLevelAt(level, 0)).toBe(level);
  });

  it("leaves the start hour's sun to everything that does not name a time", () => {
    // What every create-time decision reads (the night crowd, the piste
    // machines, the snow guns): the map's start hour, whatever the clock.
    expect(sunAtRun(level)).toEqual(sunAtRun(level, 0));
    expect(moonAtRun(level)).toEqual(moonAtRun(level, 0));
    const hourOn = withSky(level, { hour: level.sun.hour + 1 });
    expect(sunAtRun(level, 300).elevation).toBeCloseTo(sunAtRun(hourOn).elevation, 9);
    expect(sunAtRun(level, 300).azimuth).toBeCloseTo(sunAtRun(hourOn).azimuth, 9);
  });

  it("sets the sun through the evening and runs on past midnight", () => {
    const evening = withSky(level, { hour: 15 });
    const at = (t: number) => sunAtRun(evening, t).elevation;
    // Down through the afternoon, a smooth sweep a run second at a time.
    let was = at(0);
    for (let t = 1; t <= 1800; t++) {
      const now = at(t);
      expect(now).toBeLessThan(was);
      expect(Math.abs(now - was)).toBeLessThan(0.002); // the refraction steepens it at the horizon
      was = now;
    }
    // Past midnight the ephemeris reads the next morning: no jump at 24 h.
    const late = withSky(level, { hour: 23.9 });
    const before = sunAtRun(late, 0).elevation;
    const after = sunAtRun(late, 60).elevation; // 24.1 h
    expect(Math.abs(after - before)).toBeLessThan(0.01);
  });

  it("is held by the app until it is started, and read by every reader", () => {
    expect(skyClock()).toBe(0);
    expect(skyHourNow(level, 600)).toBe(level.sun.hour);
    expect(skyLookAt(level, 600).key).toEqual(skyLookAt(level, 0).key);
    expect(keyAheadAt(level, 0)).toBeNull();
    setSkyClock(SKY_CLOCK.rate);
    expect(skyHourNow(level, 600)).toBeCloseTo(level.sun.hour + 2, 9);
    expect(sunNow(level, 600).elevation).toBeCloseTo(sunAtRun(level, 600).elevation, 12);
    expect(skyLookAt(level, 600).key).not.toEqual(skyLookAt(level, 0).key);
    expect(keyAheadAt(level, 0)).toEqual(skyLookAt(level, 10).key);
    // The people on foot, the birds: the moving hour.
    const dusk = withSky(level, { hour: 16 });
    expect(civilianHour(dusk, 1500)).toBeCloseTo(21, 6);
    expect(activityAt(dusk, 0)).toBeGreaterThan(activityAt(dusk, 1500));
    // A negative or broken rate holds it.
    setSkyClock(-3);
    expect(skyClock()).toBe(0);
    setSkyClock(Number.NaN);
    expect(skyClock()).toBe(0);
  });

  it("is read off a link: held by an hour, set by ?skyclock=", () => {
    expect(readParams("").skyClock).toBe(SKY_CLOCK.rate);
    expect(readParams("?hour=17").skyClock).toBe(0);
    expect(readParams("?hour=17&skyclock=60").skyClock).toBe(60);
    expect(readParams("?skyclock=0").skyClock).toBe(0);
    expect(readParams("?skyclock=fast").skyClock).toBe(SKY_CLOCK.rate);
  });

  it("reads the air's knob off a link (?temp=), alone or with a sky", () => {
    expect(readParams("?temp=-12").sky).toEqual({ temp: -12 });
    expect(readParams("?weather=snow&temp=2").sky).toEqual({ weather: "snow", temp: 2 });
    expect(readParams("?temp=warm").sky).toBe(null);
    expect(readParams("?temp=90").sky).toBe(null);
  });

  it("puts the air's knob in a repro where the run had one", () => {
    const state = createGame({ seed: 3, sky: { temp: -7 }, quiet: true });
    expect(readParams(reproQuery(reproOf(state, "free", "chase"))).sky?.temp).toBe(-7);
  });

  it("puts the clock in a repro, so the link stands the frame under its sky", () => {
    setSkyClock(SKY_CLOCK.rate);
    const state = createGame({ seed: 3, quiet: true });
    const q = readParams(reproQuery(reproOf(state, "free", "chase")));
    expect(q.skyClock).toBe(SKY_CLOCK.rate);
    expect(q.sky?.hour).toBeCloseTo(state.level.sun.hour, 1);
  });

  it("shows a replay the same sky: it is a function of the run's own clock", () => {
    setSkyClock(SKY_CLOCK.rate);
    const ski = () => {
      const s = createGame({ seed: 5, quiet: true });
      for (let i = 0; i < 600; i++) step(s, botInput(s));
      return s;
    };
    const a = ski();
    const b = ski();
    expect(b.t).toBe(a.t);
    expect(skyLookAt(b.level, b.t)).toEqual(skyLookAt(a.level, a.t));
  });

  it("steps the shadow box's key so its frame stands between steps", () => {
    const out = { x: 0, y: 0, z: 0 };
    const key = (b: number, e: number) => ({
      x: Math.sin(b) * Math.cos(e),
      y: Math.sin(e),
      z: Math.cos(b) * Math.cos(e),
    });
    const a = { ...steadyKey(key(1, 0.3), out) };
    // A sun turned a fraction of a step stands where it stood…
    expect(steadyKey(key(1 + KEY_STEP * 0.2, 0.3 + KEY_STEP * 0.2), out)).toEqual(a);
    // …and one a step on moves a step, never more.
    const b = { ...steadyKey(key(1 + KEY_STEP, 0.3), out) };
    const turned = Math.acos(a.x * b.x + a.y * b.y + a.z * b.z);
    expect(turned).toBeGreaterThan(KEY_STEP * 0.5);
    expect(turned).toBeLessThan(KEY_STEP * 1.5);
    // Kept a hair over the horizon, a unit vector.
    const low = steadyKey(key(2, -0.2), out);
    expect(low.y).toBeGreaterThan(0.015);
    expect(Math.hypot(low.x, low.y, low.z)).toBeCloseTo(1, 9);
  });
});
