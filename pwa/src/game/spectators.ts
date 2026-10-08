// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SPECTATORS, DRAWN — the crowd `spectator-plan.ts` deals a race map,
// bank by bank, and the finish arena they stand round (`finish-arena.ts`).
//
// Each BANK is three instanced meshes over one set of per-fan attributes:
// the NEAR cut while the lens is within `FAN_CUTS.near` of it, the MID cut
// to `FAN_CUTS.mid`, the FAR cut to `FAN_CUTS.far`, and nothing past that
// — a whole bank handed over at once, so the swap is one switch and never
// a fan at a time. A fan's
// instance is where he stands and nothing else; how big he is, which way
// he faces, what he wears and how he moves are his attributes, posed in
// the vertex shader (`spectator-shapes.ts`). What changes a frame is four
// uniforms: the clock, where the racers are, how loud the arena is and
// where the wave along a grandstand has got to.
//
// Presentation, end to end: reads `GameState` and the `Level`, writes
// neither, and draws nothing from `state.rng`.

import * as THREE from "three";
import type { GameState, Level, RunRules, SkierState } from "@engine";

import { hasCivilians } from "./civilian-plan.ts";
import { createCiviliansView } from "./civilians-view.ts";
import { createCrowdView, type CrowdView } from "./crowd-view.ts";

export type { CrowdView };

import { createFinishArena, type FinishArena } from "./finish-arena.ts";
import type { HazeUniforms } from "./haze.ts";
import { hasSpectators, planSpectators, type Fan, type SpectatorPlan } from "./spectator-plan.ts";
import {
  buildFanFigure,
  FAN_CUT_NAMES,
  fanMaterial,
  fanUniforms,
  REF,
  type FanCut,
  type FanUniforms,
} from "./spectator-shapes.ts";

/** Where a bank hands over from its near cut to its mid one and from
 * that to its far one, and past which it is not drawn, m from the lens to
 * its nearest fan. */
export const FAN_CUTS = { near: 22, mid: 80, far: 450 };

/** THE ARENA'S MOOD: how much it moves with nobody near (the music between
 * racers), how hard a finish lifts it and how fast that dies away, /s;
 * the wave — how often one starts, s, how fast it runs, m/s. */
const MOOD = { idle: 0.28, roar: 1, fade: 0.18, waveEvery: 38, waveSpeed: 9, waveQuiet: 160 };

export type Spectators = {
  group: THREE.Group;
  plan: SpectatorPlan;
  uniforms: FanUniforms;
  /** Pose the crowd for `state` with the lens at `eye`; `t` the clock the
   * crowd moves by (the engine's, so a replay is the same crowd). */
  update(state: GameState, eye: THREE.Vector3): void;
  dispose(): void;
};

/** The per-fan attributes, as the shader reads them. */
export function fanAttributes(
  fans: readonly Fan[],
): Record<string, THREE.InstancedBufferAttribute> {
  const n = fans.length;
  const look = new Float32Array(n * 4);
  const act = new Float32Array(n * 4);
  const mood = new Float32Array(n * 4);
  const dress = new Float32Array(n * 4);
  const dress2 = new Float32Array(n * 4);
  fans.forEach((f, i) => {
    look.set(
      [
        f.height / REF.height,
        f.girth,
        f.hat,
        (f.coat ? 1 : 0) + (f.pack ? 2 : 0) + (f.scarf ? 4 : 0),
      ],
      i * 4,
    );
    act.set([f.yaw, f.phase, f.lively, f.style], i * 4);
    mood.set([f.reach, f.arena ? 1 : 0, f.along, f.kind === "stand" ? 1 : 0], i * 4);
    dress.set(f.dress, i * 4);
    dress2.set(f.dress2, i * 4);
  });
  const attr = (a: Float32Array) => new THREE.InstancedBufferAttribute(a, 4);
  return {
    aLook: attr(look),
    aAct: attr(act),
    aMood: attr(mood),
    aDress: attr(dress),
    aDress2: attr(dress2),
  };
}

/** How much a racer moving at `speed` m/s excites a crowd: a racer at
 * speed all of it, one stopped in the finish circle still some. */
export function skierPull(speed: number): number {
  return 0.45 + 0.55 * Math.min(1, Math.max(0, (speed - 2) / 14));
}

type BankMesh = {
  cuts: Record<FanCut, THREE.InstancedMesh>;
  centre: THREE.Vector3;
  radius: number;
};

