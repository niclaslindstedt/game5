// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE ON THE APP'S SIDE: the START row's PLANE stop
// (`free-ride.ts`), the links that name it and a skydive (`url-params.ts`),
// and its own key table (`settings-plane-keys.ts`) kept in the settings.

import { describe, expect, it } from "vitest";
import { SKIS, createGame } from "@engine";

import {
  PLANE_RUN,
  againAt,
  freeGameOptions,
  freshRide,
  planeOn,
} from "../pwa/src/game/free-ride.ts";
import { overLink, readParams } from "../pwa/src/game/url-params.ts";
import {
  DEFAULT_PLANE_KEYS,
  PLANE_KEY_ACTIONS,
  bindPlaneKey,
  freshPlaneKeys,
  mergePlaneKeys,
  planeClashesWith,
} from "../pwa/src/game/settings-plane-keys.ts";
import { mergeSettings } from "../pwa/src/game/settings.ts";
import { syntheticLevel } from "./support/synthetic.ts";

const skier = { spec: SKIS, assist: { yaw: 1, air: 1 } };

describe("the START row's PLANE stop", () => {
  it("stands the ride up in the plane's door, never by lift or at a spot", () => {
    const r = {
      ...freshRide(),
      run: { seed: 7, region: freshRide().region, id: PLANE_RUN },
      spot: { seed: 7, x: 100, z: 100 },
    };
    expect(planeOn(r, 7)).toBe(true);
    expect(planeOn(r, 8)).toBe(false);
    const options = freeGameOptions(r, 7, skier);
    expect(options.plane).toBe(true);
    expect(options.byLift).toBe(false);
    expect(options.spawn).toBeUndefined();
    expect(options.heli).toBeFalsy();
    expect(options.sled).toBeFalsy();
  });

  it("starts a plane ride again on the strip", () => {
    const s = createGame({
      level: syntheticLevel(),
      mode: "free",
      plane: true,
      crowd: 0,
      quiet: true,
    });
    expect(againAt(s.rules, { plane: true })).toBe("strip");
  });
});

describe("the links", () => {
  it("reads ?plane=1 and ?chute=<m>, the height held to its band", () => {
    expect(readParams("?start=free&plane=1").plane).toBe(true);
    expect(readParams("?start=free").plane).toBe(false);
    expect(readParams("?start=free").chute).toBeNull();
    expect(readParams("?start=free&chute=1500").chute).toBe(1500);
    expect(readParams("?start=free&chute=5").chute).toBe(30);
    expect(readParams("?start=free&chute=90000").chute).toBe(6000);
    expect(readParams("?start=free&chute=abc").chute).toBeNull();
  });

  it("lays the plane over the card's start, whatever machine it picked", () => {
    const card = { heli: true, byLift: true };
    const plane = overLink(card, readParams("?start=free&plane=1"));
    expect(plane.plane).toBe(true);
    expect(plane.heli).toBe(false);
    expect(plane.byLift).toBe(false);
    const chute = overLink(card, readParams("?start=free&chute=1200"));
    expect(chute.plane).toBe(true);
    expect(chute.chute).toBe(1200);
    expect(chute.heli).toBe(false);
    // A link naming nothing leaves the card's own.
    const none = overLink(card, readParams("?start=free"));
    expect(none.heli).toBe(true);
    expect(none.plane).toBe(false);
  });
});

describe("the plane's key table", () => {
  it("has a row for every action and no code on two of them", () => {
    const keys = freshPlaneKeys();
    expect(PLANE_KEY_ACTIONS.map((a) => a.id).sort()).toEqual(
      Object.keys(DEFAULT_PLANE_KEYS).sort(),
    );
    for (const { id, label } of PLANE_KEY_ACTIONS) {
      expect(label.length).toBeGreaterThan(0);
      expect(planeClashesWith(keys, id)).toEqual([]);
    }
  });

  it("rebinds a row and names the clash it makes", () => {
    const keys = bindPlaneKey(freshPlaneKeys(), "flapsDown", "KeyW");
    expect(keys.flapsDown).toEqual(["KeyW"]);
    expect(planeClashesWith(keys, "flapsDown")).toEqual(["stickForward"]);
    // The shipped table is untouched.
    expect(DEFAULT_PLANE_KEYS.flapsDown).toEqual(["KeyF"]);
  });

  it("merges a stored blob row by row and survives garbage", () => {
    expect(mergePlaneKeys(null)).toEqual(freshPlaneKeys());
    const m = mergePlaneKeys({ brake: ["KeyB", "KeyB", 3], gone: ["KeyX"], stickBack: "KeyS" });
    expect(m.brake).toEqual(["KeyB"]);
    expect(m.stickBack).toEqual(DEFAULT_PLANE_KEYS.stickBack);
    expect("gone" in m).toBe(false);
  });

  it("is kept in the settings", () => {
    const s = mergeSettings({ planeKeys: { throttleUp: ["KeyT"] } });
    expect(s.planeKeys.throttleUp).toEqual(["KeyT"]);
    expect(s.planeKeys.brake).toEqual(DEFAULT_PLANE_KEYS.brake);
  });
});
