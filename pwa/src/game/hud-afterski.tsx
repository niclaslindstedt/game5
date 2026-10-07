// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AFTERSKI ON THE HUD (`afterski-hud.ts`'s reading): the call to a
// lodge's door as he skis up to it — at the door, the machine press that
// takes him in — the room while he is in (the beers; the whole picture a
// press for another round, the jump's; a door to press to head out, the
// machine's), the skis still to fetch after a buzzed fall; and
// THE BUZZ METER, a beer glass filled to his buzz with its word under it,
// shown whenever he has had any.

import { useMemo } from "preact/hooks";

import { createHudPress, pressHandlers } from "@niclaslindstedt/oss-game-framework/input/hud-press";

import type { HudAfterski } from "./afterski-hud.ts";
import { MachinePress } from "./hud-machine-press.tsx";
import { STRINGS } from "./strings.ts";

export function AfterskiReadout({
  afterski,
  touch,
  machineKey,
  jumpKey,
  onPress,
  onDrink,
}: {
  afterski: HudAfterski;
  touch: boolean;
  machineKey: string;
  /** The jump key as bound: another round in the room. */
  jumpKey: string;
  /** The machine press: in at the door, out from inside. */
  onPress: () => void;
  /** The jump press: another round, inside. */
  onDrink: () => void;
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
    <AfterskiRoom
      afterski={afterski}
      touch={touch}
      jumpKey={jumpKey}
      onPress={onPress}
      onDrink={onDrink}
    />
  );
}

/** THE ROOM: the readout at the top, the whole picture a press for another
 * round (a tap or a click anywhere — the jump key's, SPACE as bound), and a
 * DOOR at the foot of the glass that is the way out (ENTER's). */
function AfterskiRoom({
  afterski,
  touch,
  jumpKey,
  onPress,
  onDrink,
}: {
  afterski: Extract<HudAfterski, { kind: "inside" }>;
  touch: boolean;
  jumpKey: string;
  onPress: () => void;
  onDrink: () => void;
}) {
  const drink = useMemo(createHudPress, []);
  const door = useMemo(createHudPress, []);
  const blur = (e: Event): void => (e.currentTarget as HTMLButtonElement).blur();
  return (
    <>
      <button
        type="button"
        class="hud-afterski-tap"
        aria-label={STRINGS.afterskiRound(touch, jumpKey)}
        {...pressHandlers(drink, onDrink)}
        onMouseUp={blur}
      />
      <div class="hud-afterski hud-afterski-room" role="status">
        <span class="hud-afterski-word">{STRINGS.afterskiInside}</span>
        <span class="hud-afterski-sub">{STRINGS.afterskiBeers(afterski.beers)}</span>
        <span class="hud-afterski-hint">
          {afterski.drinking ? STRINGS.afterskiCheers : STRINGS.afterskiRound(touch, jumpKey)}
        </span>
      </div>
      <button
        type="button"
        class="hud-afterski-door"
        aria-label={STRINGS.afterskiLeave}
        {...pressHandlers(door, onPress)}
        onMouseUp={blur}
      >
        <DoorIcon />
        <span class="hud-afterski-door-word">{STRINGS.afterskiLeave}</span>
      </button>
    </>
  );
}

/** A door ajar in its frame, an arrow out through it. */
function DoorIcon() {
  return (
    <svg class="hud-afterski-door-icon" viewBox="0 0 48 48" aria-hidden="true">
      <path class="hud-afterski-door-frame" d="M10 44V6h20v38" />
      <path class="hud-afterski-door-leaf" d="M10 6l14 5v36l-14-3z" />
      <circle class="hud-afterski-door-knob" cx="20" cy="27" r="1.8" />
      <path class="hud-afterski-door-arrow" d="M31 25h13M39 20l5 5-5 5" />
    </svg>
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
