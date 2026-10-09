// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REPLAY BAR — the transport over a recording being watched
// (`replay-run.ts`).
//
// A REPLAY IS THE GAME'S OWN FRAMES: the same map, the same skis, the same
// physics, ridden off the controls the run was ridden on. So there is nothing
// to add to the HUD — the clock, the place, the gates and the map read the
// recording exactly as they read the run, because it IS the run — and what a
// WATCHER has that a skier does not is a player's transport: where in the
// run the picture is and where it can go, how fast, from which camera, and
// the way back.
//
// LAID OUT AS EVERY VIDEO PLAYER IS, because that is the instrument every
// player already knows how to work: a SCRUBBER the width of the bar, the
// time either side of it and the run's moments marked along it (a flight, a
// pass, a crash, the flag — the director's running order, `replay-shots.ts`),
// and under it the transport — from the start, back five seconds, play and
// pause, forward five, the speed — with the camera and the way out to the
// right. Dragged, the scrubber shows where it will land and seeks on the
// release: a seek is the engine stepped from a keyframe, and a seek on every
// pixel of a drag would be paid for on every pixel.
//
// BOTTOM CENTRE, where the thumbs would be: nobody is steering a replay, so
// the thumb zones are down and the bar takes their place, clear of the clock
// and the chips along the top. WHILE IT PLAYS AND NOBODY TOUCHES ANYTHING it
// steps out of the picture after a few seconds and leaves a hairline of
// progress along the bottom edge — the run is what is being watched, not the
// bar — and comes back on any move of the pointer, any touch, any key.
//
// THE KEYS are a player's: SPACE plays and pauses, the arrows skip and change
// speed, the comma and the full stop step a frame, HOME goes back to the
// start. While the bar is up the card walker stands aside (`holdNav`), or
// the arrows would walk its buttons instead; C (the camera), H (the
// readouts) and ESC (the way out) arrive through the run's own presses
// (`run-actions.ts`).
//
// AND THE ONE THING THE PICTURE CANNOT SAY FOR ITSELF: that it is running
// slow. A skier not expecting it reads a third-speed jump as a device that
// has started dropping frames, and it is one word to say otherwise.

import { useEffect, useRef, useState } from "preact/hooks";
import { TUNING, isSkiId, skisById } from "@engine";

import { holdNav } from "./menu-nav.ts";
import type { ReplayBarFacts, ReplayRun } from "./replay-run.ts";
import { STRINGS } from "./strings.ts";

/** The presses the bar makes on the recording. */
export type ReplayControls = Pick<
  ReplayRun,
  "toggle" | "seek" | "skip" | "frameStep" | "faster" | "camera"
>;

export type ReplayBarProps = ReplayBarFacts & {
  controls: ReplayControls;
  /** Leave the recording for the surface it was watched from. */
  onLeave: () => void;
  /** Whether there is a thumb on the screen — the key note is for the other
   * kind of player. */
  touch: boolean;
};

/** How long the bar stays up with nobody touching anything, ms. */
const IDLE_MS = 3200;

const HZ = TUNING.physicsHz;

/** The keys the bar answers, and what each does. */
const KEYS: Record<string, (c: ReplayControls) => void> = {
  Space: (c) => c.toggle(),
  KeyK: (c) => c.toggle(),
  ArrowLeft: (c) => c.skip(-5),
  KeyJ: (c) => c.skip(-5),
  ArrowRight: (c) => c.skip(5),
  KeyL: (c) => c.skip(5),
  Comma: (c) => c.frameStep(-1),
  Period: (c) => c.frameStep(1),
  ArrowUp: (c) => c.faster(1),
  ArrowDown: (c) => c.faster(-1),
};

/** The transport's marks, drawn in the chrome's own line. */
const ICONS = {
  start: <path d="M6 5v14M19 5 9 12l10 7Z" />,
  back: (
    <>
      <path d="M12 6 4 12l8 6Z" />
      <path d="M20 6l-8 6 8 6Z" />
    </>
  ),
  on: (
    <>
      <path d="M12 6l8 6-8 6Z" />
      <path d="M4 6l8 6-8 6Z" />
    </>
  ),
  play: <path d="M7 4.5 19.5 12 7 19.5Z" />,
  pause: (
    <>
      <rect x="6" y="5" width="4.2" height="14" rx="0.8" />
      <rect x="13.8" y="5" width="4.2" height="14" rx="0.8" />
    </>
  ),
  again: (
    <>
      <path
        d="M5.2 9.4A7.6 7.6 0 1 1 4.6 12"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
      />
      <path d="M3.6 4.6v5.4H9Z" />
    </>
  ),
} as const;

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg class="hud-replay-icon" viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

