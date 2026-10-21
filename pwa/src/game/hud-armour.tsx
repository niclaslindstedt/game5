// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S VEHICLE'S READOUT (`armour.ts`) — top centre, in the piste
// machine's place (`hud-groomer.tsx`): while he drives one he took, its
// name, its speed and whether it backs or is knocked out — the tank's turret
// off the nose and its gun, loaded or loading, with the key that fires it —
// and how to climb out; stood at the door of one, the machine press that
// steals it (or takes his own back). Every figure is the snapshot's
// (`armour-hud.ts`).

import type { HudArmour } from "./armour-hud.ts";
import { MachinePress } from "./hud-machine-press.tsx";
import { STRINGS } from "./strings.ts";

export function ArmourReadout({
  armour,
  touch,
  machineKey,
  jumpKey,
  onBoard,
}: {
  armour: HudArmour;
  touch: boolean;
  /** The machine key as bound, as the player reads it off the keyboard. */
  machineKey: string;
  /** The jump key as bound: the tank's trigger. */
  jumpKey: string;
  /** The press tapped at its door: the machine press. */
  onBoard: () => void;
}) {
  if (armour.kind === "waiting")
    return (
      <MachinePress
        word={STRINGS.armourName(armour.vehicle)}
        sub={(armour.steal ? STRINGS.armourSteal : STRINGS.armourBoard)(touch, machineKey)}
        kind="sled"
        onBoard={onBoard}
      />
    );
  const word = armour.dead
    ? STRINGS.armourDead
    : armour.kmh < -0.5
      ? STRINGS.armourReverse
      : STRINGS.armourDrive;
  return (
    <div class="hud-sled hud-sled-call" role="status">
      <span class="hud-sled-word">{STRINGS.armourSpeed(armour.kmh)}</span>
      <span class="hud-sled-sub">
        {STRINGS.armourName(armour.vehicle)} · {word}
      </span>
      {armour.turret !== null && !armour.dead && (
        <span class="hud-sled-sub">
          {STRINGS.armourTurret(armour.turret)} ·{" "}
          {armour.loaded ? STRINGS.armourLoaded(touch, jumpKey) : STRINGS.armourLoading}
        </span>
      )}
      <span class="hud-sled-sub">{STRINGS.armourOff(touch, machineKey)}</span>
    </div>
  );
}
