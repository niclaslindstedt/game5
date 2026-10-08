// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ATTRACT SCREEN — the policy behind `splash-screen.tsx`: when the title
// may appear, how its reveal is paced, when a press may clear the card, and
// when the app is being driven by something that must not see a card at all.
//
// It plays like a console title, in three beats. First the house's name on
// the dark while the title scene comes down the wire and draws its first
// frame (`title-stage.tsx`). Then the REVEAL: the house's name goes, the
// scene's exposure comes up out of the black with the lens pushing in, the
// logo reveals itself over it and the invitation arrives. Then the card
// waits for a press, breathing — however long that takes. Nothing lifts the
// card on a timer: the press is the point, and it buys two things a timer
// cannot. The player enters the menu when THEY are ready, and the gesture
// that enters is also the one a browser wants before it will let a game make
// a sound.
//
// Kept apart from the component so the timing rules are testable without a
// renderer (`tests/menu_system_test.ts`), which is also why this module takes the
// query string as an argument instead of reading `location` itself.

import { TITLE_BEATS } from "./title-plan.ts";

/**
 * How long the card is held before ANY press can clear it, and before the
 * title may arrive. Short enough not to stand between a player and the menu,
 * long enough that the house's name is read rather than glimpsed — and it
 * doubles as the guard against the press that launched the app (a tap that
 * opened the PWA) arriving as the press that dismisses the card.
 */
export const SPLASH_MIN_MS = 1000;

/**
 * The dead man's handle. Past this, the card opens up whether or not the game
 * ever reported itself ready — a boot that has taken this long has gone wrong
 * in a way the card cannot fix (a chunk that never landed, a context the GPU
 * refused), and trapping the player on a screen that will never invite them
 * in is worse than letting them through to a menu that may be half-built.
 */
export const SPLASH_STUCK_MS = 20000;

/**
 * True once the card may show the title and take a press, given how long it
 * has been up and whether what it reveals is `warm` — the title scene's first
 * frame drawn, or (over the live race a link may ask for) the world's.
 *
 * **THE READY STATE WAITS FOR THE LOAD.** A card that invited a press while
 * the scene was still on its way would hand the player exactly the empty
 * screen it was added to hide, so a slow device stays on the house's name
 * instead. That is the whole reason the card exists — and it is why nothing
 * here can be answered by the clock alone, {@link SPLASH_STUCK_MS} aside.
 */
export function splashReady(elapsedMs: number, warm: boolean): boolean {
  if (elapsedMs < SPLASH_MIN_MS) return false;
  return warm || elapsedMs >= SPLASH_STUCK_MS;
}

/**
 * True when the app is being DRIVEN and no card belongs in front of it: the
 * screenshot tool and a link into a race (`?start=slalom`, `?shot=1`,
 * `?paused=1`) want the game, not the house's name, and a link that names
 * the front door (`?menu=`) wants the door. `?splash=1` forces it back for
 * looking at the card itself; `?splash=0` clears it off an ordinary visit.
 */
export function splashSkipped(search: string): boolean {
  const params = new URLSearchParams(search);
  if (params.get("splash") === "1") return false;
  if (params.get("splash") === "0") return true;
  return (
    params.get("start") !== null ||
    params.get("shot") === "1" ||
    params.get("paused") === "1" ||
    params.get("menu") !== null
  );
}

/** Where the reveal stands `ms` after it began: whether the house's name is
 * still up, whether the logo has arrived (and plays its own reveal from
 * there, `title.css`), and whether the invitation is up — which is also
 * when the card is READY. A press during the reveal skips it (`skipped`):
 * everything stands finished at once. */
export function revealAt(
  ms: number,
  skipped = false,
): { publisher: boolean; logo: boolean; prompt: boolean } {
  if (skipped) return { publisher: false, logo: true, prompt: true };
  return {
    publisher: ms < TITLE_BEATS.publisherOut,
    logo: ms >= TITLE_BEATS.logo,
    prompt: ms >= TITLE_BEATS.prompt,
  };
}
