// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S PARAMOTORS AND BALLOONS AS DRAWN (`engine/game/army-air.ts`):
// each one the free ride's own drawing hung off the army's craft instead of
// the player's — the paramotor's (`para-scene.ts`) in the army's olive wing
// (`ARMY_CANOPY_PAINT`) with a soldier sat in its harness, his rifle in his
// lap; the balloon's (`balloon-scene.ts`) in the army's olive and khaki
// gores (`ARMY_COLOURWAY`) with its rocketeers stood in the basket, each
// turned to his aim and the launcher up on his shoulder as he fires, and a
// man at the burner. Brought down, a paramotor's soldier comes down under a
// round reserve, or under the cloth.
//
// BUILT AT LOAD, all of it, on every run whose rules can raise the hunt (the
// free ride): a fixed pool of as many as the hunt ever flies at once
// (`ARMY_AIR.grow`), shown and hidden — never a mesh, a material or a light
// built mid-run, and every program compiled with the rest of the scene
// behind the loading card (three compiles a hidden mesh's material too,
// `scene-compile.ts`). No light is added: the burner's
// is a slot of the floods (`headlamp.ts`), like the free ride's balloon's.
// Presentation only: it reads the state and writes nothing.

import * as THREE from "three";
import {
  ARMY_AIR,
  armyBalloons,
  armyParas,
  type ArmyBalloon,
  type ArmyPara,
  type GameState,
} from "@engine";

import { ARMY_COLOURWAY } from "./balloon-look.ts";
import { createBalloonScene, type BalloonScene } from "./balloon-scene.ts";
import type { HazeUniforms } from "./haze.ts";
import type { Flood } from "./headlamp.ts";
import { ARMY_CANOPY_PAINT } from "./para-canopy.ts";
import { createParaScene, type ParaScene } from "./para-scene.ts";
import type { SkyLook } from "./sky.ts";
import { SoldierView, soldierMaterial } from "./soldier-shapes.ts";

/** HOW IT READS: how far under the pilot's point the seated soldier's
 * frame is, m (his hips at the hang); the rocketeers' places on the basket's
 * floor (its frame: x right, z forward), m, and the burner man's; how long
 * a rocketeer keeps the launcher up after a shot, s; the reserve's size,
 * m, its line, m, and its colour. */
export const CRAFT_LOOK = {
  seat: 0.12,
  crew: [
    { x: 0.32, z: 0.42 },
    { x: -0.32, z: 0.42 },
    { x: 0.32, z: -0.1 },
    { x: -0.32, z: -0.1 },
  ],
  burnerMan: { x: 0, z: -0.55 },
  shouldered: 2.5,
  reserve: { radius: 3.4, line: 5.5, rgb: [0.42, 0.44, 0.34] as const },
} as const;

type ParaSlot = {
  scene: ParaScene;
  pilot: SoldierView;
  reserve: THREE.Mesh;
  id: number;
  /** The engine-shaped stand-in the scene is handed (`frame`). */
  view: {
    para: ArmyPara["wing"] | null;
    skier: { x: number; y: number; z: number; q: { x: number; y: number; z: number; w: number } };
    tick: number;
    t: number;
    level: GameState["level"];
  };
};

type BalloonSlot = {
  scene: BalloonScene;
  crew: SoldierView[];
  burnerMan: SoldierView;
  id: number;
  view: {
    balloon: ArmyBalloon["body"] | null;
    skier: GameState["skier"];
    wingsuit: null;
    tick: number;
    t: number;
    level: GameState["level"];
  };
};

export type ArmyCraftView = {
  group: THREE.Group;
  /** Draw `state`'s paramotors and balloons, `alpha` of the way to the next
   * step, `dt` s of the picture on. */
  frame(state: GameState, alpha: number, dt: number): void;
  /** The sky's light on the lines and the cloth. */
  light(look: SkyLook): void;
  /** The balloons' burners and fires, as floods (`headlamp.ts`). */
  lamps(eye: THREE.Vector3, out: Flood[]): void;
  /** Whether any is drawn: the ear's and a lab's. */
  any(): boolean;
  dispose(): void;
};

