// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BACKDROP HELD STILL: a card whose own picture is being handled — the
// free ride's world map under a pinch or a drag — or one whose picture
// covers the whole screen — the rider and gear cards' stage — asks what is
// behind it (the title stage, and the race the app draws under every card)
// to stop drawing until it lets go, so a phone's GPU and processor spend
// those frames on the picture in the player's hands rather than on a scene
// nobody can see. Each keeps its last frame on the screen; the race behind
// is still raced, only not drawn.

let holds = 0;

/** Ask for the backdrop held (`true`), or give that ask back (`false`). */
export function holdBackdrop(on: boolean): void {
  holds = Math.max(0, holds + (on ? 1 : -1));
}

/** Whether anything is holding the backdrop still. */
export function backdropHeld(): boolean {
  return holds > 0;
}

/** HANDS ON THE PICTURE: a finger or a button held down on a card's own
 * picture (the rider turned round on the gear stage). Work stood up behind
 * the cards ahead of a ride (`free-stage.ts`, the world's renderer building
 * cold) waits between its pieces while it is held — and for a moment after
 * it is lifted, or after the picture is first shown, since a player turns
 * the rider in flicks and reaches for him as the card opens — so the frames
 * under the player's hand are never the ones a heavy piece lands on. */
let hands = 0;
/** When a hand was last lifted, or the picture last shown, ms. */
let stirred = -Infinity;
/** How long the picture stays held after a hand is lifted or it is shown, ms. */
const QUIET_MS = 900;

const now = (): number => (typeof performance === "undefined" ? 0 : performance.now());

/** A hand down on the picture (`true`), or lifted (`false`). */
export function holdHands(on: boolean): void {
  if (!on && hands > 0) stirred = now();
  hands = Math.max(0, hands + (on ? 1 : -1));
}

/** The picture has just come up under the player: hold off as if a hand
 * had just been lifted from it. */
export function stirHands(): void {
  stirred = now();
}

/** Whether a hand is down on a card's picture, or was a moment ago. */
export function handsHeld(): boolean {
  return hands > 0 || now() - stirred < QUIET_MS;
}

/** Resolves once no hand is down, looking every `ms` — at once when none is. */
export function handsFree(ms = 120): Promise<void> {
  return new Promise((done) => {
    const look = (): void => {
      if (handsHeld()) setTimeout(look, ms);
      else done();
    };
    look();
  });
}
