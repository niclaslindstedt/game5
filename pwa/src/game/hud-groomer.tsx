// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE MACHINE'S READOUT (`groomer.ts`) — top centre, in the air
// clock's place, as the snowmobile's is (`hud-sled.tsx`): while he drives
// one, its name, its speed and whether the tiller is down and grooming, and
// how to climb out; while one works near him, its name and how far — and
// stood beside it, the machine key that takes him up into the cab. Every
// figure is the snapshot's (`groomerOf`).

import type { HudGroomer } from "./snapshot.ts";
import { MachinePress } from "./hud-machine-press.tsx";
import { STRINGS } from "./strings.ts";

export function GroomerReadout({
  groomer,
  touch,
  machineKey,
  onBoard,
}: {
  groomer: HudGroomer;
  touch: boolean;
  /** The machine key as bound, as the player reads it off the keyboard. */
  machineKey: string;
  /** The call tapped while he stands beside it: the machine press. */
  onBoard: () => void;
}) {
  if (groomer.kind === "waiting") {
    if (groomer.near)
      return (
        <MachinePress
          word={STRINGS.groomerCall}
          sub={STRINGS.groomerTake(touch, machineKey)}
          kind="sled"
          onBoard={onBoard}
        />
      );
    return (
      <div class="hud-sled hud-sled-call" role="status">
        <span class="hud-sled-word">{STRINGS.groomerCall}</span>
        <span class="hud-sled-sub">{STRINGS.groomerAway(groomer.away)}</span>
      </div>
    );
  }
  const word =
    groomer.kmh < -0.5
      ? STRINGS.groomerReverse
      : groomer.tiller
        ? STRINGS.groomerTiller
        : STRINGS.groomerIdle;
  return (
    <div class="hud-sled hud-sled-call" role="status">
      <span class="hud-sled-word">{STRINGS.groomerSpeed(groomer.kmh)}</span>
      <span class="hud-sled-sub">{word}</span>
      <span class="hud-sled-sub">{STRINGS.groomerOff(touch, machineKey)}</span>
    </div>
  );
}
