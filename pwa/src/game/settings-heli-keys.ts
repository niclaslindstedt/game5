// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER'S KEYS — a table of its own beside the skier's
// (`settings-input.ts`), because flying it is another game on the same
// keyboard: four controls held at once, none of them the skier's. The input
// manager reads this table, not the skier's, while he sits on the skid
// (`input.ts`), so a key may mean one thing on the snow and another in the
// air without the two tables ever fighting over it; OPTIONS ▸ KEYS rebinds
// it on its own section, and `settings.ts` stores it as `heliKeys`.
//
// THE KEYBOARD AS IT SHIPS — a flight sim's left hand and the arrows:
//   W S      the CYCLIC fore and aft: the disc tilted forward (nose down,
//            away) and back;
//   A D      the CYCLIC side to side: the disc tilted left and right;
//   Q E      the PEDALS, nose left and right — and ← → for the hand on the
//            arrows;
//   ↑ ↓      the COLLECTIVE up and down — and SHIFT and Z beside the left
//            hand. A LEVER, not a spring: it moves while the key is held
//            and stays where it is let go.
// Off the skid — or off onto the snow where it has landed — is the skier's
// own MACHINE key (ENTER, `settings-input.ts`), the press that sat him on
// it, so it has no row here.
// Never Ctrl, which beside W closes the tab.

import type { HeliKeysHeld } from "./input-model.ts";
import { KEYS_PER_ACTION } from "./settings-input.ts";
import { STRINGS } from "./strings.ts";

export type HeliAction = keyof HeliKeysHeld;
export type HeliBindings = Record<HeliAction, readonly string[]>;

/** The rows of OPTIONS ▸ KEYS' helicopter section, in order. */
export const HELI_KEY_ACTIONS: readonly { id: HeliAction; label: string }[] = [
  { id: "collectiveUp", label: STRINGS.keyCollectiveUp },
  { id: "collectiveDown", label: STRINGS.keyCollectiveDown },
  { id: "cyclicForward", label: STRINGS.keyCyclicForward },
  { id: "cyclicBack", label: STRINGS.keyCyclicBack },
  { id: "cyclicLeft", label: STRINGS.keyCyclicLeft },
  { id: "cyclicRight", label: STRINGS.keyCyclicRight },
  { id: "pedalLeft", label: STRINGS.keyPedalLeft },
  { id: "pedalRight", label: STRINGS.keyPedalRight },
];

export const DEFAULT_HELI_KEYS: HeliBindings = {
  collectiveUp: ["ArrowUp", "ShiftLeft"],
  collectiveDown: ["ArrowDown", "KeyZ"],
  cyclicForward: ["KeyW"],
  cyclicBack: ["KeyS"],
  cyclicLeft: ["KeyA"],
  cyclicRight: ["KeyD"],
  pedalLeft: ["KeyQ", "ArrowLeft"],
  pedalRight: ["KeyE", "ArrowRight"],
};

/** The shipped bindings as lists nothing else shares. */
export function freshHeliKeys(): HeliBindings {
  const keys = {} as Record<HeliAction, string[]>;
  for (const [action, codes] of Object.entries(DEFAULT_HELI_KEYS) as [HeliAction, string[]][]) {
    keys[action] = [...codes];
  }
  return keys;
}

/** A stored blob's bindings, row by row: a row it lacks or garbles is the
 * shipped one; an action this build dropped is dropped. */
export function mergeHeliKeys(parsed: unknown): HeliBindings {
  const keys = freshHeliKeys() as Record<HeliAction, string[]>;
  if (!parsed || typeof parsed !== "object") return keys;
  const blob = parsed as Partial<Record<HeliAction, unknown>>;
  for (const action of Object.keys(keys) as HeliAction[]) {
    const codes = blob[action];
    if (!Array.isArray(codes)) continue;
    const clean = codes.filter((c): c is string => typeof c === "string" && c.length > 0);
    if (clean.length > 0) keys[action] = [...new Set(clean)].slice(0, KEYS_PER_ACTION);
  }
  return keys;
}

/** One action rebound to one key — the list replaced, as the skier's is. */
export function bindHeliKey(keys: HeliBindings, action: HeliAction, code: string): HeliBindings {
  return { ...keys, [action]: [code] };
}

/** The OTHER helicopter actions a code of this one's is on. */
export function heliClashesWith(keys: HeliBindings, action: HeliAction): HeliAction[] {
  const mine = new Set(keys[action]);
  if (mine.size === 0) return [];
  return (Object.keys(keys) as HeliAction[]).filter(
    (other) => other !== action && keys[other].some((code) => mine.has(code)),
  );
}