export function ReplayBar(props: ReplayBarProps) {
  const { bill, first, end, at, playing, speed, slow, seeking, rung, marks, moment, back } = props;
  const { controls, onLeave, touch } = props;
  const skis = isSkiId(bill.skis) ? skisById(bill.skis).name : bill.skis;
  const span = Math.max(1, end - first);
  const share = (step: number): number => Math.min(1, Math.max(0, (step - first) / span));

  /** Where a drag of the scrubber would land, while it is held. */
  const [drag, setDrag] = useState<number | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const stepAt = (clientX: number): number => {
    const box = track.current!.getBoundingClientRect();
    return Math.round(first + ((clientX - box.left) / Math.max(1, box.width)) * span);
  };

  // THE BAR STEPS OUT OF THE PICTURE while it plays untouched.
  const [idle, setIdle] = useState(false);
  const wake = useRef<() => void>(() => {});
  useEffect(() => {
    let timer = 0;
    const poke = (): void => {
      setIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), IDLE_MS);
    };
    wake.current = poke;
    poke();
    window.addEventListener("pointermove", poke, { passive: true });
    window.addEventListener("pointerdown", poke, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", poke);
      window.removeEventListener("pointerdown", poke);
    };
  }, []);

  // THE KEYS, with the card walker stood aside.
  const live = useRef(controls);
  live.current = controls;
  useEffect(() => {
    holdNav(true);
    const onKey = (e: KeyboardEvent): void => {
      wake.current();
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const press = KEYS[e.code];
      if (e.code === "Home") live.current.seek(-Infinity);
      else if (press) press(live.current);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      holdNav(false);
      window.removeEventListener("keydown", onKey, true);
    };
  }, []);

  const shown = drag ?? at;
  const over = !playing && at >= end;
  const hidden = idle && playing && drag === null;
  return (
    <div class={`hud hud-replay-layer${hidden ? " is-idle" : ""}`}>
      <div class="hud-replay-hairline" style={{ transform: `scaleX(${share(at)})` }} />
      <div class="hud-card hud-replay">
        <div class="hud-replay-head">
          <span class="hud-replay-label">
            <span class="hud-replay-dot" />
            {moment === null ? STRINGS.replayLabel : STRINGS.replayInstant}
          </span>
          {slow && <span class="hud-replay-tag">{STRINGS.replaySlow}</span>}
          {seeking && <span class="hud-replay-tag">{STRINGS.replaySeeking}</span>}
          <span class="hud-replay-title">
            {STRINGS.replayTitle(bill.seed, bill.mode)}
            <span class="hud-replay-line">
              {" "}
              · {STRINGS.replayLine(skis, bill.time, bill.place)}
            </span>
          </span>
        </div>
        <div class="hud-replay-scrub">
          <span class="hud-replay-time">{STRINGS.replayClock((shown - first) / HZ)}</span>
          <div
            ref={track}
            class={`hud-replay-track${drag !== null ? " is-dragging" : ""}`}
            role="slider"
            aria-label={STRINGS.replayScrub}
            aria-valuemin={0}
            aria-valuemax={Math.round(span / HZ)}
            aria-valuenow={Math.round((shown - first) / HZ)}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setDrag(stepAt(e.clientX));
            }}
            onPointerMove={(e) => {
              if (drag !== null) setDrag(stepAt(e.clientX));
            }}
            onPointerUp={(e) => {
              if (drag === null) return;
              controls.seek(stepAt(e.clientX));
              setDrag(null);
            }}
            onPointerCancel={() => setDrag(null)}
          >
            <div class="hud-replay-rail" />
            <div class="hud-replay-fill" style={{ transform: `scaleX(${share(shown)})` }} />
            {marks.map((m) => (
              <span
                key={`${m.kind}-${m.at}`}
                class={`hud-replay-mark is-${m.kind}`}
                style={{ left: `${share(m.at) * 100}%` }}
                title={STRINGS.replayMark(m.kind)}
              />
            ))}
            {moment !== null && (
              <span class="hud-replay-mark is-moment" style={{ left: `${share(moment) * 100}%` }} />
            )}
            <span class="hud-replay-head-knob" style={{ left: `${share(shown) * 100}%` }} />
          </div>
          <span class="hud-replay-time is-end">{STRINGS.replayClock(span / HZ)}</span>
        </div>
        <div class="hud-replay-acts">
          <div class="hud-replay-transport">
            <button
              type="button"
              class="hud-mini hud-replay-key"
              aria-label={STRINGS.replayStart}
              onClick={() => controls.seek(-Infinity)}
            >
              <Icon name="start" />
            </button>
            <button
              type="button"
              class="hud-mini hud-replay-key"
              aria-label={STRINGS.replaySkipBack}
              onClick={() => controls.skip(-5)}
            >
              <Icon name="back" />
            </button>
            <button
              type="button"
              class="hud-mini hud-replay-key is-main"
              aria-label={
                over ? STRINGS.replayAgain : playing ? STRINGS.replayPause : STRINGS.replayPlay
              }
              onClick={() => controls.toggle()}
            >
              <Icon name={over ? "again" : playing ? "pause" : "play"} />
            </button>
            <button
              type="button"
              class="hud-mini hud-replay-key"
              aria-label={STRINGS.replaySkipOn}
              onClick={() => controls.skip(5)}
            >
              <Icon name="on" />
            </button>
            <button
              type="button"
              class="hud-mini hud-replay-speed"
              aria-label={STRINGS.replayFaster}
              onClick={() => controls.faster("cycle")}
            >
              {STRINGS.replaySpeed(speed)}
            </button>
          </div>
          <div class="hud-replay-ways">
            <button type="button" class="hud-mini hud-replay-act" onClick={() => controls.camera()}>
              {STRINGS.replayCamera(rung)}
            </button>
            <button
              type="button"
              class="hud-mini hud-replay-act is-back"
              data-nav-back
              onClick={onLeave}
            >
              {STRINGS.replayBack(back)}
            </button>
          </div>
        </div>
        {!touch && <div class="hud-card-note hud-replay-note">{STRINGS.replayNote}</div>}
      </div>
    </div>
  );
}
