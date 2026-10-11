// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GEAR CARD — what the rider rides, on a screen of its own, and the last
// thing between him and the start line.
//
// A ROW OF NAMES CANNOT ASK THIS QUESTION. "HARE / FOX / IBEX / STOAT /
// MARMOT / HARE" asks a skier to choose between pairs they have never seen
// by picking one of the words, and the catalog is answers to a kind of
// snow. So it takes a card, the way the sibling games give the car and the
// pair theirs: the gear turning on its rack, drawn by the builder the race
// draws with, with the numbers beside it.
//
// IT COMES AFTER THE RIDER. The rider card (`menu-dress.tsx`) is first: who
// rides, his build and his kit; this card is what he rides, and then goes —
// so the last picture before the loading card is the gear he is about to
// stand on. Its way back is the rider card.
//
// TWO RACKS, where a run lets a free choice of pair (`boards`: the free ride
// and the park run): a SKIS / SNOWBOARD switch at the card's head turns
// between the skis and the boards, each rack its own range with its own
// spec sheet (`ski-stats.ts`) — a board's figures its own (the stance and
// the bindings' angles beside the length, the waist and the sidecut) — and
// the switch hands back the pair of that kind last picked (`kindPair`).
// Where a discipline fixes its gear (a race on its racing pair, a contest
// on its own), only the skis are on the rack.
//
// THE POLES go with the skis: on the SKIS side the POLES row stands under
// the sheet (NONE the hard mode, `carriesPoles`); a board is ridden with
// empty hands, so its side has none. It WRITES `settings.skis` (and the
// kind's `kept` pick) and `settings.outfit.poles`; a race stood up from
// here and one a `?skis=` link boots into read the same pair the same way.

import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { pairById, riderById, withRider, type PairId } from "@engine";

import { COUNT_SECONDS, countAt } from "@niclaslindstedt/oss-game-framework/hud/count";
import { useBusyPress } from "./busy-press.ts";
import { MenuBody, MenuHead, StepRow } from "./menu-knobs.tsx";
import { carriesPoles, POLES, type Outfit } from "./outfit.ts";
import { SkisPicker } from "./ski-picker.tsx";
import { factNumber, skisBars, skisFacts, type SkisFact } from "./ski-stats.ts";
import { STRINGS } from "./strings.ts";

/** The POLES row's stops: the catalog's poles, NONE among them. */
const POLE_STOPS = POLES.map((p) => ({ id: p.id, label: p.name.toUpperCase() }));

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
        {factNumber(fact, shown.current)}
        <span class={fact.tight ? "skis-figure-unit skis-figure-unit-tight" : "skis-figure-unit"}>
          {fact.unit}
        </span>
      </span>
    </div>
  );
}

/** THE POLES, on the skis' side of the card: they go with the skis, so
 * they are picked with them — and NONE says what it costs under the row. */
function PolesRow({ outfit, onOutfit }: { outfit: Outfit; onOutfit: (o: Outfit) => void }) {
  return (
    <div class="gear-poles">
      <StepRow
        label={STRINGS.dressSlots.poles}
        stops={POLE_STOPS}
        value={outfit.poles}
        onPick={(poles) => onOutfit({ ...outfit, poles })}
      />
      {!carriesPoles(outfit) && (
        <p class="dress-note" role="note" data-menu="dress-no-poles">
          {STRINGS.dressNoPoles}
        </p>
      )}
    </div>
  );
}

/** THE SWITCH between the two racks: SKIS and SNOWBOARD, at the head of
 * the card. Not lit — the one lit control is the way onto the snow. */
function KindSwitch({ board, onKind }: { board: boolean; onKind: (board: boolean) => void }) {
  return (
    <div class="gear-kinds" role="tablist">
      {[false, true].map((b) => (
        <button
          key={String(b)}
          type="button"
          role="tab"
          aria-selected={b === board}
          class={b === board ? "gear-kind gear-kind-on" : "gear-kind"}
          data-menu={b ? "gear-board" : "gear-skis"}
          onClick={() => onKind(b)}
        >
          {b ? STRINGS.gearKinds.board : STRINGS.gearKinds.skis}
        </button>
      ))}
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
  onKind,
  onOutfit,
  onBack,
  onRide,
}: {
  skis: PairId;
  /** What the rider on the gear wears (`Settings.outfit`). */
  outfit: Outfit;
  /** Whether the SNOWBOARD rack is offered (`settings.ts`'s `boardAllowed`). */
  boards?: boolean;
  onPick: (id: PairId) => void;
  /** The switch at the head: to the skis' rack, or the boards'. */
  onKind: (board: boolean) => void;
  /** The POLES row: the kit with the poles changed. */
  onOutfit: (outfit: Outfit) => void;
  /** Back to the rider card, which is the way in. */
  onBack: () => void;
  /** The press that stands the race up — this card is the end of the flow. */
  onRide: () => void;
}) {
  const spec = pairById(skis);
  const board = spec.board !== undefined;
  const [busy, ride] = useBusyPress(onRide);
  return (
    <div class={boards ? "menu-card menu-card-skis menu-card-gear" : "menu-card menu-card-skis"}>
      <MenuHead
        back={onBack}
        backLabel={STRINGS.menuBack}
        title={boards ? STRINGS.gearTitle : board ? STRINGS.boardTitle : STRINGS.skisTitle}
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
      {boards && <KindSwitch board={board} onKind={onKind} />}
      <MenuBody>
        <div class="skis-pick-body">
          {/* THE GEAR takes the room: it is the only thing on this card that
            cannot be said in words. */}
          <div class="skis-stage-col">
            <SkisPicker skis={skis} outfit={outfit} board={board} onPick={onPick} />
            <p class="skis-blurb">{spec.blurb}</p>
          </div>
          <SkisReadings skis={skis} outfit={outfit}>
            {!board && <PolesRow outfit={outfit} onOutfit={onOutfit} />}
          </SkisReadings>
        </div>
      </MenuBody>
    </div>
  );
}
