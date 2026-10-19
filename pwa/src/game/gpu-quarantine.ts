// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE QUARANTINE: what the webgpu paths must not draw until it is ported
// (`gpu-backend.ts`'s register, `docs/webgpu.md`).
//
// WebGPURenderer turns a classic material into a node material and draws
// it — the standard, the basic, the points — which is most of the mountain.
// What it cannot carry is GLSL: `onBeforeCompile` is silently dropped (the
// haze, the lamps and the sun's fade with it — drawn again in nodes by
// `gpu-dress.ts`, so that much is no hole) and a `ShaderMaterial` is drawn
// as a bare node material with only a warning. Where the GLSL moves the geometry or makes the colour, the result
// is garbage on screen — the terrain without its clipmap's heights — so
// those are HIDDEN for the frame instead:
//
//   - every mesh, points or line whose material is a ShaderMaterial
//     (RawShaderMaterial is one), family `shader`;
//   - every material flagged `glslOnly(material, family)` (`gpu-backend.ts`) — a graft that
//     reshapes or repaints what it is on (`hazeMaterial` with an `extra`
//     flags `haze-graft`; the terrain, the merged models, the wingsuit and the
//     blooded tree flag their own);
//   - every object flagged the same way (`userData.glsl`), for a draw
//     three's WebGPU path cannot make at all (the woods' multi-draw).
//
// A family whose register row is ported is drawn again. Nothing here runs
// on WebGL. The walk is the visible graph's, every frame; a material's
// verdict is cached on it.

import * as THREE from "three";

import { quarantinedOn, type Backend } from "./gpu-backend.ts";
import { SLICE_OF_GROUP } from "./renderer-rider.ts";

/** The family a material's GLSL belongs to, or null for one three can draw. */
function familyOf(material: THREE.Material): string | null {
  const flag: unknown = material.userData.glsl;
  if (typeof flag === "string") return flag;
  if ((material as THREE.ShaderMaterial).isShaderMaterial) return "shader";
  return null;
}

/** Where an object hangs, for the report: its subsystem's slice, else the
 * nearest named ancestor. */
function whereOf(object: THREE.Object3D): string {
  let named = "";
  for (let o: THREE.Object3D | null = object; o; o = o.parent) {
    const slice = SLICE_OF_GROUP[o.name];
    if (slice !== undefined) return slice;
    if (!named && o.name && !(o instanceof THREE.Scene)) named = o.name;
  }
  return named || "scene";
}

export type Quarantine = {
  /** Hide every quarantined object under `scene` for the frame. */
  hide(scene: THREE.Object3D): void;
  /** Show again what `hide` hid. */
  restore(): void;
  /** What the last `hide` hid, `family:where` by count. */
  counts(): Record<string, number>;
};

export function createQuarantine(backend: Backend): Quarantine {
  const hid: THREE.Object3D[] = [];
  let counts: Record<string, number> = {};
  /** A material's verdict: its family if hidden, "" if drawn. */
  const verdicts = new WeakMap<THREE.Material, string>();
  const verdict = (m: THREE.Material): string => {
    let v = verdicts.get(m);
    if (v === undefined) {
      const family = familyOf(m);
      v = family !== null && quarantinedOn(backend, family) ? family : "";
      verdicts.set(m, v);
    }
    return v;
  };
  const visit = (o: THREE.Object3D): void => {
    let family = "";
    const own: unknown = o.userData.glsl;
    if (typeof own === "string" && quarantinedOn(backend, own)) family = own;
    const material = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!family && material) {
      if (Array.isArray(material)) {
        for (const m of material) if (!family) family = verdict(m);
      } else family = verdict(material);
    }
    if (!family) return;
    hid.push(o);
    const key = `${family}:${whereOf(o)}`;
    counts[key] = (counts[key] ?? 0) + 1;
  };
  return {
    hide(scene) {
      counts = {};
      // Gathered first, hidden after: a hidden parent's children are not
      // walked, and hiding mid-walk would not change what was walked.
      scene.traverseVisible(visit);
      for (const o of hid) o.visible = false;
    },
    restore() {
      for (const o of hid) o.visible = true;
      hid.length = 0;
    },
    counts: () => counts,
  };
}
