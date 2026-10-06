// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CALL TO A MACHINE, PRESSABLE: stood beside the snowmobile or the
// helicopter's skid (`sledWithin`, `heliWithin`), the word that it is there
// becomes a button — tapped or clicked, it is the machine press, ENTER's
// (`InputManager.requestMachine`). The double tap still works; this is the
// door a player sees. Pressed through the pointer events (the framework's
// `input/hud-press`), as every HUD press is, because a thumb may already be
// on a zone.

import { useMemo } from "preact/hooks";

import { createHudPress, pressHandlers } from "@niclaslindstedt/oss-game-framework/input/hud-press";

export function MachinePress({
  word,
  sub,
  kind,
  onBoard,
}: {
  word: string;
  sub: string;
  /** Which machine: the class its readout is styled by. */
  kind: "sled" | "heli";
  onBoard: () => void;
}) {
  const press = useMemo(createHudPress, []);
  return (
    <button
      type="button"
      class={`hud-${kind} hud-${kind}-call hud-machine-press`}
      aria-label={`${word} — ${sub}`}
      {...pressHandlers(press, onBoard)}
      onMouseUp={(e) => (e.currentTarget as HTMLButtonElement).blur()}
    >
      <span class={`hud-${kind}-word`}>{word}</span>
      <span class={`hud-${kind}-sub`}>{sub}</span>
    </button>
  );
}
