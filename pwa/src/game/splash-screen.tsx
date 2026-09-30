// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ATTRACT SCREEN the app opens on, played like an arcade cabinet's.
//
// Beat one, while the game loads: the publisher's name and PRESENTS, drawn in
// the menu's own type over the same sky the game is painted in, so the card
// lifting reads as the menu arriving rather than as a screen change.
//
// Beat two, the moment the game is standing, is a HAND-OVER rather than a
// cut: the house's lockup walks up out of the middle of the card to make room,
// the app's own trails arrive in the space it left, lay themselves, POWDER
// RUN rises under it, and only then does the card ask for a press. Then it
// waits.
// Nothing lifts it on a timer — see `splash.ts` for why the press is worth
// waiting for.
//
// It is a COVER, not a stage. The whole app mounts underneath it and does its
// entire arrival behind it — the renderer, the generator, a whole mountain
// with a piste laid down it, and the field getting off the start line. That is what
// beat one is buying.
//
// Presses are swallowed for exactly that reason: the menu is LIVE under
// there, and a press meant for the card must never reach the row the finger
// happens to land on.
//
// The timing rules it obeys live in `splash.ts` and are tested there.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";

import { APP_NAME, PUBLISHER } from "../identity.ts";
import { MarkTrails } from "./mark-trails.tsx";
import { SPLASH_MIN_MS, SPLASH_STUCK_MS, splashReady } from "./splash.ts";
import { STRINGS } from "./strings.ts";

/** How long the card takes to fade out of the way. Must match the
 * `.splash.leaving` transition in styles.css. */
const FADE_MS = 340;

/** How long the house's lockup takes to walk from the middle of the card to
 * its place above the title, and the curve it walks on — the same one the
 * mark's own wipe uses, so the two halves of the hand-over are paced alike.
 * Beat two's block is on screen but blank for exactly this long. */
const LIFT_MS = 420;
const LIFT_EASING = "cubic-bezier(0.33, 0, 0.2, 1)";

/** Keys that are not "a key" to a player holding one down to reach another. */
const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "OS"]);

/** Where the card is in its life. `loading` is beat one, with nothing on the
 * screen but the house's name and the ring turning in the corner. `lifting`
 * is the hand-over: beat two's block has taken its place in the layout but
 * nothing is drawn in it yet, and the lockup is walking up to sit above it.
 * `ready` is beat two proper — the trails arriving, laying themselves, the name
 * rising under it and the prompt asking. `done` is the card leaving. */
type CardPhase = "loading" | "lifting" | "ready" | "done";

/** What the card asks for, in the words of the device it is being read on. A
 * phone has no key to press, and telling it to press one is the kind of
 * detail that makes a game feel ported rather than made. */
function startPrompt(): string {
  return window.matchMedia?.("(pointer: coarse)").matches ? STRINGS.splashTap : STRINGS.splashPress;
}

