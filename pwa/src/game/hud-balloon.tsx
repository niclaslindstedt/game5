// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HOT AIR BALLOON'S INSTRUMENTS AND THUMBS (`balloon.ts`).
//
// THE STRIP — top centre, in the air clock's place, the pack a balloon
// pilot hangs in the basket: THE ALTITUDE over the snow under him and over
// the sea, THE VARIO (his climb, the bar up green or down red), THE
// ENVELOPE's temperature on a gauge with its working limit's red line, THE
// FUEL left, and THE WIND he drifts on with an arrow the way it carries
// him (up is the way the basket faces — the summit, as it is stood up).
// Under it the CALL the moment asks for (`balloon-hud.ts`'s
// `balloonCall`), and how to fly it.
//
// THE RIGHT THUMB'S PRESSES on touch — BURN held (the blast valve), VENT
// held (the parachute's cord) and JUMP (over the side; STEP OUT once the
// basket stands still on the snow) — while the left thumb is the walking
// pad (`hud-heli-pad.tsx`'s `StickZone`, `role="walk"`). The presses write
// the lever's channel (`TouchChannel.tuck` / `.brake`) as the tuck lever
// does, each grip ended by a thumb guard; the jump is the machine press.
// Every figure is the snapshot's (`balloonOf`).

import { useEffect, useMemo, useRef } from "preact/hooks";

import type { HudBalloon } from "./balloon-hud.ts";
import type { InputManager } from "./input.ts";
import { capturePointer, stillDown, type ZoneSide } from "./hud-touch.tsx";
import { STRINGS } from "./strings.ts";
import { createThumbGuard } from "@niclaslindstedt/oss-game-framework/input/thumb-guard";

/** The vario's bar reads full at this climb or sink, m/s. */
const VARIO_FULL = 5;
/** The envelope's gauge runs from the air's temperature to this, °C. */
const GAUGE_TOP = 140;

export function BalloonReadout({
  balloon,
  touch,
  machineKey,
}: {
  balloon: HudBalloon;
  touch: boolean;
  machineKey: string;
}) {
  const share = Math.max(-1, Math.min(1, balloon.climb / VARIO_FULL));
  const heat = Math.max(0, Math.min(1, balloon.temp / GAUGE_TOP));
  const red = balloon.limit / GAUGE_TOP;
  const call = balloon.call;
  const word =
    call === "fire"
      ? STRINGS.balloonCallFire
      : call === "hot"
        ? STRINGS.balloonCallHot
        : call === "sink"
          ? STRINGS.balloonCallSink
          : call === "empty"
            ? STRINGS.balloonCallEmpty
            : call === "tether"
              ? STRINGS.balloonCallTether
              : call === "landed"
                ? STRINGS.balloonCallLanded
                : call === "burn"
                  ? STRINGS.balloonCallBurn
                  : null;
  const alarm = call === "fire" || call === "hot" || call === "sink";
  const hint =
    call === "tether"
      ? STRINGS.balloonTetherHint(touch)
      : call === "landed"
        ? STRINGS.balloonStepHint(touch, machineKey)
        : STRINGS.balloonHint(touch, machineKey);
  return (
    <div class="hud-para hud-balloon" role="status">
      <div class="hud-para-strip">
        <span class="hud-para-cell">
          <span class="hud-para-num">{STRINGS.balloonAltValue(balloon.agl)}</span>
          <span class="hud-para-sub">{STRINGS.balloonAlt}</span>
        </span>
        {balloon.sea !== null && (
          <span class="hud-para-cell hud-balloon-sea">
            <span class="hud-para-num">{STRINGS.balloonAltValue(balloon.sea)}</span>
            <span class="hud-para-sub">{STRINGS.balloonSea}</span>
          </span>
        )}
        <span class="hud-para-cell hud-para-vario">
          <span class="hud-para-bar" aria-hidden="true">
            <span
              class={share >= 0 ? "hud-para-up" : "hud-para-down"}
              style={{ height: `${(Math.abs(share) * 50).toFixed(1)}%` }}
            />
          </span>
          <span class="hud-para-num">{STRINGS.balloonVarioValue(balloon.climb)}</span>
          <span class="hud-para-sub">{STRINGS.balloonVario}</span>
        </span>
        <span
          class={`hud-para-cell hud-balloon-env${balloon.temp >= balloon.limit ? " hud-balloon-over" : ""}`}
        >
          <span class="hud-para-num">{STRINGS.balloonTempValue(balloon.temp)}</span>
          <span class="hud-balloon-gauge" aria-hidden="true">
            <span class="hud-balloon-heat" style={{ width: `${(heat * 100).toFixed(1)}%` }} />
            <span class="hud-balloon-red" style={{ left: `${(red * 100).toFixed(1)}%` }} />
          </span>
          <span class="hud-para-sub">{STRINGS.balloonTemp}</span>
        </span>
        <span class={`hud-para-cell${balloon.fuelShare < 0.15 ? " hud-balloon-low" : ""}`}>
          <span class="hud-para-num">{STRINGS.balloonFuelValue(balloon.fuel)}</span>
          <span class="hud-balloon-gauge" aria-hidden="true">
            <span
              class="hud-balloon-fuel"
              style={{ width: `${(balloon.fuelShare * 100).toFixed(1)}%` }}
            />
          </span>
          <span class="hud-para-sub">{STRINGS.balloonFuel}</span>
        </span>
        <span class="hud-para-cell">
          <span class="hud-para-num">
            <span
              class="hud-balloon-arrow"
              aria-hidden="true"
              style={{
                transform: `rotate(${((balloon.windAngle * 180) / Math.PI).toFixed(0)}deg)`,
              }}
            >
              ↑
            </span>
            {STRINGS.balloonWindValue(balloon.windKmh)}
          </span>
          <span class="hud-para-sub">{STRINGS.balloonWind}</span>
        </span>
      </div>
      {word && (
        <span class={alarm ? "hud-para-stall" : "hud-para-word"}>
          {call === "burn" && <span class="hud-balloon-flame" aria-hidden="true" />}
          {word}
        </span>
      )}
      <span class="hud-para-hint">{hint}</span>
    </div>
  );
}

