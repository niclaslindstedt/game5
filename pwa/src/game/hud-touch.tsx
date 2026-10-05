// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TOUCH CONTROLS — the two thumb zones the phone skis with: the EDGE
// THUMB on the lower left, the TUCK LEVER on the lower right (swapped for
// a skier who has asked for the lever on the left) — wide open the moment a
// thumb lands, eased off by sliding UP, and the brake further up still. Both
// stop short of the top of the screen so the readouts and their presses keep
// their own glass; styles.css owns where the line falls.
//
// They are a HUD surface but not a HUD readout: everything here writes
// straight into the input manager between snapshots, at pointer rate,
// rather than being drawn from the ~12 Hz snapshot the rest of the HUD
// reads. That is the whole reason they sit in their own module — and it is
// what the two rules below protect.
//
// TWO THINGS EVERY ZONE HERE OWES:
//
// - It must LET GO. A control that trusts only its own pointerup is one
//   that eventually sticks, with the axis it wrote outliving the race.
//   the framework's `input/thumb-guard` is every way a grip has to be able to end, and no zone
//   may hold a finger without one.
// - It must answer at POINTER rate. The bar's rotation and the lever's
//   position are written onto the DOM directly; nothing in here re-renders
//   to move, because a thumb feeling a 12 Hz edge is a thumb feeling
//   a broken game.
//
// The MATHS of both — how far a thumb goes for full lock, the lever's
// throw, the lean's dead band — is input-model.ts, which the tests read.

import { useEffect, useMemo, useRef } from "preact/hooks";

import {
  LEVER_BRAKE_DEAD_PX,
  LEVER_BRAKE_PX,
  LEVER_EASE_PX,
  barLean,
  barReachPx,
  barSteer,
  createJumpTap,
  jumpTapDown,
  jumpTapUp,
  leverBrake,
  leverTuck,
  type TouchFeel,
} from "./input-model.ts";
import type { InputManager } from "./input.ts";
import { createThumbGuard } from "@niclaslindstedt/oss-game-framework/input/thumb-guard";

/** Capture the pointer so a drag that leaves the zone keeps steering; a
 * pointer that cannot be captured (synthetic, already released) is fine —
 * the zone still tracks it by id. */
export function capturePointer(e: { currentTarget: EventTarget | null; pointerId: number }): void {
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  } catch {
    /* see above */
  }
}

/** Ask the DOM whether a finger is still on the glass. Capture is the only
 * one who knows: the browser drops it the moment a touch ends, whether or
 * not it ever told us the touch ended. */
export function stillDown(zone: EventTarget | null): (pointerId: number) => boolean {
  const el = zone as HTMLElement | null;
  return (pointerId) => el?.hasPointerCapture(pointerId) ?? false;
}

/** Bar rotation at full lock, degrees. */
const BAR_LOCK_DEG = 28;
/** The bar's drawing is this many px across (styles.css `.hud-bar-svg`),
 * mapped onto a hundred-unit box — so the reach ring can be drawn at the
 * thumb's real travel (`barReachPx`, which the sensitivity moves: the
 * drawing lets a wider ring overhang its box). */
const BAR_SVG_PX = 200;
/** Half the drawn bar's own height, units: the crossbar's top edge to the
 * base grip's bottom. The art is drawn CENTRED on the box (that is what the
 * −8 in every y below is for), so this one number bounds its travel in both
 * directions instead of one. */
const BAR_ART_HALF = 17;

/** Which side of the glass a zone stands on (OPTIONS ▸ CONTROLS). */
export type ZoneSide = "left" | "right";

/** The left thumb: touching anywhere in the zone anchors the skis under
 * the finger; dragging sideways turns it, dragging up or down leans the
 * skier — and on the snow a drag DOWN is the back key (`input-model.ts`'s
 * `backMode`: down first and then across is the hockey stop, across first
 * and then down the edge cut harder) — and releasing centres both. Screen-space: right = +1
 * (input-model.ts flips the sign for the engine, once). */
