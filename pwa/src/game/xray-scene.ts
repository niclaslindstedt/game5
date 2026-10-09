// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LENS ON A HURT BODY, as the renderer asks for it: the X-RAY CAM
// (`xray-shots.ts` directs, `camera-xray.ts` frames, `xray-view.ts` draws
// the skeleton inside him) while the app has it running, and the DEATH CAM
// (`camera-death.ts`) while he is off his skis otherwise. One place picks
// between them, so the renderer asks one question for both — and the death
// cam (or the ladder) is what the X-ray lens flies in off and back home to,
// so neither hand-over is a cut.

import * as THREE from "three";

import { GROOMER, type GameState, type Level, type Thrown } from "@engine";

import { createLineClear, heliBox, type SolidBox } from "./camera-clear.ts";
import { createDeathCam, dropDeathCam, frameDeath } from "./camera-death.ts";
import type { LensPose, LineClear, Vec3 } from "./camera-rigs.ts";
import { XRAY_LENS, createXrayLens, frameXray, type LensSide } from "./camera-xray.ts";
import { createXrayView, type XraySkin } from "./xray-view.ts";
import { IDLE_XRAY, type XrayLook } from "./xray-shots.ts";

export type HurtLens = {
  /** The skeleton's group, added to the scene once. */
  group: THREE.Group;
  /** Whether the app lets the death cam take the lens. */
  setDeathCam(on: boolean): void;
  /** The X-ray cam's look this frame (null: off). */
  setXray(look: XrayLook | null): void;
  /** Pose the skeleton inside his skin. */
  update(state: GameState, skin: XraySkin): void;
  /** The lens to draw, or null for the ladder's own. `snap` is called on
   * the frame a cam lets go, so the ladder cuts back in. */
  lens(
    allowed: boolean,
    body: Thrown | null,
    ladder: LensPose,
    dt: number,
    groundAt: (x: number, z: number) => number,
    clear: LineClear | undefined,
    snap: () => void,
  ): LensPose | null;
  /** Whether the X-ray cam has the run (the figure is drawn whatever rung). */
  active(): boolean;
  /** How far the skin is glass this frame, 0 … 1: what is drawn outside
   * him (the gore's blood and shards) stands down while the world is veiled. */
  veil(): number;
  dispose(): void;
};

/** A SHRED UNDER A PISTE MACHINE, seen from outside: the working machine
 * nearest `at` and the lens stood off behind it and to one side, up over
 * it, looking at its tail — the tiller, and what it spits out — where `at`
 * is moved to; or none, for the lens to circle him. */
export function machineSide(state: GameState | null, at: Vec3): LensSide | undefined {
  let best: { x: number; y: number; z: number; heading: number; speed: number } | undefined;
  let near = MACHINE_SHOT.reach * MACHINE_SHOT.reach;
  for (const m of state?.groomers ?? []) {
    const d = (m.x - at.x) ** 2 + (m.z - at.z) ** 2;
    if (d < near) {
      near = d;
      best = m;
    }
  }
  if (!best) return undefined;
  // Its tail is the way it goes's opposite (backing up, its blade).
  const ahead = best.speed < 0 ? -1 : 1;
  const tail = ahead > 0 ? GROOMER.back : GROOMER.front;
  const fx = Math.sin(best.heading) * ahead;
  const fz = Math.cos(best.heading) * ahead;
  at.x = best.x - fx * tail;
  at.z = best.z - fz * tail;
  at.y = best.y + MACHINE_SHOT.over;
  const back = Math.atan2(-fx, -fz);
  return {
    bearing: back - MACHINE_SHOT.turn,
    arm: MACHINE_SHOT.arm,
    height: MACHINE_SHOT.height,
    fov: MACHINE_SHOT.fov,
  };
}

/** A BLAST, seen from outside it: the skier still on (or blown off) the
 * skid of a helicopter coming down — the lens stood well back off the
 * fireball it makes, circling it. */
const blownFrom = (state: GameState | null): boolean =>
  !!state?.heli && (state.heli.rider || !!state.heli.wreck?.aboard);
const BLAST_SHOT: LensSide = { arm: 15, height: 5, fov: 55 };
/** The aim over the machine, m. */
const BLAST_OVER = 1.5;

/** INTO THE ROTOR, seen from outside: the lens on the far side of him
 * from the machine, so its cabin is behind him and its blades sweep
 * over him into the frame. */
function rotorSide(state: GameState | null, at: Vec3): LensSide | undefined {
  const h = state?.heli;
  if (!h || h.mode === "wreck" || (h.shed < 0 && h.taken === 0)) return undefined;
  return { ...XRAY_LENS.shred, bearing: Math.atan2(at.x - h.x, at.z - h.z) };
}

/** How near a piste machine must be to take a shred's lens, m; the aim
 * over its tail, m; how far round from straight behind it the lens stands,
 * rad; and its arm and height off the tail, m, and its zoom, degrees. */
