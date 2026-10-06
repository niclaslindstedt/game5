// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE'S INSTRUMENT (`sled.ts`) — top centre, in the air clock's
// place: the speed is the HUD's own speedo already (the skier rides at the
// machine's way), so the one thing more a rider reads is THE TACHOMETER —
// the two-stroke's rpm swept round an arc, the band where the clutch has
// engaged and the pipe comes on marked, the needle red past the peak, and
// a word when the belt is spinning in the snow. Under it, how to ski off.
// And while it waits near him, the word that it is there and how far — and
// stood beside it, the machine key that takes it.
// Every figure is the snapshot's (`sledOf`).

import { SLED } from "@engine";
import type { HudSled } from "./snapshot.ts";
import { MachinePress } from "./hud-machine-press.tsx";
import { STRINGS } from "./strings.ts";

/** The arc the needle sweeps, rad from straight up: −135° to +135°. */
const SWEEP = (Math.PI * 3) / 4;

function at(share: number, r: number): string {
  const a = -SWEEP + 2 * SWEEP * share;
  return `${(Math.sin(a) * r).toFixed(1)} ${(-Math.cos(a) * r).toFixed(1)}`;
}

function arc(from: number, to: number, r: number): string {
  const large = (to - from) * 2 * SWEEP > Math.PI ? 1 : 0;
  return `M ${at(from, r)} A ${r} ${r} 0 ${large} 1 ${at(to, r)}`;
}

export function SledReadout({
  sled,
  touch,
  machineKey,
  onBoard,
}: {
  sled: HudSled;
  touch: boolean;
  /** The machine key as bound, as the player reads it off the keyboard. */
  machineKey: string;
  /** The call tapped while he stands beside it: the machine press. */
  onBoard: () => void;
}) {
  if (sled.kind === "waiting") {
    if (sled.near)
      return (
        <MachinePress
          word={STRINGS.sledCall}
          sub={STRINGS.sledTake(touch, machineKey)}
          kind="sled"
          onBoard={onBoard}
        />
      );
    return (
      <div class="hud-sled hud-sled-call" role="status">
        <span class="hud-sled-word">{STRINGS.sledCall}</span>
        <span class="hud-sled-sub">{STRINGS.sledAway(sled.away)}</span>
      </div>
    );
  }
  const engage = SLED.engageRpm / SLED.maxRpm;
  const peak = SLED.peakRpm / SLED.maxRpm;
  const a = -SWEEP + 2 * SWEEP * sled.rev;
  return (
    <div class="hud-sled" role="status">
      <svg class="hud-sled-tach" viewBox="-40 -40 80 66" aria-hidden="true">
        <path d={arc(0, 1, 32)} class="hud-sled-track" />
        <path d={arc(engage, peak, 32)} class="hud-sled-band" />
        <path d={arc(peak, 1, 32)} class="hud-sled-red" />
        <path d={arc(0, Math.max(0.001, sled.throttle), 26)} class="hud-sled-thumb" />
        <line
          x1="0"
          y1="0"
          x2={(Math.sin(a) * 30).toFixed(1)}
          y2={(-Math.cos(a) * 30).toFixed(1)}
          class={sled.rev > peak ? "hud-sled-needle hud-sled-over" : "hud-sled-needle"}
        />
        <circle r="3" class="hud-sled-hub" />
        <text y="20" class="hud-sled-rpm">
          {STRINGS.sledRpmValue(sled.rpm)}
        </text>
      </svg>
      <span class="hud-sled-sub">{sled.spin ? STRINGS.sledSpin : STRINGS.sledRpm}</span>
      <span class="hud-sled-hint">{STRINGS.sledOff(touch, machineKey)}</span>
    </div>
  );
}