export function BarZone({
  touch,
  feel,
  side,
}: {
  touch: InputManager["touch"];
  feel: TouchFeel;
  side: ZoneSide;
}) {
  /** The reach ring's radius in the drawing's own units... */
  const reachUnits = (barReachPx(feel) / BAR_SVG_PX) * 100;
  /** ...so the bar slides this far at full lean: right up against the reach
   * ring and no further, at BOTH ends of the axis.
   *
   * The lean is the one axis of the two with nothing to SHOW for itself — a
   * turned bar is unmistakable, a leaning skier is a few degrees of pitch
   * behind a chase camera, and in the air it is the whole of the pitch
   * control — so the overlay carries the whole of its travel, and the end of
   * that travel is the ring the player can already see. An inverted lean
   * slides it the other way, because the bar goes where the thumb went. */
  const leanSlide = (reachUnits - BAR_ART_HALF) * (feel.invertLean ? -1 : 1);
  const barRef = useRef<HTMLDivElement>(null);
  const rotorRef = useRef<SVGGElement>(null);
  const originRef = useRef({ x: 0, y: 0 });
  // A double tap here too is the push off the helicopter's skid.
  const tapRef = useRef(createJumpTap());

  const write = (steer: number, lean: number): void => {
    touch.steer = steer;
    touch.lean = lean;
    const rotor = rotorRef.current;
    if (rotor) {
      // The pair seen from above: it turns with the edge and slides
      // toward the skier (down) with the lean back, the whole way to the
      // ring at the ends of its travel.
      rotor.setAttribute(
        "transform",
        `translate(0 ${(lean * leanSlide).toFixed(1)}) rotate(${(steer * BAR_LOCK_DEG).toFixed(1)} 50 50)`,
      );
    }
  };

  /** Centre the bar and put it away. Everything it touches is a ref, so
   * the guard can call it from a window event or an unmount just as safely
   * as the pointerup does. */
  const letGo = (): void => {
    jumpTapUp(tapRef.current, performance.now() / 1000);
    touch.bar = false;
    write(0, 0);
    if (barRef.current) barRef.current.style.display = "none";
  };
  const letGoRef = useRef(letGo);
  letGoRef.current = letGo;
  const guard = useMemo(() => createThumbGuard(() => letGoRef.current(), window), []);
  useEffect(() => () => guard.dispose(), [guard]);

  return (
    <div
      class={`hud-zone hud-zone-${side}`}
      data-touch="bar"
      onPointerDown={(e) => {
        // The first finger owns the bar; a second touch on this half is
        // ignored rather than re-anchoring the steering under the first —
        // unless the first is a finger the browser never told us about,
        // which is what the guard refuses to keep believing in.
        capturePointer(e);
        if (!guard.claim(e.pointerId, stillDown(e.currentTarget))) return;
        originRef.current = { x: e.clientX, y: e.clientY };
        const bar = barRef.current;
        if (bar) {
          const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
          bar.style.left = `${e.clientX - box.left}px`;
          bar.style.top = `${e.clientY - box.top}px`;
          bar.style.display = "block";
        }
        touch.bar = true;
        // A double tap stays down until a step has taken it (`input.ts`).
        if (jumpTapDown(tapRef.current, performance.now() / 1000)) touch.tap2 = true;
        write(0, 0);
      }}
      onPointerMove={(e) => {
        if (!guard.owns(e.pointerId)) return;
        write(
          barSteer(e.clientX - originRef.current.x, feel),
          barLean(e.clientY - originRef.current.y, feel),
        );
      }}
      onPointerUp={(e) => guard.release(e.pointerId)}
      onPointerCancel={(e) => guard.release(e.pointerId)}
      // Capture taken away mid-drag: whatever the browser does with the rest
      // of that touch, this zone is no longer hearing about it.
      onLostPointerCapture={(e) => guard.release(e.pointerId)}
    >
      <div ref={barRef} class="hud-bar" aria-hidden="true">
        <svg class="hud-bar-svg" viewBox="0 0 100 100" overflow="visible">
          {/* The reach ring: how far the thumb can go for full lock. */}
          <circle cx="50" cy="50" r={reachUnits} class="hud-bar-reach" />
          <g ref={rotorRef}>
            {/* THE SKIS under the thumb, seen from above — drawn CENTRED
                on the box, so that a lean slides them the same distance
                each way and reaches the ring at both ends; the pair turns
                about the boots with the edge asked for. */}
            <rect x="36" y="14" width="10" height="72" rx="5" class="hud-bar-tube" />
            <rect x="54" y="14" width="10" height="72" rx="5" class="hud-bar-tube" />
            <rect x="34" y="44" width="14" height="12" rx="3" class="hud-bar-grip" />
            <rect x="52" y="44" width="14" height="12" rx="3" class="hud-bar-grip" />
          </g>
        </svg>
      </div>
    </div>
  );
}

/** The lever's drawing: the whole throw runs UP from the anchor — the
 * tuck easing off to the shut mark, then the brake's past it — with room
 * round the track for the knob and its stroke, px. */
const LEVER_UP_PX = LEVER_EASE_PX + LEVER_BRAKE_DEAD_PX + LEVER_BRAKE_PX;
const LEVER_PAD_PX = 22;
const LEVER_TOP_PX = -LEVER_UP_PX - LEVER_PAD_PX;
const LEVER_BOX_PX = LEVER_UP_PX + LEVER_PAD_PX * 2;

/** The right thumb: touching anywhere in the zone anchors the LEVER, WIDE
 * OPEN, under the finger. Sliding UP eases the tuck off over
 * `LEVER_EASE_PX` to shut; further up, past a small dead band, pulls the
 * BRAKE over `LEVER_BRAKE_PX`. A TAP and then the thumb held straight back
 * down LOADS THE JUMP (`jumpTapDown`) — the lever still under it — and
 * lifting it springs him. Analogue the whole way, held while the finger
 * is down and let go on the lift. `input-model.ts` states the maths once. */
