// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHICH COLOUR EACH GRID SLOT RIDES IN — the body paint of the four skis,
// stated once and three-free, so the drawn skier (`skis-body.ts`) and the
// dot the minimap puts on the same skier (`minimap.tsx`) cannot disagree.
// The player's is the checkpoint-flag red; the field's three are chosen to
// be told apart at a hundred metres against white.

import { PALETTE } from "../identity.ts";

export const SKIER_BODY: readonly number[] = [
  Number.parseInt(PALETTE.flag.slice(1), 16),
  0x2a6fd6,
  0xf2bf22,
  0x22a06a,
];

/** A grid slot's body colour as CSS, wrapping past the fourth. */
export function skierCss(slot: number): string {
  return `#${SKIER_BODY[slot % SKIER_BODY.length].toString(16).padStart(6, "0")}`;
}
