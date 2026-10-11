// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI CARD — which pair, on a screen of its own, and the last thing
// between the skier and the start line.
//
// A ROW OF NAMES CANNOT ASK THIS QUESTION. "HARE / FOX / IBEX / STOAT /
// MARMOT / HARE" asks a skier to choose between seven pairs they have
// never seen by picking one of seven words, and the catalog is seven
// answers to a kind of snow. So it takes a card, the way the sibling games give the car and
// the pair theirs: the skis turning on their rack, drawn by the builder
// the race draws with, with the numbers beside it.
//
// IT IS THE LAST CARD BEFORE THE SNOW, and RIDE is on it. The front door's
// RACE tile says where (the seed on it); this card says what with, and then
// goes — so the last picture a skier sees before the loading card is the
// pair they are about to stand on.
//
// TWO THINGS ARE ON IT: THE SKIS, which is the decision, and the readings
// beside it — five figures and three bars (`ski-stats.ts`). The card's one
// line of prose is the catalog's own blurb, standing in the picture under
// the pair. It WRITES `settings.skis`; a race stood up from here and one
// a `?skis=` link boots into read the same pair the same way. A pair is
// sold in one topsheet, so there is nothing to paint here; what the skier
// on it WEARS is a press away, on the DRESS card (`menu-dress.tsx`).
//
// THE SNOWBOARD is on the same rack, after the skis, wherever a run lets a
// free choice of pair (`boards`): the card is then the SNOWBOARD card, its
// figures the board's own (the stance and the bindings' angles beside the
// length, the waist and the sidecut) and its press RIDE.

import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { pairById, riderById, withRider, type PairId } from "@engine";

import { COUNT_SECONDS, countAt } from "@niclaslindstedt/oss-game-framework/hud/count";
import { useBusyPress } from "./busy-press.ts";
import { MenuBody, MenuHead } from "./menu-knobs.tsx";
import type { Outfit } from "./outfit.ts";
import { SkisPicker } from "./ski-picker.tsx";
import { skisBars, skisFacts, type SkisFact } from "./ski-stats.ts";
import { STRINGS } from "./strings.ts";

/** ONE FIGURE, WHICH COUNTS. A number that swaps between two frames is one
 * the skier has to notice changed; one that rolls to its new value is one
 * they watch change. Its own component, so the frames it asks for repaint a
 * number and not the card. */
function Figure({ fact }: { fact: SkisFact }) {
  const shown = useRef(fact.value);
  const [, tick] = useState(0);
  useEffect(() => {
    const from = shown.current;
    if (from === fact.value) return;
    const start = performance.now();
    let raf = 0;
    const frame = (now: number): void => {
      const at = (now - start) / 1000;
      shown.current = countAt(from, fact.value, at);
      tick((n) => n + 1);
      if (at < COUNT_SECONDS) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [fact.value]);
  return (
    <div class="skis-figure">
      <span class="skis-figure-label">{fact.label}</span>
      <span class="skis-figure-value">
        {shown.current.toFixed(fact.places)}
        <span class="skis-figure-unit">{fact.unit}</span>
      </span>
    </div>
  );
}

/** THE WAY TO THE DRESS CARD: the skier on the pair is the player, and
 * what he wears is picked on a card of its own (`menu-dress.tsx`) — a
 * press here, so the ski card stays the decision it is. */
function DressButton({ onDress, board = false }: { onDress: () => void; board?: boolean }) {
  return (
    <div class="skis-dress-row">
      <button type="button" class="menu-item skis-dress" data-menu="dress" onClick={onDress}>
        <span class="menu-item-name">{board ? STRINGS.boardDress : STRINGS.skisDress}</span>
      </button>
    </div>
  );
}

/** The readings beside the pair: the figures saying what it IS — its top
 * speed under the skier's own build (`Outfit.weight`) — and the bars saying
 * what it is against the others. */
function SkisReadings({
  skis,
  outfit,
  children,
}: {
  skis: PairId;
  outfit: Outfit;
  children?: ComponentChildren;
}) {
  const spec = pairById(skis);
  return (
    <div class="skis-spec">
      <div class="skis-figures">
        {skisFacts(withRider(spec, riderById(outfit.weight))).map((fact) => (
          <Figure key={fact.key} fact={fact} />
        ))}
      </div>
      <div class="skis-bars">
        {skisBars(spec).map((bar) => (
          <div key={bar.key} class="skis-bar">
            <span class="skis-bar-label">{bar.label}</span>
            <span class="skis-bar-track">
              <span class="skis-bar-fill" style={{ width: `${(bar.value * 100).toFixed(1)}%` }} />
            </span>
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}

export function SkisPage({
  skis,
  outfit,
  boards = false,
  onPick,
  onDress,
  onBack,
  onRide,
}: {
  skis: PairId;
  /** What the skier on the pair wears (`Settings.outfit`). */
  outfit: Outfit;
  /** Whether the snowboard is on the rack (`settings.ts`'s `boardAllowed`). */
  boards?: boolean;
  onPick: (id: PairId) => void;
  /** To the DRESS card. */
  onDress: () => void;
  /** Back to the front door, which is the way in. */
  onBack: () => void;
  /** The press that stands the race up — this card is the end of the flow. */
  onRide: () => void;
}) {
  const spec = pairById(skis);
  const board = spec.board !== undefined;
  const [busy, ride] = useBusyPress(onRide);
  return (
    <div class="menu-card menu-card-skis">
      <MenuHead
        back={onBack}
        backLabel={STRINGS.menuBack}
        title={board ? STRINGS.boardTitle : STRINGS.skisTitle}
        /* The press that rides stands in the head opposite the way back, as
           on every card a run is picked on, wearing the way-on's weight and
           marked as this surface's `next` — so START from anywhere on the
           card is the start line, and the pair below can take the height. */
        action={
          <button
            type="button"
            class="menu-item menu-item-start menu-head-go skis-done"
            data-menu="ride"
            data-nav-next
            data-busy={busy ? "1" : undefined}
            aria-busy={busy}
            onClick={ride}
          >
            <span class="menu-item-name">{board ? STRINGS.boardRide : STRINGS.skisRide}</span>
            {busy && <span class="menu-busy" aria-hidden="true" />}
          </button>
        }
      />
      <MenuBody>
        <div class="skis-pick-body">
          {/* THE SKIS takes the room: it is the only thing on this card that
            cannot be said in words. */}
          <div class="skis-stage-col">
            <SkisPicker skis={skis} outfit={outfit} boards={boards} onPick={onPick} />
            <p class="skis-blurb">{spec.blurb}</p>
          </div>
          <SkisReadings skis={skis} outfit={outfit}>
            <DressButton onDress={onDress} board={board} />
          </SkisReadings>
        </div>
      </MenuBody>
    </div>
  );
}