/** A ROUND RESERVE: a shallow dome in the army's colour, its lines drawn
 * as a cone down to the man. */
function reserveMesh(material: THREE.Material): THREE.Mesh {
  const R = CRAFT_LOOK.reserve;
  const geo = new THREE.SphereGeometry(R.radius, 12, 4, 0, Math.PI * 2, 0, Math.PI * 0.42);
  geo.scale(1, 0.55, 1);
  geo.translate(0, R.line, 0);
  const n = geo.getAttribute("position").count;
  const rgb = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) rgb.set(R.rgb, i * 3);
  geo.setAttribute("color", new THREE.BufferAttribute(rgb, 3));
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  return m;
}

const yawQ = (h: number, out: { x: number; y: number; z: number; w: number }) => {
  out.x = 0;
  out.y = Math.sin(h / 2);
  out.z = 0;
  out.w = Math.cos(h / 2);
  return out;
};

export function createArmyCraftView(haze: HazeUniforms, state: GameState): ArmyCraftView {
  const group = new THREE.Group();
  group.name = "army-craft";
  const material = soldierMaterial(haze);
  const paras: ParaSlot[] = [];
  const balloons: BalloonSlot[] = [];
  const level = state.level;
  for (let i = 0; i < ARMY_AIR.grow.paramotors; i++) {
    const scene = createParaScene(haze, ARMY_CANOPY_PAINT);
    const pilot = new SoldierView("foot", "near", material);
    pilot.pose("doorSit");
    const reserve = reserveMesh(material);
    reserve.visible = false;
    group.add(scene.group, pilot.mesh, reserve);
    paras.push({
      scene,
      pilot,
      reserve,
      id: -1,
      view: {
        para: null,
        skier: { x: 0, y: 0, z: 0, q: { x: 0, y: 0, z: 0, w: 1 } },
        tick: 0,
        t: 0,
        level,
      },
    });
  }
  for (let i = 0; i < ARMY_AIR.grow.balloons; i++) {
    const scene = createBalloonScene(haze, ARMY_COLOURWAY);
    const crew = CRAFT_LOOK.crew.map((at) => {
      const s = new SoldierView("rocketeer", "near", material);
      s.pose("carry");
      s.mesh.position.set(at.x, 0, at.z);
      scene.basket.add(s.mesh);
      return s;
    });
    const burnerMan = new SoldierView("foot", "near", material);
    burnerMan.pose("ready");
    burnerMan.mesh.position.set(CRAFT_LOOK.burnerMan.x, 0, CRAFT_LOOK.burnerMan.z);
    scene.basket.add(burnerMan.mesh);
    group.add(scene.group);
    balloons.push({
      scene,
      crew,
      burnerMan,
      id: -1,
      view: { balloon: null, skier: state.skier, wingsuit: null, tick: 0, t: 0, level },
    });
  }
  let shown = false;

  /** The slot drawing craft `id`, or a free one taken for it. */
  function slotOf<S extends { id: number }>(slots: S[], id: number, live: Set<number>): S | null {
    let free: S | null = null;
    for (const s of slots) {
      if (s.id === id) return s;
      if (!free && (s.id < 0 || !live.has(s.id))) free = s;
    }
    if (free) free.id = id;
    return free;
  }

  const liveParas = new Set<number>();
  const liveBalloons = new Set<number>();

  function drawPara(state: GameState, s: ParaSlot, p: ArmyPara, alpha: number): void {
    const v = s.view;
    v.para = p.wing;
    v.skier.x = p.x;
    v.skier.y = p.y;
    v.skier.z = p.z;
    yawQ(p.wing.heading, v.skier.q);
    v.tick = state.tick;
    v.t = state.t;
    v.level = state.level;
    s.scene.frame(v as unknown as GameState, alpha);
    // The soldier in the harness, his frame turned his way.
    const ahead = alpha * (1 / 120);
    const x = p.x + p.vx * ahead;
    const y = p.y + p.vy * ahead;
    const z = p.z + p.vz * ahead;
    s.pilot.mesh.visible = p.mode !== "down" || p.t < ARMY_AIR.para.downed.lie;
    s.pilot.mesh.position.set(x, y - CRAFT_LOOK.seat, z);
    s.pilot.mesh.rotation.set(0, p.mode === "fly" || p.mode === "leave" ? p.wing.heading : p.aimH, 0);
    // Under the reserve, coming down.
    s.reserve.visible = p.mode === "fall" && p.reserve;
    if (s.reserve.visible) s.reserve.position.set(x, y, z);
  }

  function drawBalloon(state: GameState, s: BalloonSlot, m: ArmyBalloon, alpha: number, dt: number): void {
    const v = s.view;
    v.balloon = m.body;
    v.skier = state.skier;
    v.tick = state.tick;
    v.t = state.t;
    v.level = state.level;
    s.scene.frame(v as unknown as GameState, alpha, dt);
    const h = m.body.heading;
    for (let i = 0; i < s.crew.length; i++) {
      const man = s.crew[i];
      const c = m.crew[i];
      man.mesh.visible = !!c && m.mode !== "down";
      if (!c) continue;
      man.mesh.rotation.y = c.aimH - h;
      const up = state.t - c.fired < CRAFT_LOOK.shouldered && m.mode === "fly";
      man.pose(up ? "launch" : "carry");
    }
    s.burnerMan.mesh.visible = m.mode !== "down";
  }

  return {
    group,
    frame(state, alpha, dt) {
      liveParas.clear();
      liveBalloons.clear();
      const ps = armyParas(state);
      const bs = armyBalloons(state);
      for (const p of ps) if (p.mode !== "due" && p.mode !== "gone") liveParas.add(p.id);
      for (const m of bs) if (m.mode !== "due" && m.mode !== "gone") liveBalloons.add(m.id);
      for (const s of paras) {
        s.scene.group.visible = false;
        s.pilot.mesh.visible = false;
        s.reserve.visible = false;
        if (!liveParas.has(s.id)) s.id = -1;
      }
      // A balloon's scene shows and hides its own rig (`frame`, below);
      // its root stays shown.
      for (const s of balloons) if (!liveBalloons.has(s.id)) s.id = -1;
      shown = false;
      for (const p of ps) {
        if (!liveParas.has(p.id)) continue;
        const s = slotOf(paras, p.id, liveParas);
        if (!s) continue;
        drawPara(state, s, p, alpha);
        shown = true;
      }
      for (const m of bs) {
        if (!liveBalloons.has(m.id)) continue;
        const s = slotOf(balloons, m.id, liveBalloons);
        if (!s) continue;
        drawBalloon(state, s, m, alpha, dt);
        shown = true;
      }
      // Hidden balloon slots' burners kept out.
      for (const s of balloons) if (s.id < 0) s.scene.frame(EMPTY, 0, 0);
    },
    light(look) {
      for (const s of paras) s.scene.light(look);
      for (const s of balloons) s.scene.light(look);
    },
    lamps(eye, out) {
      for (const s of balloons) if (s.id >= 0) s.scene.lamps(eye, out);
    },
    any: () => shown,
    dispose() {
      for (const s of paras) {
        s.scene.dispose();
        s.pilot.dispose();
        s.reserve.geometry.dispose();
      }
      for (const s of balloons) {
        s.scene.dispose();
        for (const c of s.crew) c.dispose();
        s.burnerMan.dispose();
      }
      material.dispose();
    },
  };
}

/** A state with no balloon: what a hidden balloon slot is drawn as. */
const EMPTY = { balloon: null } as unknown as GameState;
