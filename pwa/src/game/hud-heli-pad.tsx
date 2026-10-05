// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER'S TWO PADS — what the thumbs become while he flies it
// (`heli.ts`): the CYCLIC on the edge thumb's glass and the POWER PAD (the
// collective and the pedals) on the lever's. Each is drawn as a d-pad's
// cross under the thumb, every arm's arrow lit by how hard the thumb leans
// that way, with a knob that shows what it is working: the machine seen from
// behind, banking, on the cyclic; its rotor seen from above, turning, on the
// power pad, with the collective's gauge down the cross's upright.
//
// The same two rules as `hud-touch.tsx`'s zones hold here: every grip has a
// thumb guard to end it, and everything that moves is written onto the DOM
// at pointer rate — the knob, the icon, the lit arrows — never re-rendered.
// The one thing drawn from the HUD's ~12 Hz snapshot is the collective's
// gauge, which is the machine's and not the thumb's.

import { useEffect, useMemo, useRef } from "preact/hooks";

import { createJumpTap, jumpTapDown, jumpTapUp, powerAxis, type TouchFeel } from "./input-model.ts";
import type { InputManager } from "./input.ts";
import { capturePointer, stillDown, type ZoneSide } from "./hud-touch.tsx";
import { createThumbGuard } from "@niclaslindstedt/oss-game-framework/input/thumb-guard";

/** A pad's reach, px: the thumb travel that is the whole of both axes. */
const STICK_REACH_PX = 80;
/** ...and the knob's travel in the drawing's units (200 px over a hundred
 * units, so the knob sits under the thumb at sensitivity one). */
const KNOB_TRAVEL = 40;
/** How far the cyclic's helicopter banks at full side stick, deg, and the
 * power pad's rotor turns at full pedal. */
const ICON_BANK_DEG = 25;
const ICON_YAW_DEG = 45;
/** An unlit arrow's opacity; a full push lights it to one. */
const ARROW_DIM = 0.35;

/** Which of the two pads a zone is. */
export type StickRole = "cyclic" | "power";

/** The d-pad's cross, its arms `ARM` wide either side and `REACH` long. */
const ARM = 13;
const REACH = 44;
const CROSS =
  `M ${-ARM} ${-REACH} H ${ARM} V ${-ARM} H ${REACH} V ${ARM} H ${ARM} V ${REACH} ` +
  `H ${-ARM} V ${ARM} H ${-REACH} V ${-ARM} H ${-ARM} Z`;
/** An arrow at the end of the upper arm, pointing out; rotated for the rest. */
const ARROW = "M 0 -40 L 8 -31 L -8 -31 Z";

/** The power pad's collective gauge down the cross's upright, units. */
const GAUGE_TOP = -26;
const GAUGE_LEN = 52;

/** A TURN ARROW (↻) on the right arm: an arc most of the way round a small
 * circle, clockwise as the screen draws it, its head at the end — the nose
 * swung right, seen from above. The left arm's (↺) is this mirrored. */
const TURN = (() => {
  const cx = 29;
  const r = 6.5;
  const from = (150 * Math.PI) / 180;
  const to = (50 * Math.PI) / 180;
  const at = (a: number): [number, number] => [cx + r * Math.cos(a), r * Math.sin(a)];
  const [x0, y0] = at(from);
  const [x1, y1] = at(to);
  // The head along the way the arc runs (the angle growing), and across it.
  const tx = -Math.sin(to);
  const ty = Math.cos(to);
  const nx = Math.cos(to);
  const ny = Math.sin(to);
  const f = (v: number): string => v.toFixed(2);
  return {
    arc: `M ${f(x0)} ${f(y0)} A ${r} ${r} 0 1 1 ${f(x1)} ${f(y1)}`,
    head:
      `M ${f(x1 + 4 * tx)} ${f(y1 + 4 * ty)} ` +
      `L ${f(x1 - 1.5 * tx + 3.8 * nx)} ${f(y1 - 1.5 * ty + 3.8 * ny)} ` +
      `L ${f(x1 - 1.5 * tx - 3.8 * nx)} ${f(y1 - 1.5 * ty - 3.8 * ny)} Z`,
  };
})();

/** THE HELICOPTER'S TWO PADS, while he flies it: a thumb anywhere anchors a
 * pad under it, and its travel off the anchor is full at `STICK_REACH_PX`.
 *
 * - THE CYCLIC (`role="cyclic"`, the edge thumb's glass): up tilts the disc
 *   forward (the nose down, away), down tilts it back, to a side banks it
 *   that way — centred the moment the thumb lifts, as a sprung stick is.
 * - THE POWER PAD (`role="power"`, the lever's glass): up works the
 *   collective up and the machine climbs, down works it down — a lever
 *   moved while the thumb is held off the anchor and LEFT where it is when
 *   the thumb lifts; across is the pedals, the tail rotor turning the nose
 *   that way, sprung back to centre. `collective` is the lever as the HUD
 *   last read it, drawn down the upright.
 *
 * A double tap on either, as on the edge thumb, is the jump off the skid.
 * The maths of the four controls is input-model.ts's `sampleHeli`. */
