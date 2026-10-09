// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A BUILDING'S DOOR AS THE HUD READS IT (`snapshot.ts`'s `door`), DOM-free:
// stood before a door on a free ride where the machine press opens it
// (`doorway.ts`'s `doorNear`) — or, held open, shuts it — the call that
// says so; nothing while he is going through one.

import { doorNear, leafShare, activeLeaf, type GameState } from "@engine";

/** The call: the door's kind, and whether the press would shut it (one
 * standing open) rather than open it. */
export type HudDoor = { kind: string; shut: boolean };

export function doorCallOf(state: GameState): HudDoor | null {
  if (state.doorway?.move) return null;
  const door = doorNear(state);
  if (!door) return null;
  const open = leafShare(state, door.id, activeLeaf(door)) > 0.5;
  return { kind: door.kind, shut: open };
}
