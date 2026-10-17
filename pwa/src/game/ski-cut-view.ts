// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIS CUT BY A LIFT'S ROPE AS DRAWN (`engine/game/ski-cut.ts`). A cut
// ski is a share `part` of the whole one, and the engine lays it so that
// `loneSkiFrame` still stands the WHOLE ski's frame where it would be — at
// its boot centre, z to its tip. So a piece is drawn as a copy of the whole
// ski (the code's, or the modelled one) laid by that frame and CLIPPED to
// its share by two planes across its length: the one at share `s` sits at
// `lookFrame`'s `tail + s * length` in the ski's frame.
//
// The copy is the pair's own drawn ski cloned once, the moment a piece
// needs it: its geometry shared, its materials cloned so the clipping
// planes are its own (the other ski, and every other skier on the same
// skis, are untouched), drawn on both faces so the hollow of the cut reads
// as the ski's own section rather than a hole, and a pale face of the
// wood core put across every cut, so a piece reads as cut even while the
// two still fly together. The piece kept in the
// binding takes its ski's place: the pair's own draw of that ski is hidden
// (`update`'s answer) while the copy is shown. Every copy is let go the
// moment nothing on the thrown body is cut — a reset, a new run.
//
// The clipping planes need the renderer's `localClippingEnabled`
// (`renderer.ts`); a material with clipping planes and `clipShadows` keeps
// three's own depth material in the sun's map (`shadow-depth.ts`), so the
// shadow is cut where the ski is.

import * as THREE from "three";
import type { LoneSki, SkiSpec, Thrown } from "@engine";

import { lookFrame } from "./ski-looks.ts";

/** One drawn copy of a ski, hung under the pair's root. */
export type SkiPiece = {
  object: THREE.Object3D;
  /** Every material the copy draws with — cloned, its own. */
  materials: THREE.Material[];
  /** Laid by `frame`, the whole ski's world frame (`loneSkiFrame`). */
  lay(frame: THREE.Matrix4): void;
  dispose(): void;
};

/** `m` cloned to be clipped by `planes`: the same look and the same shader
 * graft (the haze's, through the world's wrap), on both faces. */
export function clippedClone(m: THREE.Material, planes: THREE.Plane[]): THREE.Material {
  const c = m.clone();
  c.onBeforeCompile = m.onBeforeCompile;
  c.customProgramCacheKey = m.customProgramCacheKey;
  c.clippingPlanes = planes;
  c.clipShadows = true;
  c.side = THREE.DoubleSide;
  return c;
}

/** Every mesh under `o` drawn with a clipped clone of its material, one
 * clone for each material however many meshes share it. */
export function clipAll(o: THREE.Object3D, planes: THREE.Plane[]): THREE.Material[] {
  const done = new Map<THREE.Material, THREE.Material>();
  const one = (m: THREE.Material): THREE.Material => {
    let c = done.get(m);
    if (!c) done.set(m, (c = clippedClone(m, planes)));
    return c;
  };
  o.traverse((n) => {
    const mesh = n as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(one) : one(mesh.material);
  });
  return [...done.values()];
}

/** The CODE'S SKI `group` (`ski-gear.ts`'s, under `root`) copied: every
 * part back on the layers (the merged draw took them off) and shown. */
