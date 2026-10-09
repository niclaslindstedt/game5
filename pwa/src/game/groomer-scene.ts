// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE MACHINES IN THE RENDERER — the one hand `machines.ts` holds them
// by: the model fetched once (`models/groomer.glb`, `make models
// KIND=groomer`) and dressed — every material hazed, the lamps' lenses, the
// glass, the beacon and the tail lights lit by the dark — and every machine
// drawn as a copy of it (`groomer-view.ts`; the code's stand-in,
// `groomer-build.ts`, when the build packs none or it fails to load); THE SWATH each lays, stamped
// into the trail map as fresh corduroy (`Stamp.groom`, `trail-map.ts`) —
// the snow the day skied up wiped flat under it — and its belts' prints
// ahead of the tiller; the fine snow the tiller's drum throws up behind it,
// hung in the air the lamps light; THE LAMPS dealt to the slots the snow,
// the woods, the falling snow and the snow cloud are lit by (the nearest
// machine's roof bar, its rear bar and its turning beacon, the next one's
// roof bar); and the skier hidden in the cab he drives. A machine far from
// the lens is drawn at the fleet's FAR CUT (`groomer-far.ts`), every far
// one in one instanced draw a paint. Built per map with the rest of the
// world, on a free ride only.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GROOMER, type GameState, type GroomerState } from "@engine";

import { groomerPaint, type GroomerPaint } from "./groomer-build.ts";
import { createGroomerFar, farNow } from "./groomer-far.ts";
import { GROOMER_LAMPS } from "./groomer-look.ts";
import { createGroomerView, type GroomerView } from "./groomer-view.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { groomerModelUrl } from "./skier-models.ts";
import type { SolidBox } from "./camera-clear.ts";
import type { Flood } from "./headlamp.ts";
import type { SnowCloud } from "./snow-cloud.ts";
import type { Stamp } from "./trail-stamp.ts";

const K = GROOMER;

/** THE WORK LAMPS' LIGHT, linear: a cold LED white, and the beacon's
 * amber. */
const LED = [0.9, 0.95, 1.0] as const;
const AMBER = [1.0, 0.5, 0.06] as const;
/** THE BEAMS (`lampReach`): the roof bars' wide flood — a spot some 45°
 * across, flooding out to 160° — and the beacon's narrower sweep. */
const WORK_BEAM = [0.72, 0.93, 0.15, 0.55] as const;
const BEACON_BEAM = [0.8, 0.96, 0.3, 0.12] as const;
/** How bright, over a flood's: the front bar, the rear bar, the beacon. */
const POWER = { front: 3.4, rear: 2.2, beacon: 0.9 };
/** Past this from the lens a machine's lamps are left out, m. */
const REACH = 600;

/** The tiller's mist: puffs a second at the working pace, and their size. */
const MIST_RATE = 5;
const MIST_SIZE = 0.55;

export type GroomerScene = {
  group: THREE.Group;
  /** Resolved once the model is fetched and dressed (or given up on) —
   * awaited before the run's programs are compiled. */
  ready: Promise<void>;
  /** One frame: every machine posed, the swaths and the belts' prints
   * stamped into `stamps` (when the trails are drawn), the tiller's mist
   * thrown. */
  frame(state: GameState, dt: number, stamps: Stamp[] | null, cloud: SnowCloud | null): void;
  /** The lamps lit at `lit` (0 day … 1 night) and seen from `eye`, onto
   * `out` nearest first — what the slots are dealt; and every machine
   * handed the cut its distance from `eye` asks. */
  lamps(state: GameState, lit: number, eye: THREE.Vector3, out: Flood[]): void;
  /** The machine he drives as drawn, for the lens, or null. */
  drawn(g: GroomerState): ReturnType<GroomerView["drawn"]> | null;
  /** Every machine out, as the box the lens keeps out of, drawn. */
  solids(): readonly SolidBox[];
  dispose(): void;
};

/** The pens a machine's prints are drawn with: where each belt was last
 * stamped, and how far into its swath the stamping has come. */
type Pen = { swath: number; belts: [number, number, number, number] };

const fwd = new THREE.Vector3();
const lamp = new THREE.Vector3();

/** The lit materials: the lamps' lenses, the cab's glass, the beacon's
 * dome and the tail lights — the code's paint's, or the model's by name. */
type Lit = {
  lamp: THREE.MeshStandardMaterial[];
  glass: THREE.MeshStandardMaterial[];
  amber: THREE.MeshStandardMaterial[];
  tail: THREE.MeshStandardMaterial[];
};

/** THE MODEL, fetched once for every machine on the map and dressed: every
 * material hazed, and the lit ones gathered into `lit` and given their
 * glow. Null when the build packs none or the file does not load. */
