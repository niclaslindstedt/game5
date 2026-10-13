// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER CARD — who rides, the first card after the map is picked and
// before the gear (`menu-skis.tsx`): pick the rider, customize him, then
// pick what he rides. Six rows (`outfit.ts`): the BODY and its WEIGHT — the
// one row the engine reads too (`defs/riders.ts`: a heavier skier runs
// faster downhill, skates up to speed slower, lands harder and shoulders
// harder) — then a piece of kit a row, the JACKET, the PANTS, the HELMET
// and the GLOVES, each stepped through its catalog — over the rider himself
// on the snow, off his skis in his boots and waiting at ease (the stage
// behind both cards, `menu-stage.tsx`), so a piece is judged on him rather
// than by its name. (The POLES go with the skis, so they are picked on the
// gear card's SKIS side.)
//
// A PIECE IS SOLD IN ITS OWN COLOURS. There is nothing to paint: a row
// picks the piece, and the piece is the colours it comes in — as a pair of
// skis is its topsheet. It WRITES `settings.outfit`; NEXT is the gear card,
// and RIDE is there — except on a free ride flown in a WINGSUIT, where no
// skis or board go with him: the gear card is skipped and FLY here rides.

import { isBoardId, raceSkisOf, type GameMode, type PairId } from "@engine";

import { MenuBody, MenuHead, StepRow, type Stop } from "./menu-knobs.tsx";
import { SkisPage } from "./menu-skis.tsx";
import { boardAllowed, kindPair, pickPair, type Settings } from "./settings.ts";
import { GEAR, GEAR_SLOTS, gearOf, type GearSlot, type Outfit } from "./outfit.ts";
import { MODELS } from "./skier-models.ts";
import { MenuStage } from "./menu-stage.tsx";
import { useBusyPress } from "./busy-press.ts";
import { STRINGS } from "./strings.ts";

/** Each slot's catalog as a row's stops. */
const STOPS = Object.fromEntries(
  GEAR_SLOTS.map((slot) => [
    slot,
    (GEAR[slot] as readonly { id: string; name: string }[]).map((g) => ({
      id: g.id,
      label: g.name.toUpperCase(),
    })),
  ]),
) as Record<GearSlot, Stop<string>[]>;

/** The rows on the rider card: every slot but the POLES, which go with the
 * skis on the gear card. */
const RIDER_SLOTS = GEAR_SLOTS.filter((slot) => slot !== "poles");

/** The rows a MODELLED body (the guide, `player-model.ts`) keeps: he comes
 * in his own kit, so only what he is — the body and the weight — is picked. */
const MODEL_SLOTS = RIDER_SLOTS.filter((slot) => slot === "body" || slot === "weight");

export function DressPage({
  outfit,
  onOutfit,
  onBack,
  onNext,
  fly = null,
}: {
  outfit: Outfit;
  onOutfit: (outfit: Outfit) => void;
  /** Back to the card that opened the flow (the map, or the start card). */
  onBack: () => void;
  /** NEXT: on to the gear card. */
  onNext: () => void;
  /** A WINGSUIT ride: no gear to pick, so the way on is FLY and rides. */
  fly?: (() => void) | null;
}) {
  const [busy, go] = useBusyPress(fly ?? onNext);
  return (
    <div class="menu-card menu-card-dress menu-card-staged">
      <div class="stage-top" data-stage-cover>
        <MenuHead
          back={onBack}
          backLabel={STRINGS.menuBack}
          title={STRINGS.dressTitle}
          action={
            <button
              type="button"
              class="menu-item menu-item-start menu-head-go"
              data-menu={fly ? "ride" : "dress-done"}
              data-nav-next
              data-busy={fly && busy ? "1" : undefined}
              onClick={fly ? go : onNext}
            >
              <span class="menu-item-name">{fly ? STRINGS.dressFly : STRINGS.dressDone}</span>
              {fly && busy && <span class="menu-busy" aria-hidden="true" />}
            </button>
          }
        />
      </div>
      <div class="stage-sheet" data-stage-cover>
        <MenuBody>
          <div class="dress-rows">
            {/* The POLES are the gear card's, with the skis. */}
            {(gearOf("body", outfit.body).model && MODELS.player ? MODEL_SLOTS : RIDER_SLOTS).map(
              (slot) => (
                <StepRow
                  key={slot}
                  label={STRINGS.dressSlots[slot]}
                  stops={STOPS[slot]}
                  value={outfit[slot]}
                  onPick={(id) => onOutfit({ ...outfit, [slot]: id })}
                />
              ),
            )}
          </div>
        </MenuBody>
      </div>
    </div>
  );
}

/** THE RIDER CARD AND THE GEAR CARD after it, as the shell routes them: the
 * rider first (`page` "dress"), then the gear (`page` "skis"). The pair is
 * `settings.skis` (`onLink` drops a link's pair once one is picked), the
 * kit `settings.outfit`. The SNOWBOARD rack is offered only for a mode with
 * a free choice of pair (`boardAllowed`); a race or a contest opened over a
 * board picked for a free ride shows its own pair, or the skis last picked. */
export function SkisCards(p: {
  page: "skis" | "dress";
  mode: GameMode;
  skis: PairId;
  settings: Settings;
  onSettings: (f: (s: Settings) => Settings) => void;
  onLink: () => void;
  onPage: (page: "skis" | "dress") => void;
  onBack: () => void;
  onRide: () => void;
  /** A free ride flown in a WINGSUIT (`wingsuitOn`): no skis go with him, so
   * the rider card rides and the gear card is never shown. */
  noSkis?: boolean;
}) {
  const boards = boardAllowed(p.mode);
  const skis = !boards && isBoardId(p.skis) ? (raceSkisOf(p.mode) ?? p.settings.kept.skis) : p.skis;
  const outfit = (o: Outfit): void => p.onSettings((s) => ({ ...s, outfit: o }));
  const pick = (id: PairId): void => {
    p.onLink();
    p.onSettings((s) => pickPair(s, id));
  };
  // ONE STAGE behind both cards, kept as the player goes between them.
  return (
    <>
      <MenuStage
        shot={p.page === "dress" ? "rider" : "gear"}
        skis={skis}
        outfit={p.settings.outfit}
      />
      {p.page === "dress" ? (
        <DressPage
          outfit={p.settings.outfit}
          onOutfit={outfit}
          onBack={p.onBack}
          onNext={() => p.onPage("skis")}
          fly={p.noSkis ? p.onRide : null}
        />
      ) : (
        <SkisPage
          skis={skis}
          boards={boards}
          outfit={p.settings.outfit}
          onPick={pick}
          onKind={(board) => pick(kindPair(p.settings, board))}
          onOutfit={outfit}
          onBack={() => p.onPage("dress")}
          onRide={p.onRide}
        />
      )}
    </>
  );
}
