// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PARAMOTOR'S INSTRUMENTS (`para.ts`) — top centre, in the air clock's
// place, the strip a pilot clips to his riser: THE ALTITUDE over the snow
// under him, THE VARIO (his climb, the bar up green or down red), THE AIR
// through the wing (the speed that flies it — the HUD's own speedo is his
// way over the snow), THE WIND at the wing and THE THROTTLE with the
// engine's rpm. A STALL lit red when the wing is past it, a COLLAPSE when
// rough air has folded it (which side), and ROUGH AIR when the eddies are
// strong enough to. Under it, the way out of the harness —
// and on the summit, how to go. Every figure is the snapshot's (`paraOf`).

import type { HudPara } from "./snapshot.ts";
import { STRINGS } from "./strings.ts";

/** The vario's bar reads full at this climb or sink, m/s. */
const VARIO_FULL = 5;
/** The eddies' sigma the air reads rough at, m/s — where folds begin. */
const ROUGH = 1.3;
/** The share of the wing folded the HUD calls a collapse. */
const FOLDED = 0.08;

export function ParaReadout({
  para,
  touch,
  machineKey,
}: {
  para: HudPara;
  touch: boolean;
  /** The machine key as bound, as the player reads it off the keyboard. */
  machineKey: string;
}) {
  if (para.kind === "ready") {
    return (
      <div class="hud-para hud-para-ready" role="status">
        <span class="hud-para-word">{STRINGS.startRunPara}</span>
        <span class="hud-para-hint">{STRINGS.paraReady(touch)}</span>
        <span class="hud-para-hint">{STRINGS.paraDrop(touch, machineKey)}</span>
      </div>
    );
  }
  const share = Math.max(-1, Math.min(1, para.climb / VARIO_FULL));
  return (
    <div class="hud-para" role="status">
      <div class="hud-para-strip">
        <span class="hud-para-cell">
          <span class="hud-para-num">{STRINGS.paraAltValue(para.height)}</span>
          <span class="hud-para-sub">{STRINGS.paraAlt}</span>
        </span>
        <span class="hud-para-cell hud-para-vario">
          <span class="hud-para-bar" aria-hidden="true">
            <span
              class={share >= 0 ? "hud-para-up" : "hud-para-down"}
              style={{ height: `${(Math.abs(share) * 50).toFixed(1)}%` }}
            />
          </span>
          <span class="hud-para-num">{STRINGS.paraVarioValue(para.climb)}</span>
          <span class="hud-para-sub">{STRINGS.paraVario}</span>
        </span>
        <span class="hud-para-cell">
          <span class="hud-para-num">{STRINGS.paraAirValue(para.air)}</span>
          <span class="hud-para-sub">{STRINGS.paraAir}</span>
        </span>
        <span class={`hud-para-cell${para.rough >= ROUGH ? " hud-para-gusty" : ""}`}>
          <span class="hud-para-num">{STRINGS.paraWindValue(para.wind)}</span>
          <span class="hud-para-sub">{STRINGS.paraWind}</span>
        </span>
        <span class="hud-para-cell hud-para-thr">
          <span class="hud-para-gauge" aria-hidden="true">
            <span class="hud-para-rev" style={{ width: `${(para.rev * 100).toFixed(0)}%` }} />
            <span class="hud-para-hand" style={{ left: `${(para.throttle * 100).toFixed(0)}%` }} />
          </span>
          <span class="hud-para-sub">{STRINGS.paraThrottle}</span>
        </span>
      </div>
      {para.stalled ? (
        <span class="hud-para-stall">{STRINGS.paraStall}</span>
      ) : para.fold >= FOLDED ? (
        <span class="hud-para-stall">{STRINGS.paraFold(para.foldSide)}</span>
      ) : para.kind === "riding" ? (
        <span class="hud-para-word">{STRINGS.paraRiding}</span>
      ) : (
        para.rough >= ROUGH && <span class="hud-para-rough">{STRINGS.paraRough}</span>
      )}
      <span class="hud-para-hint">{STRINGS.paraDrop(touch, machineKey)}</span>
    </div>
  );
}