export function SplashScreen({ warm, onDone }: { warm: boolean; onDone: () => void }) {
  const [phase, setPhase] = useState<CardPhase>("loading");
  const [prompt] = useState(startPrompt);
  const [stillness] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );

  // The lockup, and where it sat in beat one. The rect is stamped in the last
  // frame before beat two's block lands in the layout under it, because that
  // is the only moment the distance it is about to travel can be measured.
  const cardRef = useRef<HTMLDivElement>(null);
  const liftFrom = useRef(0);

  // The card's own age, stamped on mount. A ref rather than state: nothing
  // re-renders on it, and it has to survive the re-render `warm` causes.
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = performance.now();
  }, []);

  // `onDone` is a fresh closure every parent render; hold it in a ref so the
  // fade-out timer is armed once instead of restarted on each one.
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  // BEAT ONE → BEAT TWO. Readiness answers to the clock AND to the load, so
  // this re-checks on each `warm` change and at each of the two moments the
  // clock alone could change the answer: the minimum, and the dead man's
  // handle that opens the card up on a boot that never reported in.
  useEffect(() => {
    if (phase !== "loading") return;
    let timer = 0;
    const check = (): void => {
      const elapsed = performance.now() - startedAt.current;
      if (splashReady(elapsed, warm)) {
        liftFrom.current = cardRef.current?.getBoundingClientRect().top ?? 0;
        // Asked to hold still, the card hands over in one step: there is no
        // travel to watch, and a block sitting blank for the length of one
        // would read as a card that had stalled.
        setPhase(stillness ? "ready" : "lifting");
        return;
      }
      const next = elapsed < SPLASH_MIN_MS ? SPLASH_MIN_MS : SPLASH_STUCK_MS;
      timer = window.setTimeout(check, Math.max(0, next - elapsed));
    };
    check();
    return () => window.clearTimeout(timer);
  }, [phase, stillness, warm]);

  // THE TRAVEL, and the only motion on this card the stylesheet cannot own:
  // how far the lockup has to go is the height of a block that did not exist
  // a frame ago, so it is measured here. It is walked on a TRANSFORM all the
  // same — the compositor's, like every other moving thing in the app — and
  // it is a layout effect because the lockup must never be PAINTED at its new
  // place before the animation that walks it there is on it.
  useLayoutEffect(() => {
    if (phase !== "lifting") return;
    const card = cardRef.current;
    card?.animate(
      [
        { transform: `translateY(${liftFrom.current - card.getBoundingClientRect().top}px)` },
        { transform: "none" },
      ],
      { duration: LIFT_MS, easing: LIFT_EASING },
    );
    const timer = window.setTimeout(() => setPhase("ready"), LIFT_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // Cleared: fade, then let the parent unmount us.
  useEffect(() => {
    if (phase !== "done") return;
    const timer = window.setTimeout(() => doneRef.current(), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // MAY THIS PRESS CLEAR THE CARD — asked of the CLOCK, never of `phase`.
  // The two agree only on an idle main thread, and the card exists for the
  // launch where the main thread is anything but: a whole mountain's
  // geometry is being built. Both the timer that promotes `loading` → `ready` and the
  // press itself are macrotasks queued behind that work, so they arrive
  // together when it lets go — and a `dismiss` closing over `phase` would
  // read the render BEFORE the timer's state update landed and drop the press
  // on the floor, on exactly the device the card was added for. `startedAt`
  // is a ref and `performance.now()` owes nothing to the renderer.
  const dismiss = useCallback(() => {
    if (!splashReady(performance.now() - startedAt.current, warm)) return;
    setPhase("done");
  }, [warm]);

  // EVERY KEY IS EATEN WHILE THE CARD IS UP, on `window` in the CAPTURE phase
  // because that is the only place upstream of the input manager the live
  // game underneath has already installed. Without it, the key that clears
  // the card also rides the skis behind it.
  //
  // It keeps eating them through the fade-out too, so a second impatient
  // press cannot land on the menu coming up underneath.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      event.stopPropagation();
      if (MODIFIER_KEYS.has(event.key)) return;
      // A browser shortcut on its way past (reload, devtools, tab switch) is
      // not a press on the card.
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      dismiss();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [dismiss]);

  // Beat two's block is in the LAYOUT from the moment the hand-over starts —
  // its space is what the lockup is travelling to, so it has to be reserved
  // before the travel begins — and blank until the travel lands.
  const staged = phase === "lifting" || phase === "ready";
  return (
    <div
      class={`splash${phase === "done" ? " leaving" : ""}`}
      // A pointer press lands here rather than on the menu: the card covers
      // the screen, so nothing has to be swallowed for it.
      onPointerDown={dismiss}
      // ...and a CLICK, which is the only press a controller can synthesise
      // (menu-nav.ts). `dismiss` is idempotent.
      onClick={dismiss}
      role="presentation"
    >
      <div class="splash-card" ref={cardRef}>
        <span class="splash-publisher">{PUBLISHER.toUpperCase()}</span>
        <span class="splash-presents">{STRINGS.splashPresents}</span>
      </div>
      {/* Beat two, mounted when it arrives rather than held invisible above
          the fold through beat one. Reserving its space that early would keep
          the house's name still, and buy that with a hole in the middle of
          beat one. The card lifting the publisher to make room for its own
          title is what an attract screen does — and `held` is that lift in
          progress: the space taken, the drawing in it not started. */}
      {staged && (
        <div class={`splash-title${phase === "lifting" ? " held" : ""}`}>
          <MarkTrails lay="once" className="splash-mark" />
          <span class="splash-game">{APP_NAME.toUpperCase()}</span>
        </div>
      )}
      {/* THE TWO BEATS SAY DIFFERENT KINDS OF THING, so they are not one slot.
          Beat two's invitation is the only thing on the card the player has to
          act on, and it belongs under the title where they were already
          looking. Beat one has nothing to report but that work is happening —
          a fact worth a corner, not a headline — so it is said the way a
          console says it: a small ring turning in the bottom right, out of the
          lockup's way, claiming no fraction and asking for nothing. */}
      {phase === "ready" && <span class="splash-prompt">{prompt}</span>}
      {phase === "loading" && (
        <span class="splash-spinner" role="img" aria-label={STRINGS.loading} />
      )}
    </div>
  );
}
