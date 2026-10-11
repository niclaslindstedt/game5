// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF A SNOWBOARDER'S TRICKS — a block of the one strings table
// (`strings.ts`, §39.1) stated next door: the board's seven grabs as the
// sport calls them, and a spin read as a rider's, "SWITCH BACKSIDE 360",
// "NOLLIE FRONTSIDE 180" (the side, the switch and the nollie are the
// engine's, `board-tricks.ts`'s `spinTag`, carried on the combo's part).

import type { BoardGrab, SpinTag } from "@engine";

/** The board's grabs (`BoardGrab`), as a combo line and a judge read them. */
export const BOARD_GRAB_WORDS: Readonly<Record<BoardGrab, string>> = {
  indy: "INDY",
  mute: "MUTE",
  melon: "MELON",
  stalefish: "STALEFISH",
  method: "METHOD",
  nose: "NOSE GRAB",
  tail: "TAIL GRAB",
};

/** A spin's side (`spinSide`), as a combo line and a judge read it. */
export const BOARD_SIDE_WORDS: Readonly<Record<"frontside" | "backside", string>> = {
  frontside: "FRONTSIDE",
  backside: "BACKSIDE",
};

/** A spin of `degrees` as a board rider's: its words in front of the
 * figure — SWITCH, or NOLLIE off the nose, then the side. On skis (no
 * side in the tag) the figure alone. */
export function boardSpinWord(degrees: number, tag: SpinTag): string {
  const words: string[] = [];
  if (tag.switched) words.push("SWITCH");
  else if (tag.nollie) words.push("NOLLIE");
  if (tag.side) words.push(BOARD_SIDE_WORDS[tag.side]);
  words.push(String(degrees));
  return words.join(" ");
}