export function codeSkiPiece(
  group: THREE.Object3D,
  root: THREE.Object3D,
  planes: THREE.Plane[],
): SkiPiece {
  const object = group.clone(true);
  object.visible = true;
  object.traverse((n) => {
    n.layers.enableAll();
    n.visible = true;
    const mesh = n as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  const materials = clipAll(object, planes);
  root.add(object);
  const toLocal = new THREE.Matrix4();
  const keep = new THREE.Vector3();
  return {
    object,
    materials,
    lay(frame) {
      toLocal.copy(root.matrixWorld).invert().multiply(frame);
      keep.copy(object.scale);
      toLocal.decompose(object.position, object.quaternion, object.scale);
      object.scale.copy(keep);
    },
    dispose() {
      object.removeFromParent();
      for (const m of materials) m.dispose();
    },
  };
}

export type SkiCuts = {
  /** The pieces of `off` laid (`frameOf` the whole ski's world frame of
   * a lone ski, `lies` the pair's two as already laid); which of the
   * pair's two skis are cut, and so not to be drawn whole. */
  update(
    off: Thrown | null | undefined,
    lies: readonly THREE.Matrix4[],
    frameOf: (ski: LoneSki, out: THREE.Matrix4) => THREE.Matrix4,
  ): readonly [boolean, boolean];
  /** Every piece let go (what a run without a cut ski does by itself). */
  dispose(): void;
  /** ...and what every piece shares: the pair is done with. */
  destroy(): void;
};

type Held = {
  piece: SkiPiece;
  side: number;
  planes: THREE.Plane[];
  /** The raw faces at the cut, the core's pale wood: tail-side, tip-side. */
  caps: THREE.Group;
};

/** The colour of a ski's wood core, as the cut shows it. */
const CORE = 0xcfb07a;

const NONE = [false, false] as const;

/** The cut skis of a pair on `spec` hung under `root`: `make(i, planes)` a
 * fresh copy of the pair's ski `i` (0 the left) clipped by `planes`. */
export function createSkiCuts(
  spec: SkiSpec,
  root: THREE.Object3D,
  make: (i: 0 | 1, planes: THREE.Plane[]) => SkiPiece,
): SkiCuts {
  const F = lookFrame(spec);
  const tail = F.tail;
  const thick = F.look.thick;
  // A cut face: a sliver the ski's width and thickness, scaled to it there.
  const capGeo = new THREE.BoxGeometry(1, 1, 0.004);
  const capMat = new THREE.MeshStandardMaterial({ color: CORE, roughness: 0.8 });
  const toLocal = new THREE.Matrix4();
  const kept: (Held | null)[] = [null, null];
  const halves: Held[] = [];
  const cut: [boolean, boolean] = [false, false];
  const frame = new THREE.Matrix4();
  const along = new THREE.Vector3();
  const at = new THREE.Vector3();
  const origin = new THREE.Vector3();

  const hold = (side: number): Held => {
    // Three keeps what lies on a plane's positive side: z ≥ lo and z ≤ hi.
    const planes = [new THREE.Plane(), new THREE.Plane()];
    const caps = new THREE.Group();
    for (let k = 0; k < 2; k++) {
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.castShadow = true;
      caps.add(cap);
    }
    root.add(caps);
    return { piece: make(side < 0 ? 0 : 1, planes), side, planes, caps };
  };
  /** The cut face at share `s` of the ski, shown only where it is a cut. */
  const face = (cap: THREE.Object3D, s: number, cut: boolean): void => {
    cap.visible = cut;
    if (!cut) return;
    const z = tail + s * spec.length;
    // Thickest under the boot, thinning to its ends.
    const end = Math.abs(z) / Math.max(1e-3, z < 0 ? -tail : tail + spec.length);
    const h = thick.boot + (thick.end - thick.boot) * Math.min(1, end);
    cap.scale.set(spec.waist, h, 1);
    cap.position.set(0, h / 2, z);
  };
  /** The planes of `h` set for the share `part` of the ski laid by `m`. */
  const clip = (h: Held, part: readonly [number, number], m: THREE.Matrix4): void => {
    along.setFromMatrixColumn(m, 2).normalize();
    origin.setFromMatrixPosition(m);
    const [lo, hi] = part;
    at.copy(origin).addScaledVector(along, tail + lo * spec.length);
    h.planes[0].setFromNormalAndCoplanarPoint(along, at);
    at.copy(origin).addScaledVector(along, tail + hi * spec.length);
    h.planes[1].setFromNormalAndCoplanarPoint(along.negate(), at);
    h.piece.lay(m);
    toLocal.copy(root.matrixWorld).invert().multiply(m);
    toLocal.decompose(h.caps.position, h.caps.quaternion, h.caps.scale);
    face(h.caps.children[0], lo, lo > 0);
    face(h.caps.children[1], hi, hi < 1);
  };
  const drop = (h: Held | null): void => {
    h?.piece.dispose();
    h?.caps.removeFromParent();
  };

  return {
    update(off, lies, frameOf) {
      const cuts = off?.halves?.length ?? 0;
      const anyPart = !!off && off.skis.some((s) => s.part);
      if (!off || (!cuts && !anyPart)) {
        if (kept[0] || kept[1] || halves.length) this.dispose();
        return NONE;
      }
      for (let i = 0; i < 2; i++) {
        const ski = off.skis.length === 2 ? off.skis[i] : undefined;
        cut[i] = !!ski?.part;
        if (!ski?.part) {
          drop(kept[i]);
          kept[i] = null;
          continue;
        }
        const h = (kept[i] ??= hold(i === 0 ? -1 : 1));
        clip(h, ski.part, lies[i]);
      }
      const list = off.halves ?? [];
      for (let k = 0; k < list.length; k++) {
        const ski = list[k];
        let h = halves[k];
        if (h && h.side !== ski.side) {
          drop(h);
          h = halves[k] = hold(ski.side);
        }
        h ??= halves[k] = hold(ski.side);
        clip(h, ski.part ?? [0, 1], frameOf(ski, frame));
      }
      while (halves.length > list.length) drop(halves.pop()!);
      return cut;
    },
    dispose() {
      drop(kept[0]);
      drop(kept[1]);
      kept[0] = kept[1] = null;
      for (const h of halves) drop(h);
      halves.length = 0;
    },
    destroy() {
      this.dispose();
      capGeo.dispose();
      capMat.dispose();
    },
  };
}
