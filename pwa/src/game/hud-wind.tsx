// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WIND METER — beside the speed, the air the skier is skiing through.
// A dial turned heading-up like the minimap (the top of it is the way he
// faces) with two arrows on it, each pointing the way the air MOVES: a faint
// one for the WEATHER's wind where he is — down at his body, sheltered by the
// woods (`airAt`) — and a bold one for the wind he FEELS — that wind less his
// own velocity (`airflowAt`), which is what the wind bed plays and what his
// drag is against. At speed in still air the bold arrow points straight
// down, at the player: the air streaming back past him. Into a headwind it
// points down and the number is the two added; with a tailwind as fast as
// he is, the number falls to nothing. The number is the felt wind, km/h,
// and past a gale it goes the alarm colour. Every figure is the snapshot's
// (`windOf`); nothing here decides what the wind is.

import { angleDiff } from "@engine";
import { useRef } from "preact/hooks";

import type { HudWind } from "./snapshot.ts";
import { STRINGS } from "./strings.ts";

/** The felt wind past which the meter goes the alarm colour, km/h. */
const GALE_KMH = 150;
/** Under this an arrow says nothing and is not drawn, km/h. */
const CALM_KMH = 2;

/** An angle carried on from the last one by the short way round, degrees,
 * so the dial's tween never spins a whole turn across the wrap. */
function useTurn(angle: number): number {
  const held = useRef<number | null>(null);
  held.current = held.current === null ? angle : held.current + angleDiff(held.current, angle);
  return (held.current * 180) / Math.PI;
}

/** An arrow drawn pointing up, `long` from tail to tip, about the centre. */
function arrow(long: number, head: number): string {
  const tip = -long / 2;
  const tail = long / 2;
  return `M 0 ${tail} L 0 ${tip + head} M ${-head * 0.8} ${tip + head} L 0 ${tip} L ${head * 0.8} ${tip + head} Z`;
}

export function WindMeter({ wind }: { wind: HudWind }) {
  const felt = useTurn(wind.feltAngle);
  const air = useTurn(wind.airAngle);
  const gale = wind.feltKmh >= GALE_KMH;
  return (
    <div
      class={`hud-wind ${gale ? "hud-wind-gale" : ""}`}
      role="img"
      aria-label={STRINGS.windAria(wind.feltKmh, wind.airKmh)}
    >
      <svg class="hud-wind-dial" viewBox="-50 -50 100 100" aria-hidden="true">
        <circle class="hud-wind-ring" r="44" />
        {/* AHEAD: the notch at the top is the way he faces. */}
        <path class="hud-wind-ahead" d="M -7 -47 L 0 -38 L 7 -47 Z" />
        {wind.airKmh >= CALM_KMH && (
          <g class="hud-wind-turn" style={{ transform: `rotate(${air.toFixed(1)}deg)` }}>
            <path class="hud-wind-air" d={arrow(62, 12)} />
          </g>
        )}
        {wind.feltKmh >= CALM_KMH && (
          <g class="hud-wind-turn" style={{ transform: `rotate(${felt.toFixed(1)}deg)` }}>
            <path class="hud-wind-felt" d={arrow(70, 20)} />
          </g>
        )}
      </svg>
      <span class="hud-wind-read">
        <span class="hud-wind-num">{Math.round(wind.feltKmh)}</span>
        <span class="hud-chip-sub">{STRINGS.windLabel}</span>
        <span class="hud-wind-air-read">{STRINGS.windAir(wind.airKmh)}</span>
      </span>
    </div>
  );
}
