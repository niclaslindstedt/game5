// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SLALOM'S BOARD on the finish plate — the results table of the run, as
// `slalom-board.ts` works it out: the place, the start number, the player's
// row lit, the run's time (on the second run the first run's, this run's
// and the total), the gap to the leader; a racer out of it billed DSQ or
// DNF and where, under everyone home. Draws, decides nothing.
//
// THIRTY ROWS ARE MORE THAN A PHONE ON ITS SIDE HAS ROOM FOR, so the list
// is the one part of the plate that scrolls, and it opens scrolled to the
// player's own row — the one a racer looks for first.

import { useLayoutEffect, useRef } from "preact/hooks";

import { formatTime } from "@niclaslindstedt/oss-game-framework/hud/format";
import type { Standing } from "./snapshot.ts";
import { speedGapOf, speedOf } from "./speed-ski-run.ts";
import { STRINGS } from "./strings.ts";

const time = (t: number | null | undefined): string =>
  t === null || t === undefined ? "" : formatTime(t);

/** What a row says where its time would be: its time, or why it has none. */
function statusOf(r: Standing): string | null {
  if (r.out) return STRINGS.boardOut(r.out);
  if (r.waiting) return STRINGS.boardWaiting;
  if (r.time === null) return STRINGS.boardOnCourse;
  return null;
}

export function SlalomBoard({
  rows,
  second,
  zone = null,
}: {
  rows: Standing[];
  second: boolean;
  /** A SPEED RACE's timing zone, m (R34): every time read as a speed. */
  zone?: number | null;
}) {
  // A speed race's board in km/h, its gap the speed short of the leader's.
  const figure = (t: number | null | undefined): string => {
    if (zone === null) return time(t);
    const v = speedOf(t, zone);
    return v === null ? "" : STRINGS.boardSpeed(v);
  };
  const gapOf = (r: Standing): string => {
    if (r.gap === null || r.gap === undefined) return "";
    if (zone === null) return STRINGS.boardGap(r.gap);
    const dv = speedGapOf(r.total ?? r.time, r.gap, zone);
    return dv === null ? "" : STRINGS.boardSpeedGap(dv);
  };
  const list = useRef<HTMLOListElement>(null);
  const mine = rows.findIndex((r) => r.you);
  // Opened on the player's row, and again only when his row moves — never
  // while the skier is scrolling the list himself.
  useLayoutEffect(() => {
    const ol = list.current;
    const row = ol?.querySelector<HTMLElement>(".hud-board-you");
    if (!ol || !row) return;
    const top = row.offsetTop - ol.offsetTop;
    if (top < ol.scrollTop || top + row.offsetHeight > ol.scrollTop + ol.clientHeight) {
      ol.scrollTop = Math.max(0, top - (ol.clientHeight - row.offsetHeight) / 2);
    }
  }, [mine]);
  const head = STRINGS.boardHead;
  return (
    <div class="hud-board" data-second={second ? "1" : undefined}>
      <div class="hud-board-row hud-board-head" aria-hidden="true">
        <span>{head.place}</span>
        <span>{head.bib}</span>
        <span>{head.name}</span>
        {second && <span>{head.first}</span>}
        <span>{second ? head.second : zone !== null ? STRINGS.boardSpeedHead : head.time}</span>
        {second && <span>{head.total}</span>}
        <span>{head.gap}</span>
      </div>
      <ol class="hud-board-list" ref={list}>
        {rows.map((r) => {
          const status = statusOf(r);
          return (
            <li
              key={r.slot}
              class={`hud-board-row${r.you ? " hud-board-you" : ""}${r.out ? " hud-board-out" : ""}`}
            >
              <span class="hud-board-place">{r.place ?? ""}</span>
              <span class="hud-board-bib">{STRINGS.boardBib(r.bib ?? r.slot)}</span>
              <span class="hud-board-name">{r.you ? STRINGS.skierYou : ""}</span>
              {second && <span class="hud-board-time">{time(r.before)}</span>}
              {status !== null ? (
                <span class="hud-board-status">{status}</span>
              ) : (
                <>
                  <span class="hud-board-time">{figure(r.time)}</span>
                  {second && <span class="hud-board-time">{time(r.total)}</span>}
                  <span class="hud-board-gap">{gapOf(r)}</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