const MACHINE_SHOT = { reach: 12, over: 2, turn: 1.25, arm: 10, height: 5.5, fov: 54 } as const;

export function createHurtLens(): HurtLens {
  const view = createXrayView();
  const xlens = createXrayLens();
  const death = createDeathCam();
  let deathOn = false;
  let look: XrayLook | null = null;
  const target = new THREE.Vector3();
  /** The lens the game's own camera drew last frame (the death cam's or
   * the ladder's), what the death cam flies on from. */
  let prev: LensPose | null = null;
  /** THE HELICOPTER'S CABIN the lens keeps out of (`heliBox`): a skier shed
   * off its skid falls past it, a bone's width from the glass. Built once a
   * map, on a run with a helicopter only. */
  let run: GameState | null = null;
  let builtFor: Level | null = null;
  let machine: LineClear | undefined;
  let shredClear: LineClear | undefined;
  let blasted = false;
  const cabin: SolidBox = {
    x: 0,
    z: 0,
    dx: 0,
    dz: 1,
    halfLength: 0,
    halfWidth: 0,
    base: 0,
    top: 0,
  };
  const cabins = (): readonly SolidBox[] => (run?.heli ? [heliBox(run.heli, cabin)] : []);

  return {
    group: view.group,
    setDeathCam(on) {
      deathOn = on;
    },
    setXray(next) {
      look = next;
    },
    update(state, skin) {
      run = state;
      if (builtFor !== state.level) {
        builtFor = state.level;
        machine = state.heli
          ? createLineClear(state.level, { trees: false, movers: cabins })
          : undefined;
        // A shred's: the woods, and the helicopter's cabin while it flies
        // (a wreck's is blown apart round its fireball, and the lens stands
        // back off that by itself).
        shredClear = createLineClear(state.level, {
          movers: () => (run?.heli && run.heli.mode !== "wreck" ? cabins() : []),
        });
      }
      const meshes: THREE.Mesh[] = [];
      skin.group.traverse((o) => {
        if ((o as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(o as THREE.Mesh);
      });
      view.update(look ?? IDLE_XRAY, state, skin, meshes);
    },
    lens(allowed, body, ladder, dt, groundAt, clear, snap) {
      const shot = allowed && look?.active ? look.shot : null;
      let at: THREE.Vector3 | null = null;
      if (shot) {
        // The whole of him is looked at where his body lies, the skeleton
        // faded out by then.
        at =
          shot.kind === "bone"
            ? view.centreOf(shot.bone, target)
            : // A tear is seen on him, at the stump — the piece is flung
              // off out of the frame; the way back looks where he lies.
              body
              ? target.set(body.x, body.y, body.z)
              : shot.kind === "tear"
                ? target.set(shot.at.x, shot.at.y, shot.at.z)
                : view.bodyCentre(target);
        // A bone not drawn (torn away) is looked for in the body.
        at ??= view.bodyCentre(target);
        if (!at && body) at = target.set(body.x, body.y, body.z);
      }
      // THE GAME'S OWN CAMERA this frame — the death cam's while it has him,
      // else the ladder's: run underneath the X-ray cam, so the lens flies
      // in off it and is drawn back home to it.
      let home: LensPose | null = null;
      if (deathOn && allowed) {
        home = frameDeath(death, body, prev ?? ladder, dt, groundAt, clear);
        if (death.ended && !shot) snap();
      } else if (death.active) dropDeathCam(death);
      prev = home;
      // Nothing hides him under the X-ray (`xray-view.ts`), so its lens is
      // pulled in by nothing that stands between but the helicopter he
      // falls past (`machine`): a lens is never stood in its cabin. A
      // SHRED is seen from outside, stood back: the woods pull it in too,
      // and under a piste machine it is held off the machine's side,
      // behind its tiller, where what it spits out flies.
      const shred = look?.kind === "shred";
      // Under a piste machine the lens looks at the machine at work, its
      // tiller and what flies out behind it: he is under it.
      // A blast's lens stays stood back for the whole shot: the machine is a
      // wreck and he is gone off its skid a frame after it took the shot.
      // The way back from a shred keeps its framing: stood back, outside.
      if (!shred) blasted = false;
      else if (blownFrom(run)) blasted = true;
      // ...looking at the machine going up, what is left of him flung out
      // of it: never carried after him into its fireball.
      if (blasted && at && run?.heli) at.set(run.heli.x, run.heli.y + BLAST_OVER, run.heli.z);
      const side =
        shred && at
          ? (machineSide(run, at) ??
            (blasted ? BLAST_SHOT : (rotorSide(run, at) ?? XRAY_LENS.shred)))
          : undefined;
      const x = frameXray(
        xlens,
        shot,
        at,
        home ?? ladder,
        look?.back ?? 0,
        dt,
        groundAt,
        shred ? (shredClear ?? machine) : machine,
        side,
      );
      return x ?? home;
    },
    active: () => !!look?.active,
    veil: () => (look?.active ? look.xray : 0),
    dispose() {
      view.dispose();
    },
  };
}
