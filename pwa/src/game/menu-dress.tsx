// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER CARD — who rides, the first card after the map is picked and
// before the gear (`menu-skis.tsx`): pick the rider, customize him, then
// pick what he rides. Six rows (`outfit.ts`): the BODY and its WEIGHT — the
// one row the engine reads too (`defs/riders.ts`: a heavier skier runs
// faster downhill, skates up to speed slower, lands harder and shoulders
// harder) — then a piece of kit a row, the JACKET, the PANTS, the HELMET
// and the GLOVES, each stepped through its catalog — and beside them the
// rider himself on the gear he last picked, turning on the gear card's own
// stand (`ski-turntable.ts`, framed on him), so a piece is judged on him
// rather than by its name. (The POLES go with the skis, so they are picked
// on the gear card's SKIS side.)
//
// A PIECE IS SOLD IN ITS OWN COLOURS. There is nothing to paint: a row
// picks the piece, and the piece is the colours it comes in — as a pair of
// skis is its topsheet. It WRITES `settings.outfit`; NEXT is the gear card,
// and RIDE is there.

import { useEffect, useRef } from "preact/hooks";
import { isBoardId, pairById, raceSkisOf, type GameMode, type PairId } from "@engine";

import { MenuBody, MenuHead, StepRow, type Stop } from "./menu-knobs.tsx";
import { SkisPage } from "./menu-skis.tsx";
import { boardAllowed, kindPair, pickPair, type Settings } from "./settings.ts";
import { GEAR, GEAR_SLOTS, type GearSlot, type Outfit } from "./outfit.ts";
import type { SkisTurntable } from "./ski-turntable.ts";
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

/** THE SKIER ON HIS STAND, framed on him. Its three.js is a chunk of its
 * own, pulled in as the ski card's is. */
function DressStand({ skis, outfit }: { skis: PairId; outfit: Outfit }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const standRef = useRef<SkisTurntable | null>(null);
  const wanted = useRef({ skis, outfit });
  wanted.current = { skis, outfit };
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    void import("./ski-turntable.ts").then(async ({ createSkisTurntable, loadModels }) => {
      await loadModels();
      if (disposed) return;
      standRef.current = createSkisTurntable(canvas, "skier");
      standRef.current.setSkis(pairById(wanted.current.skis), wanted.current.outfit);
    });
    const onResize = (): void => standRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      standRef.current?.dispose();
      standRef.current = null;
    };
  }, []);
  useEffect(() => standRef.current?.setSkis(pairById(skis), outfit), [skis, outfit]);
  return (
    <div class="dress-stage" role="presentation">
      <canvas ref={canvasRef} class="skis-pick-canvas" />
    </div>
  );
}

export function DressPage({
  skis,
  outfit,
  onOutfit,
  onBack,
  onNext,
}: {
  skis: PairId;
  outfit: Outfit;
  onOutfit: (outfit: Outfit) => void;
  /** Back to the card that opened the flow (the map, or the start card). */
  onBack: () => void;
  /** NEXT: on to the gear card. */
  onNext: () => void;
}) {
  return (
    <div class="menu-card menu-card-dress">
      <MenuHead
        back={onBack}
        backLabel={STRINGS.menuBack}
        title={STRINGS.dressTitle}
        action={
          <button
            type="button"
            class="menu-item menu-item-start menu-head-go"
            data-menu="dress-done"
            data-nav-next
            onClick={onNext}
          >
            <span class="menu-item-name">{STRINGS.dressDone}</span>
          </button>
        }
      />
      <MenuBody>
        <div class="dress-body">
          <DressStand skis={skis} outfit={outfit} />
          <div class="dress-rows">
            {/* The POLES are the gear card's, with the skis. */}
            {RIDER_SLOTS.map((slot) => (
              <StepRow
                key={slot}
                label={STRINGS.dressSlots[slot]}
                stops={STOPS[slot]}
                value={outfit[slot]}
                onPick={(id) => onOutfit({ ...outfit, [slot]: id })}
              />
            ))}
          </div>
        </div>
      </MenuBody>
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
}) {
  const boards = boardAllowed(p.mode);
  const skis = !boards && isBoardId(p.skis) ? (raceSkisOf(p.mode) ?? p.settings.kept.skis) : p.skis;
  const outfit = (o: Outfit): void => p.onSettings((s) => ({ ...s, outfit: o }));
  if (p.page === "dress") {
    return (
      <DressPage
        skis={skis}
        outfit={p.settings.outfit}
        onOutfit={outfit}
        onBack={p.onBack}
        onNext={() => p.onPage("skis")}
      />
    );
  }
  const pick = (id: PairId): void => {
    p.onLink();
    p.onSettings((s) => pickPair(s, id));
  };
  return (
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
  );
}