export function StickZone({
  touch,
  feel,
  side,
  role,
  collective = 0,
}: {
  touch: InputManager["touch"];
  feel: TouchFeel;
  side: ZoneSide;
  role: StickRole;
  collective?: number;
}) {
  const padRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<SVGGElement>(null);
  const iconRef = useRef<SVGGElement>(null);
  /** The arms' arrows: up, right, down, left. */
  const arrowRefs = [
    useRef<SVGGElement>(null),
    useRef<SVGGElement>(null),
    useRef<SVGGElement>(null),
    useRef<SVGGElement>(null),
  ];
  const originRef = useRef({ x: 0, y: 0 });
  const tapRef = useRef(createJumpTap());
  const reach = STICK_REACH_PX / feel.sensitivity;

  const write = (x: number, y: number, down: boolean): void => {
    if (role === "cyclic") {
      touch.stickX = x;
      touch.stickY = y;
      touch.stick = down;
    } else {
      touch.powerX = x;
      touch.powerY = y;
      touch.power = down;
    }
    knobRef.current?.setAttribute(
      "transform",
      `translate(${(x * KNOB_TRAVEL).toFixed(1)} ${(-y * KNOB_TRAVEL).toFixed(1)})`,
    );
    iconRef.current?.setAttribute(
      "transform",
      `rotate(${(x * (role === "cyclic" ? ICON_BANK_DEG : ICON_YAW_DEG)).toFixed(1)})`,
    );
    // The power pad lights only past its dead band, as it only works there.
    const ax = role === "power" ? powerAxis(x) : x;
    const ay = role === "power" ? powerAxis(y) : y;
    const lit = [Math.max(0, ay), Math.max(0, ax), Math.max(0, -ay), Math.max(0, -ax)];
    arrowRefs.forEach((ref, i) => {
      if (ref.current)
        ref.current.style.opacity = (ARROW_DIM + (1 - ARROW_DIM) * lit[i]).toFixed(2);
    });
  };
  const letGo = (): void => {
    jumpTapUp(tapRef.current, performance.now() / 1000);
    write(0, 0, false);
    if (padRef.current) padRef.current.style.display = "none";
  };
  const letGoRef = useRef(letGo);
  letGoRef.current = letGo;
  const guard = useMemo(() => createThumbGuard(() => letGoRef.current(), window), []);
  useEffect(() => () => guard.dispose(), [guard]);

  const level = Math.max(0, Math.min(1, collective)) * GAUGE_LEN;

  return (
    <div
      class={`hud-zone hud-zone-${side}`}
      data-touch={role === "cyclic" ? "stick" : "power"}
      onPointerDown={(e) => {
        capturePointer(e);
        if (!guard.claim(e.pointerId, stillDown(e.currentTarget))) return;
        originRef.current = { x: e.clientX, y: e.clientY };
        const pad = padRef.current;
        if (pad) {
          const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
          pad.style.left = `${e.clientX - box.left}px`;
          pad.style.top = `${e.clientY - box.top}px`;
          pad.style.display = "block";
        }
        if (jumpTapDown(tapRef.current, performance.now() / 1000)) touch.tap2 = true;
        write(0, 0, true);
      }}
      onPointerMove={(e) => {
        if (!guard.owns(e.pointerId)) return;
        const clip = (v: number): number => Math.max(-1, Math.min(1, v / reach));
        write(clip(e.clientX - originRef.current.x), clip(originRef.current.y - e.clientY), true);
      }}
      onPointerUp={(e) => guard.release(e.pointerId)}
      onPointerCancel={(e) => guard.release(e.pointerId)}
      onLostPointerCapture={(e) => guard.release(e.pointerId)}
    >
      <div ref={padRef} class={`hud-bar hud-pad hud-pad-${role}`} aria-hidden="true">
        <svg class="hud-bar-svg" viewBox="-50 -50 100 100" overflow="visible">
          <circle r="48" class="hud-pad-disc" />
          <path d={CROSS} class="hud-pad-cross" />
          {role === "power" && (
            <g>
              <rect
                x="-3"
                y={GAUGE_TOP}
                width="6"
                height={GAUGE_LEN}
                rx="2"
                class="hud-pad-gauge"
              />
              <rect
                x="-3"
                y={(GAUGE_TOP + GAUGE_LEN - level).toFixed(1)}
                width="6"
                height={level.toFixed(1)}
                rx="2"
                class="hud-pad-gauge-fill"
              />
            </g>
          )}
          <g ref={arrowRefs[0]} class="hud-pad-arrow">
            <path d={ARROW} />
          </g>
          <g ref={arrowRefs[2]} class="hud-pad-arrow">
            <path d={ARROW} transform="rotate(180)" />
          </g>
          {role === "cyclic" ? (
            <>
              <g ref={arrowRefs[1]} class="hud-pad-arrow">
                <path d={ARROW} transform="rotate(90)" />
              </g>
              <g ref={arrowRefs[3]} class="hud-pad-arrow">
                <path d={ARROW} transform="rotate(-90)" />
              </g>
            </>
          ) : (
            <>
              <g ref={arrowRefs[1]} class="hud-pad-arrow hud-pad-turn">
                <path d={TURN.arc} />
                <path d={TURN.head} class="hud-pad-turn-head" />
              </g>
              <g ref={arrowRefs[3]} class="hud-pad-arrow hud-pad-turn" transform="scale(-1 1)">
                <path d={TURN.arc} />
                <path d={TURN.head} class="hud-pad-turn-head" />
              </g>
            </>
          )}
          <g ref={knobRef}>
            <circle r="15" class="hud-lever-knob" />
            <g ref={iconRef} class="hud-pad-icon">
              {role === "cyclic" ? (
                // The machine from behind: the rotor, the mast, the cabin
                // and the skids under it.
                <>
                  <path d="M -12 -7 H 12 M 0 -7 V -3 M -8 8.5 H 8 M -3.5 5 L -5 8.5 M 3.5 5 L 5 8.5" />
                  <ellipse cx="0" cy="1" rx="5.5" ry="4.5" class="hud-pad-icon-fill" />
                </>
              ) : (
                // The rotor from above: two blades crossed over the hub.
                <>
                  <path d="M -10.5 0 H 10.5 M 0 -10.5 V 10.5" />
                  <circle r="2.6" class="hud-pad-icon-fill" />
                </>
              )}
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
