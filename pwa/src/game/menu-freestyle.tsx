// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TRICKS CARD — what the front door's TRICKS tile opens: the PARK RUN
// (two minutes on a trick map's terrain park, scored combo by combo) and
// every FREESTYLE FORMAT the game names (`FREESTYLE`), the built ones a box
// each that goes on to the trick map card, the rest named and dimmed as
// coming. The race card's shape (`menu-races.tsx`) for the same reason: the
// formats are one choice — which contest — before the map.

import { BIG_AIR, FREESTYLE, KNUCKLE_HUCK, TRICKS_RUN, type GameMode } from "@engine";

import { Glyph } from "./menu-glyphs.tsx";
import { MenuBody, MenuHead } from "./menu-knobs.tsx";
import { STRINGS } from "./strings.ts";

/** Each built format's line, by its mode. */
function formatOf(mode: GameMode): string {
  if (mode === "bigAir") return STRINGS.freestyleBigAir(BIG_AIR.field + 1, BIG_AIR.finalists);
  if (mode === "knuckleHuck") {
    return STRINGS.freestyleKnuckle(KNUCKLE_HUCK.field + 1, KNUCKLE_HUCK.jam);
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
  const built: GameMode[] = [
    "tricks",
    ...FREESTYLE.flatMap((f) => (f.mode === null ? [] : [f.mode])),
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
          {box("tricks", STRINGS.freestylePark)}
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
        </div>
      </MenuBody>
    </div>
  );
}
