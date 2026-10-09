// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROOMS AS DRAWN — the furnished ground floor of every building near
// the lens (`interior-build.ts`): built into one geometry of the painted
// materials for the buildings within `NEAR` metres, rebuilt only when that
// set changes (a few metres of hysteresis, so a lens on the line does not
// churn it). A room is closed in its building's walls, so nobody sees one
// from outside; it is there for whoever is let in through a door.
//
// THE LIGHT INSIDE: no sun reaches a room (its direct light is dropped in
// the shader — the outer walls are one-sided and cast no trustworthy
// shadow), so a room is lit by the sky's fill and by its OWN LIGHT, a warm term every face
// takes (`ROOM_LIGHT`), stronger after dark; a lamp's shade glows (mark 1)
// and a pane shows the day outside, the sky's horizon colour by day and a
// night blue after dark (mark 2).

import * as THREE from "three";

import { CABINS, cabinsOf, isResortBuilding, type Cabin, type Level } from "@engine";

import { planHoles } from "./cabin-shapes.ts";
import { FacadeKit } from "./facade-kit.ts";
import { graftFacade, holdFacades } from "./facade-material.ts";
import { facadeGeometry } from "./facade-mesh.ts";
import { PAST_THE_WALL, hazeMaterial, type HazeUniforms } from "./haze.ts";
import { buildRoom, hasRoom, insetHoles } from "./interior-build.ts";
import type { Hole } from "./interior-plan.ts";
import { LUX_TO_LAMP } from "./piste-lights.ts";
import { setRoomCuts } from "./room-cuts.ts";

/** How near a building's middle must be to the lens for its room to be
 * built, m, and the band either side of it it keeps what it has. */
const NEAR = 45;
const HYSTERESIS = 8;

/** The room's own light: the share of its albedo lit by day and after
 * dark; a lamp's shade by day and after dark; a pane's daylight. */
const ROOM_LIGHT = { day: 0.45, night: 0.6, lampDay: 0.9, lampNight: 2.2, pane: 0.65 };

/** The rooms' material: the painted stack, the haze, and the room's own
 * light in place of the panes' night glow. */
function roomMaterial(haze: HazeUniforms): THREE.MeshStandardMaterial {
  const held = holdFacades();
  const m = hazeMaterial(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }),
    haze,
    "interiors",
    (shader) => {
      PAST_THE_WALL(shader);
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nattribute float glow;\nvarying float vGlow;",
        )
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGlow = glow;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vGlow;")
        // The sun never reaches inside: the outer shell is one-sided, so
        // its shadow cannot be trusted to hold it out.
        .replace(
          "#include <lights_fragment_end>",
          "#include <lights_fragment_end>\n  reflectedLight.directDiffuse *= 0.0;\n  reflectedLight.directSpecular *= 0.0;",
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
  float roomNight = clamp(uPisteOn.x / ${LUX_TO_LAMP.toFixed(6)}, 0.0, 1.0);
  float roomLamp = step(0.5, vGlow) * step(vGlow, 1.5);
  float roomPane = step(1.5, vGlow);
  vec3 roomWarm = vec3(1.0, 0.86, 0.68);
  totalEmissiveRadiance += (1.0 - roomPane) * diffuseColor.rgb * roomWarm * mix(${ROOM_LIGHT.day.toFixed(2)}, ${ROOM_LIGHT.night.toFixed(2)}, roomNight);
  totalEmissiveRadiance += roomLamp * diffuseColor.rgb * mix(${ROOM_LIGHT.lampDay.toFixed(2)}, ${ROOM_LIGHT.lampNight.toFixed(2)}, roomNight);
  vec3 roomDay = mix(uHorizon, uZenith, 0.35) * ${ROOM_LIGHT.pane.toFixed(2)};
  totalEmissiveRadiance += roomPane * facadeLit * mix(roomDay, vec3(0.01, 0.015, 0.035), roomNight);`,
        );
      graftFacade(shader);
    },
  );
  m.addEventListener("dispose", () => held.release());
  return m;
}

/** A building's openings in its frame: off its own drawing for the ski
 * area's, off the plan for a log building's. */
export function holesOf(level: Level, c: Cabin): Hole[] {
  if (isResortBuilding(c.kind)) return insetHoles(level, c);
  return planHoles(c.kind).map((h) => ({
    face: h.wall,
    u: h.u,
    w: h.w,
    y0: h.y0,
    y1: h.y1,
    door: h.door === true,
  }));
}

/** Build the rooms of `list` into one geometry. */
export function roomsGeometry(
  level: Level,
  list: readonly Cabin[],
  holes = new Map<string, Hole[]>(),
): THREE.BufferGeometry {
  const kit = new FacadeKit();
  for (const c of list) {
    let h = holes.get(c.id);
    if (!h) {
      h = holesOf(level, c);
      holes.set(c.id, h);
    }
    buildRoom(kit, c, h);
  }
  return facadeGeometry(kit.out);
}

export type Interiors = {
  group: THREE.Group;
  /** Build the rooms near a lens at `eye`. */
  update(eye: THREE.Vector3): void;
  dispose(): void;
};

export function createInteriors(level: Level, haze: HazeUniforms): Interiors {
  const group = new THREE.Group();
  group.name = "interiors";
  const rooms = cabinsOf(level).filter((c) => hasRoom(c.kind));
  const near = new Uint8Array(rooms.length);
  const holes = new Map<string, Hole[]>();
  const material = roomMaterial(haze);
  let mesh: THREE.Mesh | null = null;
  const clear = () => {
    if (!mesh) return;
    group.remove(mesh);
    mesh.geometry.dispose();
    mesh = null;
  };
  return {
    group,
    update(eye) {
      let moved = false;
      rooms.forEach((c, i) => {
        const d = Math.hypot(c.x - eye.x, c.z - eye.z, c.y - eye.y);
        const now = near[i] ? d < NEAR + HYSTERESIS : d < NEAR - HYSTERESIS;
        if (now !== (near[i] === 1)) moved = true;
        near[i] = now ? 1 : 0;
      });
      const list = rooms.filter((_, i) => near[i]);
      // The ground kept out of the nearest of them, every frame.
      setRoomCuts(
        list
          .map((c) => ({ c, d: Math.hypot(c.x - eye.x, c.z - eye.z) }))
          .sort((a, b) => a.d - b.d)
          .map(({ c }) => ({
            x: c.x,
            z: c.z,
            heading: c.heading,
            hw: CABINS[c.kind].width / 2,
            hd: CABINS[c.kind].depth / 2,
          })),
      );
      if (!moved) return;
      clear();
      if (list.length === 0) return;
      mesh = new THREE.Mesh(roomsGeometry(level, list, holes), material);
      mesh.receiveShadow = false;
      mesh.castShadow = false;
      group.add(mesh);
    },
    dispose() {
      clear();
      setRoomCuts([]);
      material.dispose();
    },
  };
}