export function createSpectators(level: Level, haze: HazeUniforms): Spectators {
  const group = new THREE.Group();
  group.name = "spectators";
  const plan = planSpectators(level);
  const uniforms = fanUniforms();
  const material = fanMaterial(haze, uniforms);
  const geos: THREE.BufferGeometry[] = [];
  const meshes: BankMesh[] = [];
  const m4 = new THREE.Matrix4();
  for (const bank of plan.banks) {
    const fans = plan.fans.slice(bank.from, bank.to);
    const attrs = fanAttributes(fans);
    const make = (cut: FanCut): THREE.InstancedMesh => {
      const g = new THREE.BufferGeometry();
      const figure = buildFanFigure(cut);
      for (const name of ["position", "normal", "color", "aBone"])
        g.setAttribute(name, figure.getAttribute(name));
      for (const [name, a] of Object.entries(attrs)) g.setAttribute(name, a);
      geos.push(g);
      const mesh = new THREE.InstancedMesh(g, material, fans.length);
      fans.forEach((f, i) => mesh.setMatrixAt(i, m4.makeTranslation(f.x, f.y, f.z)));
      mesh.boundingSphere = new THREE.Sphere(
        new THREE.Vector3(bank.x, bank.y + 1, bank.z),
        bank.radius + 3,
      );
      mesh.receiveShadow = cut === "near";
      mesh.visible = false;
      mesh.name = `fans-${bank.kind}-${cut}`;
      group.add(mesh);
      return mesh;
    };
    meshes.push({
      cuts: Object.fromEntries(FAN_CUT_NAMES.map((c) => [c, make(c)])) as Record<
        FanCut,
        THREE.InstancedMesh
      >,
      centre: new THREE.Vector3(bank.x, bank.y, bank.z),
      radius: bank.radius,
    });
  }
  const arena: FinishArena | null = plan.arena ? createFinishArena(level, plan, haze) : null;
  if (arena) group.add(arena.group);

  let roar = 0;
  let lastT = -1;
  let waveAt = -1;
  const done = new WeakMap<GameState, boolean>();
  const runsOf = (state: GameState): GameState[] => [state, ...state.rivals.map((r) => r.run)];
  const quietWithin = (s: SkierState): number =>
    plan.arena ? Math.hypot(s.x - plan.arena.x, s.z - plan.arena.z) : Infinity;

  const update: Spectators["update"] = (state, eye) => {
    const t = state.t;
    const dt = lastT < 0 ? 0 : Math.max(0, Math.min(0.25, t - lastT));
    if (t < lastT) {
      // A restart: the arena is calm again.
      roar = 0;
      waveAt = -1;
    }
    lastT = t;
    uniforms.uFanTime.value = t;
    // THE RACERS, the player's first; a finish heard as a roar.
    const runs = runsOf(state);
    let near = Infinity;
    for (let i = 0; i < 4; i++) {
      const u = uniforms.uFanSkier.value[i];
      const run = runs[i];
      if (!run) {
        u.w = 0;
        continue;
      }
      const s = run.skier;
      u.set(s.x, s.y, s.z, skierPull(s.speed));
      near = Math.min(near, quietWithin(s));
      const finished = run.progress.finished;
      if (finished && done.get(run) === false) roar = MOOD.roar;
      done.set(run, finished);
    }
    roar = Math.max(0, roar - MOOD.fade * dt);
    uniforms.uFanArena.value = MOOD.idle + (1 - MOOD.idle) * roar;
    // THE WAVE: with nobody near the arena, now and then, along the stands.
    const w = uniforms.uFanWave.value;
    if (waveAt < 0 && near > MOOD.waveQuiet && t % MOOD.waveEvery < dt + 1e-6 && t > 5) waveAt = t;
    if (waveAt >= 0) {
      const along = (t - waveAt) * MOOD.waveSpeed - 4;
      const width = plan.stands[0]?.width ?? 0;
      w.set(along, along > width + 6 ? 0 : 1, 0, 0);
      if (along > width + 6) waveAt = -1;
    } else {
      w.set(0, 0, 0, 0);
    }
    // THE CUTS, a bank at a time.
    for (const b of meshes) {
      const d = Math.max(0, eye.distanceTo(b.centre) - b.radius);
      b.cuts.near.visible = d < FAN_CUTS.near;
      b.cuts.mid.visible = d >= FAN_CUTS.near && d < FAN_CUTS.mid;
      b.cuts.far.visible = d >= FAN_CUTS.mid && d < FAN_CUTS.far;
    }
    arena?.update(state);
  };

  return {
    group,
    plan,
    uniforms,
    update,
    dispose() {
      for (const b of meshes) for (const m of Object.values(b.cuts)) m.dispose();
      for (const g of geos) g.dispose();
      material.dispose();
      arena?.dispose();
    },
  };
}

/** EVERYONE ON THE MOUNTAIN who is not racing: the free ride's amateurs
 * (`crowd-view.ts`) and its people on foot (`civilians-view.ts`, wherever
 * the ski area has its people — `hasCivilians`) and, on a run with
 * something to watch (`hasSpectators`), the crowd watching it — one view to
 * the renderer. */
export function createPeopleView(level: Level, haze: HazeUniforms, rules: RunRules): CrowdView {
  const views: CrowdView[] = [createCrowdView(level, haze)];
  if (hasCivilians(rules)) views.push(createCiviliansView(level, haze));
  if (hasSpectators(rules)) views.push(createSpectators(level, haze));
  if (views.length === 1) return views[0];
  const group = new THREE.Group();
  group.name = "crowd";
  for (const v of views) group.add(v.group);
  return {
    group,
    update(state, eye) {
      for (const v of views) v.update(state, eye);
    },
    dispose() {
      for (const v of views) v.dispose();
    },
  };
}
