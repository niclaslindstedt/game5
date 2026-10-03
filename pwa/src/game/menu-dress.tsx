// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DRESS CARD — what the skier wears, behind the ski card's CUSTOMIZE
// SKIER press. Seven rows (`outfit.ts`): the BODY and its WEIGHT — the one
// row the engine reads too (`defs/riders.ts`: a heavier skier runs faster
// downhill, skates up to speed slower, lands harder and shoulders harder)
// — then a piece of kit a row, the JACKET, the PANTS, the HELMET, the
// GLOVES and the POLES, each stepped
// through its catalog — and beside them the skier himself on the pair he
// has picked, turning on the ski card's own stand (`ski-turntable.ts`,
// framed on him), so a piece is judged on him rather than by its name.
//
// A PIECE IS SOLD IN ITS OWN COLOURS. There is nothing to paint: a row
// picks the piece, and the piece is the colours it comes in — as a pair of
// skis is its topsheet. It WRITES `settings.outfit`; DONE (or the way
// back) is the ski card again, and RIDE is there.
//
// POLES: NONE is the hard mode (`carriesPoles`) — the one pick that is
// more than a look, so the card says what it costs under the rows.

import { useEffect, useRef } from "preact/hooks";
import { skisById, type SkiId } from "@engine";

import { MenuBody, MenuHead, StepRow, type Stop } from "./menu-knobs.tsx";
import { SkisPage } from "./menu-skis.tsx";
import type { Settings } from "./settings.ts";
import { carriesPoles, GEAR, GEAR_SLOTS, type GearSlot, type Outfit } from "./outfit.ts";
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

/** THE SKIER ON HIS STAND, framed on him. Its three.js is a chunk of its
 * own, pulled in as the ski card's is. */
function DressStand({ skis, outfit }: { skis: SkiId; outfit: Outfit }) {
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
      standRef.current.setSkis(skisById(wanted.current.skis), wanted.current.outfit);
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
  useEffect(() => standRef.current?.setSkis(skisById(skis), outfit), [skis, outfit]);
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
}: {
  skis: SkiId;
  outfit: Outfit;
  onOutfit: (outfit: Outfit) => void;
  /** Back to the ski card, which is the way in. */
  onBack: () => void;
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
            onClick={onBack}
          >
            <span class="menu-item-name">{STRINGS.dressDone}</span>
          </button>
        }
      />
      <MenuBody>
        <div class="dress-body">
          <DressStand skis={skis} outfit={outfit} />
          <div class="dress-rows">
            {GEAR_SLOTS.map((slot) => (
              <StepRow
                key={slot}
                label={STRINGS.dressSlots[slot]}
                stops={STOPS[slot]}
                value={outfit[slot]}
                onPick={(id) => onOutfit({ ...outfit, [slot]: id })}
              />
            ))}
            {!carriesPoles(outfit) && (
              <p class="dress-note" role="note" data-menu="dress-no-poles">
                {STRINGS.dressNoPoles}
              </p>
            )}
          </div>
        </div>
      </MenuBody>
    </div>
  );
}

/** THE SKI CARD AND THE DRESS CARD behind it, as the shell routes them: the
 * pair is `settings.skis` (`onLink` drops a link's pair once one is
 * picked), the kit `settings.outfit`. */
export function SkisCards(p: {
  page: "skis" | "dress";
  skis: SkiId;
  settings: Settings;
  onSettings: (f: (s: Settings) => Settings) => void;
  onLink: () => void;
  onPage: (page: "skis" | "dress") => void;
  onBack: () => void;
  onRide: () => void;
}) {
  if (p.page === "dress") {
    return (
      <DressPage
        skis={p.skis}
        outfit={p.settings.outfit}
        onOutfit={(outfit) => p.onSettings((s) => ({ ...s, outfit }))}
        onBack={() => p.onPage("skis")}
      />
    );
  }
  return (
    <SkisPage
      skis={p.skis}
      outfit={p.settings.outfit}
      onPick={(skis) => {
        p.onLink();
        p.onSettings((s) => ({ ...s, skis }));
      }}
      onDress={() => p.onPage("dress")}
      onBack={p.onBack}
      onRide={p.onRide}
    />
  );
}
