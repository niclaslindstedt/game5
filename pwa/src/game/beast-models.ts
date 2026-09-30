// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED ANIMALS the snow draws: every species MODELLED in Blender
// off the roster's own row and its style (`make blender KIND=beast`,
// `scripts/blender/beast.py`), committed as one glTF a species in
// `pwa/models/beasts/` by `make models` and packed by every build — unless
// a build is switched back to the code-built animals (`VITE_MODEL_BEASTS=0`;
// `model-switch.ts`). A species whose file did not load is built by
// `beast-shapes.ts`, as every one is under the switch.
//
// A MODEL CARRIES NO COLOUR: every face is a ROLE (its material's name)
// and `beastModel` paints it here off the species' `BeastStyle` as the
// code's builder paints its own. Seven meshes, one a PART the shader
// moves: the body; the head (with the neck, the ears and the antlers or
// horns — everything that goes down to graze, tagged `aHead`); the four
// legs, each tagged `aLeg` with its place in the gait (`LEG_PHASE`, the
// code's own) and `aHip` with the hip it swings from (the root's `hip`);
// the tail. The head's pivot is the root's too, so `beastMaterial` grafts
// the same swing and graze over the model as over the code's animal.

import * as THREE from "three";

import { BEAST_IDS, type BeastId, type BeastSpec } from "./beast-defs.ts";
import { LEG_PHASE, type BeastStyle } from "./beast-shapes.ts";
import { modelSwitch } from "./model-switch.ts";
import { Assembly, fetchStaticModels, type StaticModel } from "./model-parts.ts";

/** The build's environment — Vite's in the app; none in the suite. */
const ENV = (import.meta as { env?: Record<string, string | boolean | undefined> }).env ?? {};

/** Whether this build draws the modelled animals (ON unless turned off). */
export const BEAST_MODELS = modelSwitch(ENV.VITE_MODEL_BEASTS);

/** The parts of an animal's model, by name; the legs in `LEG_PHASE`'s
 * order — left fore, right fore, left hind, right hind. */
export const BEAST_LEGS = ["leg_lf", "leg_rf", "leg_lh", "leg_rh"] as const;
export const BEAST_PARTS = ["body", "head", ...BEAST_LEGS, "tail"] as const;

/** A role's colour in a species' style — what `beast.py` paints a face
 * as, by its material's name. Pure, so the suite reads it. */
export function beastRoleColour(role: string, s: BeastStyle): number | null {
  switch (role) {
    case "coat":
      return s.coat;
    case "belly":
      return s.belly;
    case "legs":
      return s.legs;
    case "head":
      return s.head;
    case "ears":
      return s.ears;
    case "tail":
      return s.tail;
    case "tailtip":
      return s.tailTip ?? s.tail;
    case "antlers":
      return s.antlers ?? null;
    case "horns":
      return s.horns?.color ?? null;
    default:
      return null;
  }
}

const loaded = new Map<BeastId, StaticModel>();
let loading: Promise<void> | null = null;

/** Fetch every species' model, once (`base` where the site's `models/`
 * is). */
export function loadBeastModels(base = String(ENV.BASE_URL ?? "/")): Promise<void> {
  if (loading) return loading;
  if (!BEAST_MODELS) return (loading = Promise.resolve());
  loading = fetchStaticModels(
    BEAST_IDS,
    (id) => `${base}models/beasts/${id}.glb`,
    (name) => (BEAST_PARTS as readonly string[]).includes(name),
    loaded,
  );
  return loading;
}

/** Hand a species' parsed model in directly (the lab, the suite). */
export function setBeastModel(id: BeastId, model: StaticModel | null): void {
  if (model) loaded.set(id, model);
  else loaded.delete(id);
}

/**
 * ONE SPECIES' MODEL, dressed: in the game's metres, standing on y = 0
 * with its nose toward +z, vertex-coloured in `style`, every vertex tagged
 * for the shader, and the pivot the head grazes about — or null when the
 * species has no model loaded (the code's builder draws it).
 */
export function beastModel(
  spec: BeastSpec,
  style: BeastStyle,
): { geometry: THREE.BufferGeometry; pivot: { y: number; z: number } } | null {
  const model = loaded.get(spec.id);
  if (!model) return null;
  const { hip, pivotUp, pivotFwd } = model.extras;
  if (hip === undefined || pivotUp === undefined || pivotFwd === undefined) return null;
  const phase = LEG_PHASE[spec.gait];
  const out = new Assembly();
  const c = new THREE.Color();
  for (const name of BEAST_PARTS) {
    const leg = (BEAST_LEGS as readonly string[]).indexOf(name);
    const tags = {
      aLeg: leg >= 0 ? 1 + phase[leg] : 0,
      aHip: leg >= 0 ? hip : 0,
      aHead: name === "head" ? 1 : 0,
    };
    for (const part of model.parts.get(name) ?? []) {
      const hex = beastRoleColour(part.role, style);
      if (hex === null) continue;
      out.add(part, c.setHex(hex).clone(), undefined, tags);
    }
  }
  if (out.vertexCount === 0) return null;
  return { geometry: out.geometry(), pivot: { y: pivotUp, z: pivotFwd } };
}
