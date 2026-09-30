// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED MARKS OF THE COURSE `gates.ts` draws: the checkpoint (the
// banded stake, its pennant, the marker over the owed gate) and the start
// arch, MODELLED in Blender off `GATE` and `ARCH` (`make blender
// KIND=gate`, `scripts/blender/gate.py`), committed in `pwa/models/gates/`
// by `make models` and packed by every build — unless a build is switched
// back to the code-built ones (`VITE_MODEL_GATES=0`; `model-switch.ts`).
// A file that did not load leaves its mark to the code.
//
// A MODEL CARRIES NO COLOUR: every face is a ROLE (its material's name)
// painted here — the stake's red and white, the pennant white (the game
// tints every instance, and breathes the owed gate's), the marker and the
// arch's fabric the brand red, the ballast and the blowers dark. THE ARCH
// IS MADE AT ONE REACH and stretched to the line's own by `archModel`:
// the straight span across to the plan's reach, and each leg's straight
// run down to its own foot, so the tube's round sections, the shoulders
// and everything on the feet keep their shape.

import * as THREE from "three";

import { PALETTE } from "../identity.ts";
import { GATE_IDS, type GateId } from "./gate-ids.ts";
import { modelSwitch } from "./model-switch.ts";
import { Assembly, fetchStaticModels, type StaticModel } from "./model-parts.ts";
import { ARCH, type ArchPlan } from "./start-arch.ts";

/** The build's environment — Vite's in the app; none in the suite. */
const ENV = (import.meta as { env?: Record<string, string | boolean | undefined> }).env ?? {};

/** Whether this build draws the modelled marks (ON unless turned off). */
export const GATE_MODELS = modelSwitch(ENV.VITE_MODEL_GATES);

export { GATE_IDS, type GateId };
export const GATE_PARTS = ["pole", "flag", "marker", "arch"] as const;

/** A role's colour — what `gate.py` paints a face as, by its material's
 * name. Pure, so the suite reads it. */
export function gateRoleColour(role: string): THREE.ColorRepresentation | null {
  switch (role) {
    case "red":
    case "marker":
    case "fabric":
      return PALETTE.flag;
    case "white":
      return 0xf4f6f8;
    case "flag":
      return 0xffffff;
    case "dark":
      return 0x23282e;
    default:
      return null;
  }
}

const loaded = new Map<GateId, StaticModel>();
let loading: Promise<void> | null = null;

/** Fetch both models, once (`base` where the site's `models/` is). */
export function loadGateModels(base = String(ENV.BASE_URL ?? "/")): Promise<void> {
  if (loading) return loading;
  if (!GATE_MODELS) return (loading = Promise.resolve());
  loading = fetchStaticModels(
    GATE_IDS,
    (id) => `${base}models/gates/${id}.glb`,
    (name) => (GATE_PARTS as readonly string[]).includes(name),
    loaded,
  );
  return loading;
}

/** Hand a parsed model in directly (the lab, the suite). */
export function setGateModel(id: GateId, model: StaticModel | null): void {
  if (model) loaded.set(id, model);
  else loaded.delete(id);
}

/** One dressed part of a model as a geometry, `place` moving each vertex
 * on the way in; null when the part is not there. */
function dressed(
  id: GateId,
  part: string,
  place?: (p: THREE.Vector3, n: THREE.Vector3) => void,
): THREE.BufferGeometry | null {
  const parts = loaded.get(id)?.parts.get(part);
  if (!parts?.length) return null;
  const out = new Assembly(place);
  const c = new THREE.Color();
  for (const p of parts) {
    const hex = gateRoleColour(p.role);
    if (hex !== null) out.add(p, c.set(hex).clone());
  }
  return out.vertexCount > 0 ? out.geometry() : null;
}

/** THE CHECKPOINT'S THREE PARTS, dressed, each in the frame `gates.ts`
 * instances the code's own in: the pole's foot at the origin, the
 * pennant's hoist at the origin streaming along +x, the marker about its
 * centre — or null when the model is not loaded. */
export function checkpointModel(): {
  pole: THREE.BufferGeometry;
  flag: THREE.BufferGeometry;
  marker: THREE.BufferGeometry;
} | null {
  const pole = dressed("checkpoint", "pole");
  const flag = dressed("checkpoint", "flag");
  const marker = dressed("checkpoint", "marker");
  if (!pole || !flag || !marker) {
    pole?.dispose();
    flag?.dispose();
    marker?.dispose();
    return null;
  }
  return { pole, flag, marker };
}

/** A monotone piecewise-linear map of one number through `knots`
 * (from → to), straight beyond the ends. Pure. */
export function remap(x: number, knots: readonly (readonly [number, number])[]): number {
  if (x <= knots[0][0]) return knots[0][1] + (x - knots[0][0]);
  for (let i = 1; i < knots.length; i++) {
    const [a, fa] = knots[i - 1];
    const [b, fb] = knots[i];
    if (x <= b) return fa + ((x - a) * (fb - fa)) / (b - a);
  }
  const [z, fz] = knots[knots.length - 1];
  return fz + (x - z);
}

/**
 * THE ARCH, stretched to a line's plan: in the model's frame — x the
 * skier's right across the line, z along the course, y up from the
 * HIGHER foot's ground (the world's `plan.top - ARCH.top`) — its straight
 * span drawn out to the plan's reach and each leg's straight run down to
 * that foot's own ground, everything on the foot moved down with it. The
 * caller turns it by the line's heading. Null when the model is not
 * loaded.
 */
export function archModel(plan: ArchPlan): THREE.BufferGeometry | null {
  const model = loaded.get("start-arch");
  if (!model) return null;
  const { reach: R, top, corner, foot } = model.extras;
  if (R === undefined || top === undefined || corner === undefined || foot === undefined) {
    return null;
  }
  const ground = plan.top - ARCH.top;
  // How far below the higher foot's ground each foot's own is.
  const drop = plan.feet.map((f) => ground - (f.y + ARCH.sink));
  const shoulder = top - corner;
  const across: (readonly [number, number])[] = [
    [-R, -plan.reach],
    [-(R - corner), -(plan.reach - corner)],
    [R - corner, plan.reach - corner],
    [R, plan.reach],
  ];
  return dressed("start-arch", "arch", (p) => {
    const side = p.x < 0 ? 0 : 1;
    p.x = remap(p.x, across);
    if (p.y < shoulder) {
      p.y = remap(p.y, [
        [foot - drop[side] - 1, foot - drop[side] - 1 - drop[side]],
        [foot, foot - drop[side]],
        [shoulder, shoulder],
      ]);
    }
  });
}
