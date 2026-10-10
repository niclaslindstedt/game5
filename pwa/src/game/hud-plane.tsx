// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE'S PANEL AND THE SKYDIVER'S ALTIMETER — top centre, in the
// air clock's place, as the helicopter's instruments stand (and in the
// helicopter's own furniture, `heli.css`, with `plane.css` over it).
//
//   * FLYING THE PLANE (`PlaneReadout`): the six a pilot scans — THE
//     HORIZON (the attitude, turned over past the vertical so a loop reads
//     the way a pilot's ball reads it), THE AIRSPEED in knots, THE HEIGHT
//     over the snow big with the climb and the height over the sea under
//     it, and THE POWER lever's bar; the flaps' setting (a pair of presses
//     on touch), THE STALL HORN lit red, the load past the comfortable, and
//     under all of it the press the machine key is now: out of the door in
//     the air, off onto the skis stopped on the snow. Parked on its strip
//     near him, the call and the press that takes him aboard.
//   * FALLING FROM IT (`ChuteReadout`): the ALTIMETER big — the one number
//     a skydive is played against — the fall under it (or the air through
//     the canopy), PULL! lit at a sport jumper's pull height, the canopy's
//     stall, and the press the machine key is now: OPEN, then CUT AWAY.
//
// Every figure is the snapshot's (`plane-hud.ts`) but the power bar, drawn
// every frame off `hud-live.ts` so it fills as the thumb holds it.

import { useEffect, useMemo, useRef } from "preact/hooks";

import { createHudPress, pressHandlers } from "@niclaslindstedt/oss-game-framework/input/hud-press";

import type { HudChute, HudPlane } from "./plane-hud.ts";
import type { HudLive } from "./hud-live.ts";
import { MachinePress } from "./hud-machine-press.tsx";
import { STRINGS } from "./strings.ts";

/** The horizon's pitch scale, px of the dial per rad. */
const PITCH_PX = 60;
/** The load the panel shows, g: past a comfortable turn's. */
const LOAD_SHOWN = 2.2;

/** The power lever's bar, written once a frame (`hud-live.ts`). */
function PowerBar({ live }: { live: HudLive }) {
  const fillRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const draw = (): void => {
      if (fillRef.current) fillRef.current.style.height = `${(live.collective * 100).toFixed(1)}%`;
    };
    live.draws.add(draw);
    draw();
    return () => {
      live.draws.delete(draw);
    };
  }, [live]);
  return (
    <div class="hud-heli-coll" aria-label={STRINGS.planePower}>
      <div ref={fillRef} class="hud-heli-coll-fill" />
      <span class="hud-heli-coll-word">{STRINGS.planePowerShort}</span>
    </div>
  );
}

/** The attitude: the sky and the snow behind a fixed pair of wings. */
function Horizon({ pitch, bank }: { pitch: number; bank: number }) {
  // Over the top (a loop, a roll past the vertical) the pitch is read back
  // inside a quarter turn and the dial turned over.
  const over = Math.abs(pitch) > Math.PI / 2;
  const p = over ? Math.sign(pitch) * Math.PI - pitch : pitch;
  const b = over ? bank + Math.PI : bank;
  const deg = (-b * 180) / Math.PI;
  const shift = Math.max(-30, Math.min(30, p * PITCH_PX));
  return (
    <svg class="hud-heli-horizon" viewBox="-36 -36 72 72" aria-hidden="true">
      <defs>
        <clipPath id="hud-plane-dial">
          <circle r="34" />
        </clipPath>
      </defs>
      <g clip-path="url(#hud-plane-dial)">
        <g transform={`rotate(${deg.toFixed(1)}) translate(0 ${shift.toFixed(1)})`}>
          <rect x="-80" y="-80" width="160" height="80" class="hud-heli-sky" />
          <rect x="-80" y="0" width="160" height="80" class="hud-heli-ground" />
          <line x1="-80" y1="0" x2="80" y2="0" class="hud-heli-line" />
        </g>
      </g>
      <path d="M -18 0 L -6 0 L 0 5 L 6 0 L 18 0" class="hud-heli-wings" />
      <circle r="34" class="hud-heli-ring" />
    </svg>
  );
}