export function LeverZone({
  touch,
  feel,
  side,
}: {
  touch: InputManager["touch"];
  feel: TouchFeel;
  side: ZoneSide;
}) {
  const leverRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<SVGGElement>(null);
  const fillRef = useRef<SVGRectElement>(null);
  const originRef = useRef(0);
  const tapRef = useRef(createJumpTap());

  const write = (tuck: number, brake: number): void => {
    touch.tuck = tuck;
    touch.brake = brake;
    // The knob rides the thumb: the anchor at 0 is wide open, the shut mark
    // `LEVER_EASE_PX` above it, the brake's travel above that. The fill spans
    // the shut mark to the knob either way — below it it is the tuck
    // that is open, above it the brake, drawn in the alarm colour so a thumb
    // never has to ask which half of the throw it is in.
    const px =
      tuck > 0
        ? -(1 - tuck) * LEVER_EASE_PX
        : brake > 0
          ? -(LEVER_EASE_PX + LEVER_BRAKE_DEAD_PX + brake * LEVER_BRAKE_PX)
          : -LEVER_EASE_PX;
    knobRef.current?.setAttribute("transform", `translate(0 ${px.toFixed(1)})`);
    const fill = fillRef.current;
    if (!fill) return;
    fill.setAttribute("y", Math.min(-LEVER_EASE_PX, px).toFixed(1));
    fill.setAttribute("height", Math.abs(px + LEVER_EASE_PX).toFixed(1));
    fill.classList.toggle("hud-lever-fill-reverse", brake > 0);
  };
  const letGo = (): void => {
    jumpTapUp(tapRef.current, performance.now() / 1000);
    touch.lever = false;
    touch.jump = false;
    write(0, 0);
    const lever = leverRef.current;
    if (lever) {
      lever.style.display = "none";
      lever.classList.remove("hud-lever-jump");
    }
  };
  const letGoRef = useRef(letGo);
  letGoRef.current = letGo;
  const guard = useMemo(() => createThumbGuard(() => letGoRef.current(), window), []);
  useEffect(() => () => guard.dispose(), [guard]);

  return (
    <div
      class={`hud-zone hud-zone-${side}`}
      data-touch="lever"
      onPointerDown={(e) => {
        capturePointer(e);
        if (!guard.claim(e.pointerId, stillDown(e.currentTarget))) return;
        originRef.current = e.clientY;
        const lever = leverRef.current;
        if (lever) {
          const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
          lever.style.left = `${e.clientX - box.left}px`;
          lever.style.top = `${e.clientY - box.top}px`;
          lever.style.display = "block";
        }
        touch.lever = true;
        touch.jump = jumpTapDown(tapRef.current, performance.now() / 1000);
        if (touch.jump) touch.tap2 = true;
        lever?.classList.toggle("hud-lever-jump", touch.jump);
        write(leverTuck(0, feel), leverBrake(0, feel));
      }}
      onPointerMove={(e) => {
        if (!guard.owns(e.pointerId)) return;
        const dy = e.clientY - originRef.current;
        write(leverTuck(dy, feel), leverBrake(dy, feel));
      }}
      onPointerUp={(e) => guard.release(e.pointerId)}
      onPointerCancel={(e) => guard.release(e.pointerId)}
      onLostPointerCapture={(e) => guard.release(e.pointerId)}
    >
      <div ref={leverRef} class="hud-lever" aria-hidden="true">
        <svg
          class="hud-lever-svg"
          width="44"
          height={LEVER_BOX_PX}
          viewBox={`${-LEVER_PAD_PX} ${LEVER_TOP_PX} 44 ${LEVER_BOX_PX}`}
          // The drawing is anchored at the thumb, so the box's top edge has
          // to sit exactly where its own viewBox says it starts — one
          // expression for both rather than a number in styles.css that
          // silently stops agreeing the day a throw changes length.
          style={{ top: `${LEVER_TOP_PX}px` }}
        >
          <rect
            class="hud-lever-track"
            x="-6"
            y={-LEVER_UP_PX}
            width="12"
            height={LEVER_UP_PX}
            rx="6"
          />
          <rect ref={fillRef} class="hud-lever-fill" x="-6" y="0" width="12" height="0" rx="6" />
          {/* The SHUT mark, an easing-off above the anchor: above it the
              brake, below it the tuck, so the two read as two levers
              rather than one. */}
          <line
            class="hud-lever-neutral"
            x1="-11"
            y1={-LEVER_EASE_PX}
            x2="11"
            y2={-LEVER_EASE_PX}
          />
          <g ref={knobRef}>
            <circle class="hud-lever-knob" cx="0" cy="0" r="15" />
          </g>
        </svg>
      </div>
    </div>
  );
}
