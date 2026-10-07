// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A FREESTYLE CONTEST'S BOARD on its plate — the rows `contest-board.ts`
// cut, each its place, its name and its figure, the player's row lit, and a
// GAP ROW wherever the places skip so the cut never reads as a tie for
// eighth. The five freestyle plates hand it their words; it decides
// nothing.

import { Fragment } from "preact";

import { STRINGS } from "./strings.ts";

export function ContestBoard<R extends { id: number; place: number; you: boolean }>({
  rows,
  name,
  figure,
}: {
  rows: R[];
  /** A row's name: the player's word, or the rival's bib. */
  name: (r: R) => string;
  /** What the row scored, worded. */
  figure: (r: R) => string;
}) {
  return (
    <ol class="hud-standings hud-bigair-board">
      {rows.map((r, i) => (
        <Fragment key={r.id}>
          {i > 0 && r.place > rows[i - 1].place + 1 && (
            <li class="hud-standing hud-standing-gap" aria-hidden="true">
              <span class="hud-standing-place">{STRINGS.boardGapRow}</span>
            </li>
          )}
          <li class={`hud-standing${r.you ? " hud-standing-you" : ""}`}>
            <span class="hud-standing-place">{r.place}</span>
            <span class="hud-standing-name">{name(r)}</span>
            <span class="hud-standing-time">{figure(r)}</span>
          </li>
        </Fragment>
      ))}
    </ol>
  );
}
