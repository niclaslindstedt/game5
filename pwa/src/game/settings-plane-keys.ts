// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE'S KEYS — a table of its own beside the skier's
// (`settings-input.ts`) and the helicopter's (`settings-heli-keys.ts`),
// because flying it is another game on the same keyboard: a stick, the
// pedals, a power lever and a flap lever, none of them the skier's. The
// input manager reads this table, not the skier's, while he stands in its
// door (`input.ts`); OPTIONS ▸ KEYS rebinds it on its own section, and
// `settings.ts` stores it as `planeKeys`.
//
// THE KEYBOARD AS IT SHIPS — the helicopter's hands, so a pilot of one flies
// the other: the left hand on the stick and the pedals, the arrows on the
// power —
//   W S      the STICK fore and aft: forward the nose down, back the nose up
//            (eased and scaled with the airspeed, `input-plane.ts`, so a
//            key held is a pull and never a snap into the stall);
//   A D      the STICK side to side: the ailerons, a roll that way;
//   Q E      the RUDDER PEDALS, nose left and right (the tail ski steered
//            with them on the snow) — and ← → for the hand on the arrows;
//   ↑ ↓      the POWER LEVER up and down — and SHIFT and Z beside the left
//            hand. A LEVER: it moves while the key is held and stays where
//            it is let go;
//   F V      the FLAP LEVER down a notch and up a notch;
//   SPACE    the BRAKES on the snow (the skis' claws and the propeller's
//            reverse).
// Out of the door in the air — and off it onto the snow stopped — is the
// skier's own MACHINE key (ENTER, `settings-input.ts`), so it has no row here.
// Never Ctrl, which beside W closes the tab.

import type { PlaneKeysHeld } from "./input-plane.ts";
import { KEYS_PER_ACTION } from "./settings-input.ts";
import { STRINGS } from "./strings.ts";

export type PlaneAction = keyof PlaneKeysHeld;
export type PlaneBindings = Record<PlaneAction, readonly string[]>;

/** The rows of OPTIONS ▸ KEYS' plane section, in order. */
export const PLANE_KEY_ACTIONS: readonly { id: PlaneAction; label: string }[] = [
  { id: "throttleUp", label: STRINGS.keyThrottleUp },
  { id: "throttleDown", label: STRINGS.keyThrottleDown },
  { id: "stickForward", label: STRINGS.keyStickForward },
  { id: "stickBack", label: STRINGS.keyStickBack },
  { id: "stickLeft", label: STRINGS.keyStickLeft },
  { id: "stickRight", label: STRINGS.keyStickRight },
  { id: "rudderLeft", label: STRINGS.keyRudderLeft },
  { id: "rudderRight", label: STRINGS.keyRudderRight },
  { id: "flapsDown", label: STRINGS.keyFlapsDown },
  { id: "flapsUp", label: STRINGS.keyFlapsUp },
  { id: "brake", label: STRINGS.keyPlaneBrake },
];

export const DEFAULT_PLANE_KEYS: PlaneBindings = {
  throttleUp: ["ArrowUp", "ShiftLeft"],
  throttleDown: ["ArrowDown", "KeyZ"],
  stickForward: ["KeyW"],
  stickBack: ["KeyS"],
  stickLeft: ["KeyA"],
  stickRight: ["KeyD"],
  rudderLeft: ["KeyQ", "ArrowLeft"],
  rudderRight: ["KeyE", "ArrowRight"],
  flapsDown: ["KeyF"],
  flapsUp: ["KeyV"],
  brake: ["Space"],
};

/** The shipped bindings as lists nothing else shares. */
export function freshPlaneKeys(): PlaneBindings {
  const keys = {} as Record<PlaneAction, string[]>;
  for (const [action, codes] of Object.entries(DEFAULT_PLANE_KEYS) as [PlaneAction, string[]][]) {
    keys[action] = [...codes];
  }
  return keys;
}

/** A stored blob's bindings, row by row: a row it lacks or garbles is the
 * shipped one; an action this build dropped is dropped. */
export function mergePlaneKeys(parsed: unknown): PlaneBindings {
  const keys = freshPlaneKeys() as Record<PlaneAction, string[]>;
  if (!parsed || typeof parsed !== "object") return keys;
  const blob = parsed as Partial<Record<PlaneAction, unknown>>;
  for (const action of Object.keys(keys) as PlaneAction[]) {
    const codes = blob[action];
    if (!Array.isArray(codes)) continue;
    const clean = codes.filter((c): c is string => typeof c === "string" && c.length > 0);
    if (clean.length > 0) keys[action] = [...new Set(clean)].slice(0, KEYS_PER_ACTION);
  }
  return keys;
}

/** One action rebound to one key — the list replaced, as the skier's is. */
export function bindPlaneKey(
  keys: PlaneBindings,
  action: PlaneAction,
  code: string,
): PlaneBindings {
  return { ...keys, [action]: [code] };
}

/** The OTHER plane actions a code of this one's is on. */
export function planeClashesWith(keys: PlaneBindings, action: PlaneAction): PlaneAction[] {
  const mine = new Set(keys[action]);
  if (mine.size === 0) return [];
  return (Object.keys(keys) as PlaneAction[]).filter(
    (other) => other !== action && keys[other].some((code) => mine.has(code)),
  );
}
