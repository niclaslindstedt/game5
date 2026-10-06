// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AFTERSKI ON THE HUD (`afterski-hud.ts`'s reading): the call to a
// lodge's door as he skis up to it — at the door, the machine press that
// takes him in — the room's readout while he is in (the beers, another
// round, the way out), the skis still to fetch after a buzzed fall; and
// THE BUZZ METER, a beer glass filled to his buzz with its word under it,
// shown whenever he has had any.

import type { HudAfterski } from "./afterski-hud.ts";
import { MachinePress } from "./hud-machine-press.tsx";
import { STRINGS } from "./strings.ts";

export function AfterskiReadout({
  afterski,
  touch,
  machineKey,
  onPress,
}: {
  afterski: HudAfterski;
  touch: boolean;
  machineKey: string;
  /** The machine press: in at the door, out from inside. */
  onPress: () => void;
}) {
  if (afterski.kind === "call") {
    if (afterski.near)
      return (
        <MachinePress
          word={STRINGS.afterskiCall}
          sub={STRINGS.afterskiTake(touch, machineKey)}
          kind="afterski"
          onBoard={onPress}
        />
      );
    return (
      <div class="hud-afterski hud-afterski-call" role="status">
        <span class="hud-afterski-word">{STRINGS.afterskiCall}</span>
        <span class="hud-afterski-sub">{STRINGS.afterskiAway(afterski.away)}</span>
      </div>
    );
  }
  if (afterski.kind === "fetch") {
    return (
      <div class="hud-afterski hud-afterski-fetch" role="status">
        <span class="hud-afterski-word">{STRINGS.fetchWord}</span>
        <span class="hud-afterski-sub">{STRINGS.fetchLeft(afterski.left)}</span>
        <span class="hud-afterski-hint">{STRINGS.fetchHint(touch, "R")}</span>
      </div>
    );
  }
  return (
    <>
      <div class="hud-afterski hud-afterski-room" role="status">
        <span class="hud-afterski-word">{STRINGS.afterskiInside}</span>
        <span class="hud-afterski-sub">{STRINGS.afterskiBeers(afterski.beers)}</span>
        <span class="hud-afterski-hint">{STRINGS.afterskiRound}</span>
      </div>
      <MachinePress
        word={STRINGS.afterskiCall}
        sub={STRINGS.afterskiLeave(touch, machineKey)}
        kind="afterski"
        onBoard={onPress}
      />
    </>
  );
}

/** THE BUZZ METER: a beer glass, its beer risen to `buzz` under a head of
 * foam, the word for how far gone he is beside it. */
export function BuzzMeter({ buzz }: { buzz: number }) {
  const b = Math.max(0, Math.min(1, buzz));
  // The glass's inside runs from y 46 (the foot) up to y 10 (the rim).
  const top = 46 - 34 * b;
  return (
    <div
      class="hud-buzz"
      role="meter"
      aria-label={STRINGS.buzzLabel}
      aria-valuenow={Math.round(b * 100)}
    >
      <svg class="hud-buzz-glass" viewBox="0 0 44 52" aria-hidden="true">
        <path d="M 8 8 L 10 48 L 30 48 L 32 8 Z" class="hud-buzz-back" />
        <path
          d={`M ${8 + (2 * (top - 8)) / 40} ${top} L 10 46 L 30 46 L ${32 - (2 * (top - 8)) / 40} ${top} Z`}
          class="hud-buzz-beer"
        />
        {b > 0.02 && (
          <rect
            x={8.5 + (2 * (top - 8)) / 40}
            y={top - 3}
            width={23 - (4 * (top - 8)) / 40}
            height="4"
            rx="2"
            class="hud-buzz-foam"
          />
        )}
        <path d="M 8 8 L 10 48 L 30 48 L 32 8" class="hud-buzz-rim" />
        <path d="M 32 16 C 42 16 42 34 31 34" class="hud-buzz-rim" />
      </svg>
      <span class="hud-buzz-label">{STRINGS.buzzLabel}</span>
      <span class="hud-buzz-word">{STRINGS.buzzWord(b)}</span>
    </div>
  );
}
