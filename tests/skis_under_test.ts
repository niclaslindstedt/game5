// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIS NEVER UNDER THE DRAWN SNOW. The drawn snow is the engine's
// ground with a hand of loose cover over it off the groomer (`LOOSE`) and
// the furrow cut out of it; the skis ride the ground less their sink. Held
// here from both sides of the seam:
//
//   * every furrow a touching ski cuts reaches down to the base it rides on
//     (`drawnDepth` never shallower than the sink plus the cover), on every
//     kind of snow, at a crawl and at 130 km/h, straight and carving — so
//     the figure is never RAISED out of its furrow to be seen (`rideSink`
//     never negative); and
//   * the ground's vertex stage lets the mesh down under the player's own
//     drawn bases (`ski-clear.ts`), whatever the grid's spacing — read off
//     the posed meshes themselves.
//
// The picture's own measure is the snow eval lab's chase lens
// (`make snow-eval ARGS=--under=all`), at every TERRAIN, RESOLUTION and
// TRAILS stop.

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { createGame, pairById, placeRun, step, TUNING, type Level, type SkierState } from "@engine";

import { holdInput, type HoldMove } from "../pwa/src/game/hold-input.ts";
import { rideSink } from "../pwa/src/game/ride-sink.ts";
import {
  createSkiClear,
  SKI_CLEAR_GLSL,
  SKI_LINES,
  SKI_POINTS,
  skiClearUniforms,
} from "../pwa/src/game/ski-clear.ts";
import { SNOW_VERTEX_PLACE } from "../pwa/src/game/snow-glsl.ts";
import { SNOW, type SnowKind } from "../pwa/src/game/snowpack.ts";
import { drawnDepth, LOOSE, TRAIL } from "../pwa/src/game/trail-stamp.ts";
import { flatLevel } from "./support/synthetic.ts";

const KINDS: SnowKind[] = ["groomed", "hard", "ice", "wet", "soft", "new"];
const RIDES: { kmh: number; move: HoldMove }[] = [
  { kmh: 15, move: "straight" },
  { kmh: 50, move: "carve" },
  { kmh: 130, move: "straight" },
];

/** Ride `level` and hand each step's skier to `look`. */
function ride(
  level: Level,
  kmh: number,
  move: HoldMove,
  depth: number,
  look: (s: SkierState) => void,
) {
  const state = createGame({
    level,
    spec: pairById("chamois"),
    rivals: 0,
    countdown: 0,
    quiet: true,
    snowDepth: depth,
  });
  placeRun(state, { x: 1500, z: 200, heading: 0, speed: kmh / 3.6 });
  const t0 = state.t;
  for (let i = 0; i < 1.5 * TUNING.physicsHz; i++) {
    step(state, holdInput(state, kmh, 0, move, state.t - t0));
    look(state.skier);
  }
}

describe("the skis never under the drawn snow", () => {
  it("cuts every furrow down to the base the ski rides on, on every snow", () => {
    let seen = 0;
    for (const packed of [0, 0.5, 1]) {
      const level = flatLevel({ packed, grade: 0.25 });
      for (const kind of KINDS) {
        for (const depth of [1, 2.5]) {
          for (const { kmh, move } of RIDES) {
            ride(level, kmh, move, depth, (s) => {
              for (const c of s.contacts) {
                if (!c.touching) continue;
                const p = level.packedAt(c.x, c.z);
                const d = drawnDepth(c, p, 1, depth, SNOW[kind]);
                const floor = c.sink + LOOSE * (1 - p);
                expect(d).toBeGreaterThanOrEqual(Math.min(TRAIL.maxDepth, floor) - 1e-9);
                seen++;
              }
              // The figure is let down into a furrow, never lifted out of one.
              expect(rideSink(s, level, depth, true, () => SNOW[kind])).toBeGreaterThanOrEqual(
                -1e-9,
              );
            });
          }
        }
      }
    }
    expect(seen).toBeGreaterThan(10000);
  });

  it("lets the ground's mesh down under the player's skis, after the surface is summed", () => {
    const at = (needle: string) => SNOW_VERTEX_PLACE.indexOf(needle);
    expect(at("skiClear(snowXZ, snowY, uSpacing)")).toBeGreaterThan(at("slideAt(snowXZ)"));
    // ...and before the finer level's hole sinks what it covers.
    expect(at("skiClear(snowXZ, snowY, uSpacing)")).toBeLessThan(at("if (uHole.w > 0.5)"));
    expect(SKI_CLEAR_GLSL).toContain(`uSkiLine[${SKI_LINES * SKI_POINTS}]`);
  });

  it("reads each drawn base's line off its posed mesh, tip to tail", () => {
    // A ski 1.7 m long and 8 cm wide, its base 3 cm under its mesh's origin,
    // stood at (10, 2, 5) and turned a quarter round.
    const figure = new THREE.Group();
    const geometry = new THREE.BoxGeometry(0.08, 0.02, 1.7, 1, 1, 68);
    geometry.translate(0, -0.02, 0);
    const skis = [new THREE.Mesh(geometry), new THREE.Mesh(geometry)];
    skis[0].position.set(10, 2, 5);
    skis[1].position.set(10.2, 2.1, 5);
    for (const s of skis) {
      s.rotation.y = Math.PI / 2;
      s.visible = false; // folded into a merged draw, as the figure's are
      figure.add(s);
    }
    const uniforms = skiClearUniforms();
    const clear = createSkiClear(uniforms);
    clear.update(skis, true);
    // Riding: let down and grooved; stood still, let down alone.
    expect(uniforms.uSkiClear.value).toBe(2);
    clear.update(skis, true, false);
    expect(uniforms.uSkiClear.value).toBe(1);
    const line = uniforms.uSkiLine.value;
    for (let k = 0; k < SKI_POINTS; k++) {
      expect(line[k].y).toBeCloseTo(1.97, 4);
      expect(line[k].z).toBeCloseTo(5, 4);
      expect(line[k].w).toBeCloseTo(0.04, 4);
      expect(line[SKI_POINTS + k].y).toBeCloseTo(2.07, 4);
    }
    // Tip to tail along the turned ski, 1.7 m end to end less the stations'
    // insets.
    expect(Math.abs(line[0].x - line[SKI_POINTS - 1].x)).toBeGreaterThan(1.5);
    // A hidden figure, or none: nothing let down.
    figure.visible = false;
    clear.update(skis, true);
    expect(uniforms.uSkiClear.value).toBe(0);
    for (const v of line) expect(v.w).toBeLessThan(0);
  });
});
