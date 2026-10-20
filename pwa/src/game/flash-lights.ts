// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE POINT LIGHTS AN EFFECT FLASHES, LENT FROM A FIXED FEW.
//
// three keys every lit material's program by how many lights a frame sees,
// so a light that comes into the scene mid-run — built with an effect the
// first time one is wanted (the army's machines, a snowmobile on fire, the
// gunfire), or shown with the group it hangs in (the police's camera flash
// as their scene comes into view) — relinks EVERY lit program in the scene
// on the frame it does: seconds on a phone, with the whole picture frozen.
//
// So no effect holds a light of its own. It holds a FLASH POINT — placed,
// coloured and turned up exactly as a point light is, but nothing three
// counts — and the renderer lends the strongest flashes in its scene each
// frame the few real lights it stood up with the run (`createFlashLamps`),
// so the count three sees never moves while a run is up.

import * as THREE from "three";

/** Every flash point not yet disposed, whichever scene it hangs in. */
const FLASHES = new Set<FlashPoint>();

/** A point light as an effect drives it — `color`, `intensity`, `distance`,
 * `decay` as three's `PointLight` has them — shone by whichever lamp the
 * renderer lends it this frame (`FlashLamps.lend`). */
export class FlashPoint extends THREE.Object3D {
  readonly color: THREE.Color;
  intensity: number;
  distance: number;
  decay: number;
  constructor(colour: THREE.ColorRepresentation, intensity = 1, distance = 0, decay = 2) {
    super();
    this.color = new THREE.Color(colour);
    this.intensity = intensity;
    this.distance = distance;
    this.decay = decay;
    FLASHES.add(this);
  }
  /** Never lent a lamp again. */
  dispose(): void {
    FLASHES.delete(this);
  }
}

export type FlashLamps = {
  /** The lamps, in the scene from the run's start to its end. */
  group: THREE.Group;
  /** How many lamps a run lends (0 takes them out of the scene): set only
   * while the world is built, behind the loading card. */
  setCount(count: number): void;
  /** This frame's lamps lent to the strongest flashes shown in `scene`, at
   * where each is; the rest of the lamps dark. */
  lend(scene: THREE.Object3D): void;
  dispose(): void;
};

/** Whether `o` is drawn in `scene`: it and everything over it shown. */
function shownIn(o: THREE.Object3D, scene: THREE.Object3D): boolean {
  let p: THREE.Object3D | null = o;
  for (; p; p = p.parent) {
    if (!p.visible) return false;
    if (p === scene) return true;
  }
  return false;
}

export function createFlashLamps(most: number): FlashLamps {
  const group = new THREE.Group();
  group.name = "flash-lamps";
  const lamps: THREE.PointLight[] = [];
  for (let i = 0; i < most; i++) {
    const lamp = new THREE.PointLight(0xffffff, 0, 0, 2);
    lamp.name = `flash-lamp-${i}`;
    lamps.push(lamp);
    group.add(lamp);
  }
  const lit: FlashPoint[] = [];
  const at = new THREE.Vector3();
  return {
    group,
    setCount(count) {
      lamps.forEach((l, i) => (l.visible = i < count));
    },
    lend(scene) {
      lit.length = 0;
      for (const f of FLASHES) if (f.intensity > 0 && shownIn(f, scene)) lit.push(f);
      if (lit.length > 1) lit.sort((a, b) => b.intensity - a.intensity);
      let k = 0;
      for (const lamp of lamps) {
        if (!lamp.visible) continue;
        const f = lit[k++];
        if (!f) {
          lamp.intensity = 0;
          continue;
        }
        f.updateWorldMatrix(true, false);
        lamp.position.copy(at.setFromMatrixPosition(f.matrixWorld));
        lamp.color.copy(f.color);
        lamp.intensity = f.intensity;
        lamp.distance = f.distance;
        lamp.decay = f.decay;
      }
    },
    dispose() {
      for (const l of lamps) l.dispose();
    },
  };
}
