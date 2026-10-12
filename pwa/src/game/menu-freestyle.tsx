// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TRICKS CARD — what the front door's TRICKS tile opens: the PARK RUN
// (two minutes on a trick map's terrain park, scored combo by combo) after
// every FREESTYLE FORMAT the game names (`FREESTYLE`, ski jumping first),
// the built ones a box each that goes on to the trick map card, the rest
// named and dimmed as coming. The race card's shape (`menu-races.tsx`) for the same reason: the
// formats are one choice — which contest — before the map.

import {
  AERIALS,
  FREESTYLE,
  HALFPIPE,
  MOGULS,
  SKI_JUMP,
  SLOPESTYLE,
  TRICKS_RUN,
  type GameMode,
} from "@engine";

import { Glyph } from "./menu-glyphs.tsx";
import { MenuBody, MenuHead } from "./menu-knobs.tsx";
import { STRINGS } from "./strings.ts";
import { hillSizes } from "./jump-hills.ts";

/** Each built format's line, by its mode. */
function formatOf(mode: GameMode): string {
  if (mode === "skiJump") {
    return STRINGS.freestyleSkiJump(hillSizes(), SKI_JUMP.field + 1, SKI_JUMP.final);
  }
  if (mode === "slopestyle") {
    return STRINGS.freestyleSlopestyle(SLOPESTYLE.field + 1, SLOPESTYLE.finalists);
  }
  if (mode === "moguls") {
    return STRINGS.freestyleMoguls(MOGULS.field + 1, MOGULS.final1, MOGULS.final2);
  }
  if (mode === "aerials") {
    return STRINGS.freestyleAerials(AERIALS.field + 1, AERIALS.final1, AERIALS.final2);
  }
  if (mode === "halfpipe") {
    return STRINGS.freestyleHalfpipe(HALFPIPE.field + 1, HALFPIPE.finalists);
  }
  return STRINGS.freestyleParkLine(TRICKS_RUN.limit);
}

export function FreestylePage({
  chosen,
  onBack,
  onPick,
}: {
  /** The format last opened, where the cursor lands. */
  chosen: GameMode;
  onBack: () => void;
  /** On to the trick map card. */
  onPick: (mode: GameMode) => void;
}) {
  // SKI JUMPING heads the card and is lit where nothing was opened yet;
  // the park run follows the formats.
  const built: GameMode[] = [
    ...FREESTYLE.flatMap((f) => (f.mode === null ? [] : [f.mode])),
    "tricks",
  ];
  const landing = built.includes(chosen) ? chosen : built[0];
  const box = (mode: GameMode, name: string) => (
    <button
      key={mode}
      type="button"
      class={`menu-level menu-level-open${mode === landing ? " menu-level-next" : ""}`}
      data-menu={mode}
      data-nav-next={mode === landing ? "" : undefined}
      data-nav-focus={mode === landing ? "" : undefined}
      onClick={() => onPick(mode)}
    >
      <span class="menu-level-head">
        <Glyph name="flip" className="menu-level-mode" />
        <span class="menu-level-billing">{formatOf(mode)}</span>
      </span>
      <span class="menu-level-name">{name}</span>
    </button>
  );
  return (
    <div class="menu-card menu-card-levels menu-card-races">
      <MenuHead back={onBack} backLabel={STRINGS.menuBack} title={STRINGS.freestyleTitle} />
      <MenuBody>
        <div class="menu-levels menu-races">
          {FREESTYLE.map(({ id, mode }) =>
            mode === null ? (
              <div
                key={id}
                class="menu-level menu-level-locked menu-race-soon"
                aria-label={`${STRINGS.freestyle[id]} — ${STRINGS.racesComing}`}
              >
                <span class="menu-level-name">{STRINGS.freestyle[id]}</span>
                <span class="menu-level-billing">{STRINGS.racesComing}</span>
              </div>
            ) : (
              box(mode, STRINGS.freestyle[id])
            ),
          )}
          {box("tricks", STRINGS.freestylePark)}
        </div>
      </MenuBody>
    </div>
  );
}