function loadModel(haze: HazeUniforms, lit: Lit, made: THREE.Material[]) {
  const url = groomerModelUrl();
  if (!url) return Promise.resolve(null);
  return new GLTFLoader()
    .loadAsync(url)
    .then((gltf): THREE.Object3D => {
      const seen = new Set<THREE.Material>();
      gltf.scene.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (seen.has(m) || !(m instanceof THREE.MeshStandardMaterial)) continue;
          seen.add(m);
          made.push(m);
          hazeMaterial(m, haze, "groomer");
          if (m.name === "lamp") {
            m.emissive.setHex(0xe8f0ff);
            lit.lamp.push(m);
          } else if (m.name === "glass") {
            m.emissive.setHex(0xffb062);
            m.emissiveIntensity = 0;
            lit.glass.push(m);
          } else if (m.name === "amber") {
            m.transparent = true;
            m.opacity = 0.85;
            m.emissive.setHex(0xff7a00);
            lit.amber.push(m);
          } else if (m.name === "tail") {
            m.emissive.setHex(0xff1010);
            lit.tail.push(m);
          } else if (m.name === "orange") {
            m.side = THREE.DoubleSide;
          }
        }
      });
      return gltf.scene;
    })
    .catch(() => null);
}

/** The lit materials of the code's paint. */
function paintLit(paint: GroomerPaint): Lit {
  return { lamp: [paint.lamp], glass: [paint.glass], amber: [paint.amber], tail: [paint.tail] };
}