/** One held press: down writes `on(true)`, the lift (or anything else that
 * ends the grip — the thumb guard) writes `on(false)`. */
function HoldPress({
  label,
  kind,
  on,
}: {
  label: string;
  kind: string;
  on: (down: boolean) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const onRef = useRef(on);
  onRef.current = on;
  const guard = useMemo(
    () =>
      createThumbGuard(() => {
        onRef.current(false);
        ref.current?.classList.remove("hud-balloon-held");
      }, window),
    [],
  );
  useEffect(() => () => guard.dispose(), [guard]);
  return (
    <button
      ref={ref}
      type="button"
      class={`hud-balloon-press hud-balloon-${kind}`}
      data-touch={kind}
      onPointerDown={(e) => {
        capturePointer(e);
        if (!guard.claim(e.pointerId, stillDown(e.currentTarget))) return;
        ref.current?.classList.add("hud-balloon-held");
        onRef.current(true);
      }}
      onPointerUp={(e) => guard.release(e.pointerId)}
      onPointerCancel={(e) => guard.release(e.pointerId)}
      onLostPointerCapture={(e) => guard.release(e.pointerId)}
    >
      {label}
    </button>
  );
}

/** THE RIGHT THUMB IN THE BASKET: BURN and VENT held, JUMP (or STEP OUT,
 * landed) pressed. */
export function BalloonPad({
  touch,
  side,
  landed,
  onJump,
}: {
  touch: InputManager["touch"];
  side: ZoneSide;
  landed: boolean;
  onJump: () => void;
}) {
  const held = useRef({ burn: false, vent: false });
  const write = (): void => {
    touch.lever = held.current.burn || held.current.vent;
    touch.tuck = held.current.burn ? 1 : 0;
    touch.brake = held.current.vent ? 1 : 0;
  };
  // Leaving the basket lets both go.
  useEffect(
    () => () => {
      touch.lever = false;
      touch.tuck = 0;
      touch.brake = 0;
    },
    [touch],
  );
  return (
    <div class={`hud-zone hud-zone-${side} hud-balloon-pad`} data-touch="balloon">
      <HoldPress
        label={STRINGS.balloonBurn}
        kind="burn"
        on={(down) => {
          held.current.burn = down;
          write();
        }}
      />
      <HoldPress
        label={STRINGS.balloonVent}
        kind="vent"
        on={(down) => {
          held.current.vent = down;
          write();
        }}
      />
      <button
        type="button"
        class="hud-balloon-press hud-balloon-jump"
        data-touch="jump"
        onPointerDown={(e) => {
          e.stopPropagation();
          onJump();
        }}
      >
        {landed ? STRINGS.balloonStep : STRINGS.balloonJump}
      </button>
    </div>
  );
}
