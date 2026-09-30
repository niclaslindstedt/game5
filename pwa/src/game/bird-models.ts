// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED BIRDS the sky draws: every species MODELLED in Blender off
// the roster's own row (`make blender KIND=bird`, `scripts/blender/bird.py`),
// committed as one glTF a species in `pwa/models/birds/` by `make models`
// and packed by every build — unless a build is switched back to the
// code-built birds (`VITE_MODEL_BIRDS=0`; `model-switch.ts`). A species
// whose file did not load is built by `bird-shapes.ts`, as every one is
// under the switch.
//
// A MODEL CARRIES NO COLOUR: every face is a ROLE (its material's name)
// and `birdModel` paints it here off the species' `BirdStyle` as the code's
// builder paints its own — the mantle, the underside, the wingtip, the
// head, the bill, the tail's two faces. Two meshes: `body`, and `wing`,
// whose every vertex is tagged `aWing` for the hinges `birdMaterial` grafts
// into the shader — the model is flapped and folded exactly as the code's
// bird is, off the same `birdPose`.

import * as THREE from "three";

import { BIRD_IDS, type BirdId, type BirdSpec } from "./bird-defs.ts";
import type { BirdStyle } from "./bird-shapes.ts";
import { modelSwitch } from "./model-switch.ts";
import { Assembly, fetchStaticModels, type StaticModel } from "./model-parts.ts";

/** The build's environment — Vite's in the app; none in the suite. */
const ENV = (import.meta as { env?: Record<string, string | boolean | undefined> }).env ?? {};

/** Whether this build draws the modelled birds (ON unless turned off). */
export const BIRD_MODELS = modelSwitch(ENV.VITE_MODEL_BIRDS);

/** The parts of a bird's model, by name. */
export const BIRD_PARTS = ["body", "wing"] as const;

/** A role's colour in a species' style — what `bird.py` paints a face as,
 * by its material's name. Pure, so the suite reads it. */
export function birdRoleColour(role: string, s: BirdStyle): number | null {
  switch (role) {
    case "back":
      return s.back;
    case "belly":
      return s.belly;
    case "tip":
      return s.tip;
    case "head":
      return s.head;
    case "bill":
      return s.bill;
    case "tail":
      return s.tail ?? s.back;
    case "tail_under":
      return s.tail ?? s.belly;
    default:
      return null;
  }
}

const loaded = new Map<BirdId, StaticModel>();
let loading: Promise<void> | null = null;

/** Fetch every species' model, once (`base` where the site's `models/`
 * is). */
export function loadBirdModels(base = String(ENV.BASE_URL ?? "/")): Promise<void> {
  if (loading) return loading;
  if (!BIRD_MODELS) return (loading = Promise.resolve());
  loading = fetchStaticModels(
    BIRD_IDS,
    (id) => `${base}models/birds/${id}.glb`,
    (name) => (BIRD_PARTS as readonly string[]).includes(name),
    loaded,
  );
  return loading;
}

/** Hand a species' parsed model in directly (the lab, the suite). */
export function setBirdModel(id: BirdId, model: StaticModel | null): void {
  if (model) loaded.set(id, model);
  else loaded.delete(id);
}

/**
 * ONE SPECIES' MODEL, dressed: in the game's metres, shoulders at the
 * origin and the bill toward +z, vertex-coloured in `style`, its wing
 * vertices tagged `aWing` — or null when the species has no model loaded
 * (the code's builder draws it).
 */
export function birdModel(spec: BirdSpec, style: BirdStyle): THREE.BufferGeometry | null {
  const model = loaded.get(spec.id);
  if (!model) return null;
  const out = new Assembly();
  const c = new THREE.Color();
  for (const name of BIRD_PARTS) {
    for (const part of model.parts.get(name) ?? []) {
      const hex = birdRoleColour(part.role, style);
      if (hex === null) continue;
      out.add(part, c.setHex(hex).clone(), undefined, { aWing: name === "wing" ? 1 : 0 });
    }
  }
  return out.vertexCount > 0 ? out.geometry() : null;
}
