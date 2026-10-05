// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RACE CARD — the disciplines, opened by the front door's one RACE tile:
// every race the game names (`DISCIPLINES`), the built ones a box each that
// goes on to its level card, the rest named and dimmed as coming. One tile
// and a card of its own rather than a tile a discipline, because six do not
// fit a front door a phone holds upright and the races are one choice —
// which race — before the map.
//
// A box is the discipline's name, its format and the map its race stands on
// (`frontDoorPins`) — or the seed a link pinned instead. The card wears the
// level card's silhouette and classes, as the trick map card does.

import { DISCIPLINES, DOWNHILL, SLALOM, SPEED_SKI, SUPER_G, type GameMode } from "@engine";

import { Glyph } from "./menu-glyphs.tsx";
import { MenuBody, MenuHead } from "./menu-knobs.tsx";
import { STRINGS } from "./strings.ts";

/** Each built discipline's format, by its mode. */
function formatOf(mode: GameMode): string {
  if (mode === "superG") return STRINGS.racesSuperG(SUPER_G.field + 1);
  if (mode === "speedSki") return STRINGS.racesSpeedSki(SPEED_SKI.field + 1);
  if (mode === "downhill") return STRINGS.racesDownhill(DOWNHILL.field + 1);
  return STRINGS.racesSlalom(SLALOM.field + 1);
}

export function RacesPage({
  maps,
  chosen,
  onBack,
  onPick,
}: {
  /** The map each built discipline's race stands on, by its mode — its
   * name, or the line a link's seed puts there. */
  maps: Partial<Record<GameMode, string>>;
  /** The discipline last opened, where the cursor lands. */
  chosen: GameMode;
  onBack: () => void;
  /** On to the discipline's level card. */
  onPick: (mode: GameMode) => void;
}) {
  const built = DISCIPLINES.filter((d) => d.mode !== null);
  const landing = built.some((d) => d.mode === chosen) ? chosen : built[0]?.mode;
  return (
    <div class="menu-card menu-card-levels menu-card-races">
      <MenuHead back={onBack} backLabel={STRINGS.menuBack} title={STRINGS.racesTitle} />
      <MenuBody>
        <div class="menu-levels menu-races">
          {DISCIPLINES.map(({ id, mode }) =>
            mode === null ? (
              <div
                key={id}
                class="menu-level menu-level-locked menu-race-soon"
                aria-label={`${STRINGS.disciplines[id]} — ${STRINGS.racesComing}`}
              >
                <span class="menu-level-name">{STRINGS.disciplines[id]}</span>
                <span class="menu-level-billing">{STRINGS.racesComing}</span>
              </div>
            ) : (
              <button
                key={id}
                type="button"
                class={`menu-level menu-level-open${mode === landing ? " menu-level-next" : ""}`}
                data-menu={mode}
                data-nav-next={mode === landing ? "" : undefined}
                data-nav-focus={mode === landing ? "" : undefined}
                onClick={() => onPick(mode)}
              >
                <span class="menu-level-head">
                  <Glyph name="flag" className="menu-level-mode" />
                  <span class="menu-level-billing">{formatOf(mode)}</span>
                </span>
                <span class="menu-level-name">{STRINGS.disciplines[id]}</span>
                <span class="menu-level-day">{maps[mode] ?? ""}</span>
              </button>
            ),
          )}
        </div>
      </MenuBody>
    </div>
  );
}
