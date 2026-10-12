// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BACKDROP HELD STILL: a card whose own picture is being handled — the
// free ride's world map under a pinch or a drag — asks the title stage
// behind it to stop drawing until the hands let go, so a phone's GPU spends
// those frames on the map rather than on a scene the card covers. The stage
// keeps its last frame on the screen; nothing else reads this.

let holds = 0;

/** Ask for the backdrop held (`true`), or give that ask back (`false`). */
export function holdBackdrop(on: boolean): void {
  holds = Math.max(0, holds + (on ? 1 : -1));
}

/** Whether anything is holding the backdrop still. */
export function backdropHeld(): boolean {
  return holds > 0;
}
