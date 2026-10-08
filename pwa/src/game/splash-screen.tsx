// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ATTRACT SCREEN the app opens on, played like a console title's.
//
// Beat one, while the title scene comes down the wire: the publisher's name
// and PRESENTS, small and quiet on the dark. The scene (`title-stage.tsx`) is
// mounting underneath and draws its first frame black.
//
// Beat two, the REVEAL (`revealAt`): the house's name fades, the card goes
// clear, the scene's exposure comes up out of the black with the lens
// pushing in, and over it the logo reveals itself — the peak, the carve
// drawn down it, the name swept on and cut — and then the invitation.
// Beat three: the invitation breathes, and the card waits. A press flashes
// it, hands the screen to the front door (`onPress`, so the door mounts
// under the card), and FLIES the logo from the title into the door's header
// (a FLIP: both boxes measured, the move a transform) while everything else
// on the card fades; then the card is gone (`onDone`). Nothing lifts it on
// a timer — see `splash.ts` for why the press is worth waiting for.
//
// Presses are swallowed: the menu is mounted under the card the moment it is
// pressed, and a press meant for the card must never reach the row the
// finger happens to land on.
//
// The timing rules it obeys live in `splash.ts` and are tested there.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";

import { PUBLISHER } from "../identity.ts";
import { SPLASH_MIN_MS, SPLASH_STUCK_MS, revealAt, splashReady } from "./splash.ts";
import { STRINGS } from "./strings.ts";
import { TitleLogo } from "./title-logo.tsx";
import { TITLE_BEATS } from "./title-plan.ts";

/** Keys that are not "a key" to a player holding one down to reach another. */
const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "OS"]);
/** The curve the logo flies into the door's header on. */
const FLIP_EASING = "cubic-bezier(0.2, 0.8, 0.2, 1)";
/** A click this soon after a pointerdown is the same tap's tail, not a press. */
const TAP_TAIL_MS = 700;

/** Where the card is in its life: the house's name on the dark, the reveal,
 * the invitation waiting, and the card leaving. */
type CardPhase = "loading" | "reveal" | "ready" | "done";

/** What the card asks for, in the words of the device it is being read on. A
 * phone has no key to press, and telling it to press one is the kind of
 * detail that makes a game feel ported rather than made. */
function startPrompt(): string {
  return window.matchMedia?.("(pointer: coarse)").matches ? STRINGS.splashTap : STRINGS.splashPress;
}

