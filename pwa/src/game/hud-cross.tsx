// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI CROSS'S PLATE (R35) — the card over a ski-cross run the player is
// home in or out of, drawn by `ResultPlate` in place of its own.
//
// ON THE QUALIFICATION it says where he qualified and in what time, the
// board under it (`hud-board.tsx`, the start list skied before him); ON A
// HEAT his place of the four and the HEAT'S TABLE — the four in the order
// they came over the line, the first two marked THROUGH, a racer still on
// the course or out of it said so. A DNF in a heat is no out plate: a racer
// who fell can still be in the first two.
//
// UNDER IT, WHAT COMES NEXT (`ski-cross-run.ts`'s `CrossNext`): through to
// the next round, with its press first — or out, at his place in the final
// ranking, the rest of the bracket dealt to its end; or the big final
// raced, his podium place. Then the plate's usual ways on.

import { formatTime } from "@niclaslindstedt/oss-game-framework/hud/format";
import { SKI_CROSS } from "@engine";

import { SlalomBoard } from "./hud-board.tsx";
import type { HudSnapshot } from "./snapshot.ts";
import { STRINGS } from "./strings.ts";

export function CrossPlate({
  snap,
  touch,
  onAgain,
  onNew,
  onMenu,
  onReplay,
  onSecond,
}: {
  snap: HudSnapshot;
  touch: boolean;
  onAgain: () => void;
  onNew: () => void;
  onMenu: () => void;
  onReplay: (() => void) | null;
  onSecond: (() => void) | null;
}) {
  const cross = snap.cross;
  if (!cross) return null;
  const heat = cross.round !== "qualify";
  const next = cross.next;
  const onward = next?.kind === "heat" && onSecond !== null;
  const mine = cross.order.findIndex((r) => r.id === null) + 1;
  const result = snap.result;
  const out = snap.race?.out ?? null;
  return (
    <div class="hud hud-result-layer">
      <div class="hud-center">
        <div
          class={`hud-card hud-result hud-result-cross${next?.kind === "done" && next.place === 1 ? " hud-result-record" : ""}${heat ? "" : " hud-result-boarded"}`}
        >
          <span class="hud-card-note hud-result-label">
            {STRINGS.crossTitle(cross.round, cross.heat)}
          </span>
          {snap.course && <span class="hud-card-note">{snap.course}</span>}
          {heat ? (
            <span class="hud-card-title">{STRINGS.crossPlace(mine, cross.order.length)}</span>
          ) : out ? (
            <>
              <span class="hud-card-title hud-result-verdict">{STRINGS.outTitle(out.status)}</span>
              <span class="hud-card-note hud-result-why">{STRINGS.outWhy(out)}</span>
            </>
          ) : (
            result && (
              <span class="hud-card-title">
                {STRINGS.crossQualified(result.place, result.time)}
              </span>
            )
          )}
          {/* WHAT COMES NEXT. */}
          {next && (
            <span
              class="hud-card-note hud-result-award"
              data-cleared={next.kind !== "out" ? "1" : undefined}
            >
              {next.kind === "heat"
                ? heat
                  ? STRINGS.crossNext(next.round)
                  : STRINGS.crossNextQualified(next.round)
                : next.kind === "done"
                  ? STRINGS.crossDone(next.place)
                  : heat
                    ? STRINGS.crossOutAt(next.place)
                    : `${STRINGS.crossShort(SKI_CROSS.qualify)} · ${STRINGS.crossOutAt(next.place)}`}
            </span>
          )}
          {heat ? (
            /* THE HEAT, in the order they came over the line. */
            <ol class="hud-standings hud-cross-heat">
              {cross.order.map((r, i) => (
                <li
                  key={r.id ?? "you"}
                  class={`hud-standing${r.id === null ? " hud-standing-you" : ""}${i < cross.through ? " hud-cross-through" : ""}`}
                >
                  <span class="hud-standing-place">{i + 1}</span>
                  <span class="hud-standing-name">
                    {r.id === null ? STRINGS.crossYou : STRINGS.crossBib(r.rank)}
                  </span>
                  <span class="hud-standing-time">
                    {r.out
                      ? STRINGS.crossOut
                      : r.time !== null
                        ? formatTime(r.time)
                        : STRINGS.crossOn}
                    {i < cross.through && (
                      <span class="hud-cross-mark">{` · ${STRINGS.crossThrough}`}</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            snap.standings &&
            snap.race && <SlalomBoard rows={snap.standings} second={false} zone={null} />
          )}
          {heat && !cross.podium && (
            <span class="hud-card-note">{STRINGS.crossNote(cross.through)}</span>
          )}
          {/* THE BRACKET between the heats: the round's other heats, and
              who went through each. */}
          {cross.others.map((o) => (
            <span class="hud-card-note hud-cross-bracket" key={o.heat}>
              {`${STRINGS.crossHeatOf(cross.round, o.heat)} · ${o.through
                .map((e) => (e.id === null ? STRINGS.crossYou : STRINGS.crossBib(e.rank)))
                .join(" · ")} ${STRINGS.crossThrough}`}
            </span>
          ))}
          {/* THE PODIUM once the race is over for him: the big final's four. */}
          {cross.podium && (
            <span class="hud-card-note hud-cross-podium">
              {`${STRINGS.crossPodiumHead} · ${cross.podium
                .map(
                  (e, i) =>
                    `${i + 1} ${e.id === null ? STRINGS.crossYou : STRINGS.crossBib(e.rank)}`,
                )
                .join(" · ")}`}
            </span>
          )}
          <div class="hud-result-acts">
            {onward && next?.kind === "heat" && (
              <button
                type="button"
                class="hud-mini hud-result-act hud-result-second"
                data-nav-next
                onClick={onSecond}
              >
                {STRINGS.crossGoOn(next.round)}
              </button>
            )}
            <button
              type="button"
              class="hud-mini hud-result-act"
              data-nav-next={onward ? undefined : true}
              onClick={onAgain}
            >
              {STRINGS.crossAgain(cross.round)}
            </button>
            <button type="button" class="hud-mini hud-result-act" onClick={onNew}>
              {STRINGS.resultNew}
            </button>
            {onReplay && (
              <button type="button" class="hud-mini hud-result-act" onClick={onReplay}>
                {STRINGS.replayWatch}
              </button>
            )}
            <button type="button" class="hud-mini hud-result-act" onClick={onMenu}>
              {STRINGS.pauseMainMenu}
            </button>
          </div>
          {!touch && <span class="hud-card-note hud-result-note">{STRINGS.slalomNote}</span>}
        </div>
      </div>
    </div>
  );
}