/** The flaps' setting, a notch up or down a press on touch. */
function Flaps({
  deg,
  touch,
  onFlaps,
}: {
  deg: number;
  touch: boolean;
  onFlaps: (dir: number) => void;
}) {
  const up = useMemo(createHudPress, []);
  const down = useMemo(createHudPress, []);
  if (!touch) return <span class="hud-heli-sub">{STRINGS.planeFlaps(deg)}</span>;
  return (
    <span class="hud-plane-flaps">
      <button
        type="button"
        class="hud-plane-flap"
        aria-label={STRINGS.keyFlapsUp}
        {...pressHandlers(up, () => onFlaps(-1))}
      >
        ▲
      </button>
      <span class="hud-heli-sub">{STRINGS.planeFlaps(deg)}</span>
      <button
        type="button"
        class="hud-plane-flap"
        aria-label={STRINGS.keyFlapsDown}
        {...pressHandlers(down, () => onFlaps(1))}
      >
        ▼
      </button>
    </span>
  );
}

export function PlaneReadout({
  plane,
  live,
  touch,
  machineKey,
  onBoard,
  onFlaps,
}: {
  plane: HudPlane;
  live: HudLive;
  touch: boolean;
  /** The machine key as bound, as the player reads it off the keyboard. */
  machineKey: string;
  /** The call tapped while he stands at its door: the machine press. */
  onBoard: () => void;
  /** A flap notch asked for off the panel (`InputManager.requestFlaps`). */
  onFlaps: (dir: number) => void;
}) {
  if (plane.kind === "waiting") {
    if (plane.near)
      return (
        <MachinePress
          word={STRINGS.planeCall}
          sub={STRINGS.planeTake(touch, machineKey)}
          kind="heli"
          onBoard={onBoard}
        />
      );
    return (
      <div class="hud-heli hud-heli-call hud-plane" role="status">
        <span class="hud-heli-word">{STRINGS.planeCall}</span>
        <span class="hud-heli-sub">{STRINGS.planeAway(plane.away)}</span>
      </div>
    );
  }
  const hint =
    plane.press === "jump"
      ? STRINGS.planeJump(touch, machineKey)
      : plane.press === "stepoff"
        ? `${STRINGS.planeGo(touch)} · ${STRINGS.planeStepOff(touch, machineKey)}`
        : null;
  return (
    <div class="hud-heli hud-plane" role="status">
      <div class="hud-heli-row">
        <Horizon pitch={plane.pitch} bank={plane.bank} />
        <div class="hud-heli-read hud-plane-ias">
          <span class="hud-chip-sub">{STRINGS.planeSpeed}</span>
          <span class="hud-plane-num">{STRINGS.planeKnots(plane.speed)}</span>
        </div>
        <div class="hud-heli-read">
          <span class="hud-chip-sub">{STRINGS.planeHeight}</span>
          <span class="hud-heli-num">{STRINGS.planeMetres(plane.height)}</span>
          <span class="hud-heli-sub">{STRINGS.planeClimb(plane.climb)}</span>
          <span class="hud-heli-sub">{STRINGS.planeAltitude(plane.altitude)}</span>
        </div>
        <PowerBar live={live} />
      </div>
      <div class="hud-plane-row">
        <Flaps deg={plane.flaps} touch={touch} onFlaps={onFlaps} />
        {plane.load >= LOAD_SHOWN && (
          <span class="hud-heli-sub hud-plane-load">{STRINGS.planeLoad(plane.load)}</span>
        )}
      </div>
      {plane.stall && <span class="hud-plane-stall">{STRINGS.planeStall}</span>}
      {hint && <span class="hud-heli-hint">{hint}</span>}
    </div>
  );
}

export function ChuteReadout({
  chute,
  touch,
  machineKey,
}: {
  chute: HudChute;
  touch: boolean;
  /** The machine key as bound, as the player reads it off the keyboard. */
  machineKey: string;
}) {
  const canopy = chute.mode === "open" || chute.mode === "deploying";
  const hint =
    chute.press === "open"
      ? STRINGS.chuteOpenPress(touch, machineKey)
      : chute.press === "release"
        ? STRINGS.chuteReleasePress(touch, machineKey)
        : chute.mode === "snagged"
          ? STRINGS.chuteSnagged
          : null;
  return (
    <div class={`hud-heli hud-chute${chute.pull ? " hud-chute-pull" : ""}`} role="status">
      <span class="hud-chip-sub">
        {STRINGS.chuteMode(chute.mode)} · {STRINGS.chuteAlt}
      </span>
      <span class="hud-chute-num">{STRINGS.chuteMetres(chute.height)}</span>
      <span class="hud-heli-sub">{STRINGS.chuteFall(chute.fall)}</span>
      {canopy && <span class="hud-heli-sub">{STRINGS.chuteAir(chute.air)}</span>}
      {chute.pull && <span class="hud-plane-stall hud-chute-cue">{STRINGS.chutePull}</span>}
      {chute.stall && <span class="hud-plane-stall">{STRINGS.chuteStall}</span>}
      {hint && <span class="hud-heli-hint">{hint}</span>}
    </div>
  );
}