export function SplashScreen({
  warm,
  onReveal,
  onPress,
  onDone,
  frozenMs = null,
}: {
  /** What the card reveals has drawn its first frame. */
  warm: boolean;
  /** The reveal has begun: the scene's clock starts. */
  onReveal: () => void;
  /** Pressed: the front door may mount under the card. */
  onPress: () => void;
  /** The card has finished leaving. */
  onDone: () => void;
  /** A lab's frozen title time, ms (`?titleT=`): the reveal is held at it,
   * every animation on the card parked at that moment, so the card and the
   * scene under it are one frame of the same instant. */
  frozenMs?: number | null;
}) {
  const [phase, setPhaseState] = useState<CardPhase>("loading");
  const phaseRef = useRef<CardPhase>("loading");
  const setPhase = (next: CardPhase): void => {
    phaseRef.current = next;
    setPhaseState(next);
  };
  const [prompt] = useState(startPrompt);
  const [stillness] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );
  /** How far the reveal is: re-rendered at each of its beats. */
  const [beat, setBeat] = useState(revealAt(0));
  const [skipped, setSkipped] = useState(false);
  const logoRef = useRef<HTMLDivElement>(null);
  const tapAt = useRef(-Infinity);

  // The card's own age, stamped on mount. A ref rather than state: nothing
  // re-renders on it, and it has to survive the re-render `warm` causes.
  const startedAt = useRef(0);
  const revealedAt = useRef(0);
  useEffect(() => {
    startedAt.current = performance.now();
  }, []);

  // Callbacks are fresh closures every parent render; held in refs so the
  // timers below are armed once instead of restarted on each one.
  const calls = useRef({ onReveal, onPress, onDone });
  calls.current = { onReveal, onPress, onDone };

  const beginReveal = useCallback(
    (skip: boolean): void => {
      revealedAt.current = performance.now();
      calls.current.onReveal();
      if (frozenMs !== null) {
        const held = revealAt(frozenMs);
        setBeat(held);
        setPhase(held.prompt ? "ready" : "reveal");
        return;
      }
      setSkipped(skip || stillness);
      setBeat(revealAt(0, skip || stillness));
      setPhase(skip || stillness ? "ready" : "reveal");
    },
    [stillness, frozenMs],
  );

  // A FROZEN FRAME: every animation on the card parked at the held time,
  // counted from when its element arrived (the logo at its beat, the
  // invitation at its own).
  useLayoutEffect(() => {
    if (frozenMs === null || phase === "loading" || phase === "done") return;
    for (const a of document.getAnimations()) {
      const target = (a.effect as KeyframeEffect | null)?.target;
      if (!(target instanceof Element) || !target.closest(".splash")) continue;
      const from = target.closest(".splash-title")
        ? TITLE_BEATS.logo
        : target.closest(".splash-prompt")
          ? TITLE_BEATS.prompt
          : 0;
      a.pause();
      a.currentTime = Math.max(0, frozenMs - from);
    }
  });

  // BEAT ONE → THE REVEAL. Readiness answers to the clock AND to the load, so
  // this re-checks on each `warm` change and at each of the two moments the
  // clock alone could change the answer: the minimum, and the dead man's
  // handle that opens the card up on a boot that never reported in.
  useEffect(() => {
    if (phase !== "loading") return;
    let timer = 0;
    const check = (): void => {
      const elapsed = performance.now() - startedAt.current;
      if (splashReady(elapsed, warm)) return beginReveal(false);
      const next = elapsed < SPLASH_MIN_MS ? SPLASH_MIN_MS : SPLASH_STUCK_MS;
      timer = window.setTimeout(check, Math.max(0, next - elapsed));
    };
    check();
    return () => window.clearTimeout(timer);
  }, [phase, warm, beginReveal]);

  // THE REVEAL'S BEATS: the house's name off, the logo on, the invitation.
  useEffect(() => {
    if (phase !== "reveal" || frozenMs !== null) return;
    const timers = [TITLE_BEATS.publisherOut, TITLE_BEATS.logo, TITLE_BEATS.prompt].map((at) =>
      window.setTimeout(() => {
        const next = revealAt(performance.now() - revealedAt.current);
        setBeat(next);
        if (next.prompt && phaseRef.current === "reveal") setPhase("ready");
      }, at),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [phase, frozenMs]);

  // THE FLIP into the front door's header, the frame after the door mounts:
  // the logo is moved by a transform from its own box to the header's (its
  // height to the header's height, centre to centre) and fades as it lands,
  // the header's own logo held hidden under it until then (`title.css`).
  useLayoutEffect(() => {
    if (phase !== "done") return;
    const root = document.documentElement;
    root.dataset.titleFlip = "1";
    let anim: Animation | null = null;
    const raf = requestAnimationFrame(() => {
      const from = logoRef.current?.getBoundingClientRect();
      const to = document.querySelector(".menu-brand .title-logo")?.getBoundingClientRect();
      if (!from || !to || stillness) return;
      const s = to.height / from.height;
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height / 2);
      anim =
        logoRef.current?.animate(
          [
            { transform: "none", opacity: 1 },
            { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 1, offset: 0.7 },
            { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0 },
          ],
          { duration: TITLE_BEATS.flip, easing: FLIP_EASING, fill: "forwards" },
        ) ?? null;
    });
    const timer = window.setTimeout(() => {
      delete root.dataset.titleFlip;
      calls.current.onDone();
    }, TITLE_BEATS.flip);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      anim?.cancel();
      delete root.dataset.titleFlip;
    };
  }, [phase, stillness]);

  // A PRESS, asked of the CLOCK as well as the phase: a press and the timer
  // that would have promoted the card can arrive together off a busy main
  // thread, so a card still `loading` whose clock says ready is revealed —
  // skipped straight to its end — rather than the press dropped. During the
  // reveal a press finishes it; once it is ready, a press enters.
  const press = useCallback(() => {
    const p = phaseRef.current;
    if (p === "done") return;
    if (p === "loading") {
      if (splashReady(performance.now() - startedAt.current, warm)) beginReveal(true);
      return;
    }
    if (p === "reveal") {
      setSkipped(true);
      setBeat(revealAt(0, true));
      setPhase("ready");
      return;
    }
    setPhase("done");
    calls.current.onPress();
  }, [warm, beginReveal]);

  // EVERY KEY IS EATEN WHILE THE CARD IS UP, on `window` in the CAPTURE phase
  // because that is the only place upstream of the input manager the live
  // game underneath has already installed. It keeps eating them through the
  // flight too, so a second impatient press cannot land on the menu.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      event.stopPropagation();
      if (MODIFIER_KEYS.has(event.key)) return;
      // A browser shortcut on its way past (reload, devtools, tab switch) is
      // not a press on the card.
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      if (!event.repeat) press();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [press]);

  const revealed = phase !== "loading";
  return (
    <div
      class="splash"
      data-phase={phase}
      // A pointer press lands here rather than on the menu: the card covers
      // the screen, so nothing has to be swallowed for it.
      onPointerDown={() => {
        tapAt.current = performance.now();
        press();
      }}
      // ...and a CLICK, which is the only press a controller can synthesise
      // (menu-nav.ts) — unless it is the tail of the tap just taken.
      onClick={() => {
        if (performance.now() - tapAt.current > TAP_TAIL_MS) press();
      }}
      role="presentation"
    >
      {(!revealed || beat.publisher) && (
        <div class={`splash-card${revealed ? " leaving" : ""}`}>
          <span class="splash-publisher">{PUBLISHER.toUpperCase()}</span>
          <span class="splash-presents">{STRINGS.splashPresents}</span>
        </div>
      )}
      {revealed && beat.logo && (
        <div class="splash-title" ref={logoRef}>
          <TitleLogo lockup="stacked" reveal={!skipped} className="splash-logo" />
        </div>
      )}
      {/* THE TWO BEATS SAY DIFFERENT KINDS OF THING, so they are not one slot.
          The invitation is the only thing on the card the player has to act
          on, and it sits low and central where the eye comes to rest. Beat
          one has nothing to report but that work is happening — a fact worth
          a corner, not a headline: a small ring turning in the bottom right. */}
      {revealed && beat.prompt && (
        <span class={`splash-prompt${phase === "done" ? " flash" : ""}`}>{prompt}</span>
      )}
      {phase === "loading" && (
        <span class="splash-spinner" role="img" aria-label={STRINGS.loading} />
      )}
    </div>
  );
}