export function createGroomerScene(haze: HazeUniforms): GroomerScene {
  const group = new THREE.Group();
  group.name = "piste-machines";
  const paint = groomerPaint(haze);
  const lit: Lit = paintLit(paint);
  const made: THREE.Material[] = [];
  const model = loadModel(haze, lit, made);
  const views: GroomerView[] = [];
  /** Which views are drawn at the far cut. */
  const isFar: boolean[] = [];
  const far = createGroomerFar(paint, K.count.most);
  group.add(far.group);
  const pens = new WeakMap<GroomerState, Pen>();
  let mist = 0;
  const boxes: SolidBox[] = [];

  const viewOf = (i: number): GroomerView => {
    while (views.length <= i) {
      const v = createGroomerView(paint, model);
      views.push(v);
      group.add(v.group);
    }
    return views[i];
  };

  /** A point of the machine's frame in the world, off the drawn group. */
  const worldOf = (v: GroomerView, x: number, y: number, z: number, out: THREE.Vector3) =>
    out.set(x, y, z).applyMatrix4(v.group.matrixWorld);

  return {
    group,
    ready: model.then(() => undefined),
    frame(state, dt, stamps, cloud) {
      const gs = state.groomers ?? [];
      for (let i = 0; i < views.length; i++) views[i].group.visible = i < gs.length;
      gs.forEach((g, i) => {
        const v = viewOf(i);
        v.update(g, state.t, dt);
        let pen = pens.get(g);
        if (!pen) {
          pen = { swath: 0, belts: [Number.NaN, 0, Number.NaN, 0] };
          pens.set(g, pen);
        }
        if (stamps) {
          // THE SWATH: every segment the engine has laid since the last frame.
          const sw = g.swath;
          for (; pen.swath + 3 < sw.length; pen.swath += 4) {
            stamps.push({
              ax: sw[pen.swath],
              az: sw[pen.swath + 1],
              bx: sw[pen.swath + 2],
              bz: sw[pen.swath + 3],
              half: K.tiller.width / 2,
              depth: 0,
              berm: 0,
              groom: true,
            });
          }
          // THE BELTS' PRINTS, pressed ahead of the tiller (which combs
          // them out again when it is down).
          const fx = Math.sin(g.heading);
          const fz = Math.cos(g.heading);
          const off = K.tracks.span / 2 - K.tracks.width / 2;
          for (let b = 0; b < 2; b++) {
            const s = b === 0 ? -1 : 1;
            const x = g.x + fz * off * s;
            const z = g.z - fx * off * s;
            const px = pen.belts[b * 2];
            const pz = pen.belts[b * 2 + 1];
            if (Number.isNaN(px) || Math.hypot(x - px, z - pz) > 6) {
              pen.belts[b * 2] = x;
              pen.belts[b * 2 + 1] = z;
            } else if (Math.hypot(x - px, z - pz) > 0.5) {
              stamps.push({
                ax: px,
                az: pz,
                bx: x,
                bz: z,
                half: K.tracks.width / 2,
                depth: 0.05,
                berm: 0.02,
                wall: 1,
              });
              pen.belts[b * 2] = x;
              pen.belts[b * 2 + 1] = z;
            }
          }
        }
        // THE TILLER'S MIST: the drum's fine snow thrown up off its back,
        // hanging where the rear lamps light it.
        if (cloud && g.tiller && g.speed > 0.5 && dt > 0) {
          mist += MIST_RATE * dt * Math.min(1, g.speed / K.work);
          const fx = Math.sin(g.heading);
          const fz = Math.cos(g.heading);
          while (mist >= 1) {
            mist -= 1;
            const across = (Math.random() - 0.5) * K.tiller.width;
            const x = g.x - fx * (K.tiller.behind - 0.6) + fz * across;
            const z = g.z - fz * (K.tiller.behind - 0.6) - fx * across;
            cloud.blow(
              x,
              g.y + 0.3,
              z,
              -fx * 0.5 + (Math.random() - 0.5) * 0.4,
              0.15 + Math.random() * 0.2,
              -fz * 0.5 + (Math.random() - 0.5) * 0.4,
              MIST_SIZE,
            );
          }
        }
      });
    },
    lamps(state, dark, eye, out) {
      const gs = state.groomers ?? [];
      // The lenses, the glass, the beacon and the tail lights, by the dark
      // — always a little on; the work is the night's.
      const on = 0.25 + 0.75 * dark;
      for (const m of lit.lamp) m.emissiveIntensity = 0.6 + 5 * on;
      for (const m of lit.glass) m.emissiveIntensity = 0.035 * dark * dark;
      for (const m of lit.amber) m.emissiveIntensity = 0.8 + 2.5 * on;
      for (const m of lit.tail) m.emissiveIntensity = 0.3 + 1.5 * on;
      const order = gs
        .map((g, i) => ({ i, d: Math.hypot(g.x - eye.x, g.z - eye.z) }))
        .filter((o) => o.d < REACH)
        .sort((a, b) => a.d - b.d);
      gs.forEach((_, i) => viewOf(i).light(dark, eye));
      // THE CUTS: the nearest whole, the rest one instanced draw a paint.
      far.begin();
      gs.forEach((g, i) => {
        const d = Math.hypot(g.x - eye.x, g.y - eye.y, g.z - eye.z);
        const now = farNow(d, isFar[i] ?? false) && far.add(views[i].group.matrixWorld);
        if (now !== (isFar[i] ?? false)) views[i].setFar(now);
        isFar[i] = now;
      });
      far.end();
      order.forEach(({ i }, k) => {
        const v = views[i];
        const g = gs[i];
        const push = (
          y: number,
          z: number,
          heading: number,
          down: number,
          colour: readonly number[],
          beam: readonly number[],
          power: number,
          x = 0,
        ) => {
          worldOf(v, x, y, z, lamp);
          fwd.set(
            Math.sin(heading) * Math.cos(down),
            -Math.sin(down),
            Math.cos(heading) * Math.cos(down),
          );
          out.push({
            x: lamp.x,
            y: lamp.y,
            z: lamp.z,
            dx: fwd.x,
            dy: fwd.y,
            dz: fwd.z,
            colour,
            beam,
            power,
          });
        };
        const F = GROOMER_LAMPS.front;
        push(F.y, F.z, g.heading, F.down - g.pitch, LED, WORK_BEAM, POWER.front);
        if (k > 0) return;
        const R = GROOMER_LAMPS.rear;
        push(R.y, R.z, g.heading + Math.PI, R.down + g.pitch, LED, WORK_BEAM, POWER.rear);
        const B = GROOMER_LAMPS.beacon;
        push(B.y, B.z, v.beaconHeading(), 0.12, AMBER, BEACON_BEAM, POWER.beacon, B.x);
      });
    },
    drawn(g) {
      return views[g.id]?.drawn() ?? null;
    },
    solids() {
      boxes.length = 0;
      for (const v of views) {
        if (!v.group.visible) continue;
        const d = v.drawn();
        const dx = Math.sin(d.heading);
        const dz = Math.cos(d.heading);
        const mid = (K.front - K.back) / 2;
        boxes.push({
          x: d.x + dx * mid,
          z: d.z + dz * mid,
          dx,
          dz,
          halfLength: (K.front + K.back) / 2,
          halfWidth: K.half,
          base: d.y - 1,
          top: d.y + K.roof + 0.6,
        });
      }
      return boxes;
    },
    dispose() {
      for (const v of views) v.dispose();
      far.dispose();
      paint.dispose();
      for (const m of made) m.dispose();
      void model.then((scene) =>
        scene?.traverse((o) => {
          if (o instanceof THREE.Mesh) o.geometry.dispose();
        }),
      );
    },
  };
}
