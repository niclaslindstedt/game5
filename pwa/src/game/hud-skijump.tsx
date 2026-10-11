// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SKI JUMPING ON THE GLASS (R43): what the HUD draws through one jump, read
// off `ski-jump-run.ts`'s `SkiJumpHud`, and the plate over it once scored.
//
//   the bar      the START LIGHT (red while the count runs, green with the
//                window left), the WIND at the edge with its arrow, the
//                GATE, the round and the BIB, and the LEADER's points with
//                the distance that beats them — one row at the top
//   the in-run   the SPEED, big at the centre
//   the edge     its speed and how the push was timed: EARLY, PERFECT, LATE
//   the air      an ATTITUDE cue alone — the skis against the ideal angle
//   the landing  the DISTANCE in big type, and how he came down
//
// THE PLATE says the round and the distance, the distance's points, the
// five judges' marks with the highest and lowest struck through, the
// style, the gate's and the wind's points, the jump's points (and in the
// final the total), the round's board or the final ranking, and the press
// to whatever comes next.
//
// ON TOUCH the lever's glass is the JUMP PAD: JUMP (off the bar, and the
// push at the edge) and TELEMARK held, the lean on the other thumb.

import { useEffect, useRef } from "preact/hooks";
import { SKI_JUMP } from "@engine";

import type { InputManager } from "./input.ts";
import { HoldPress } from "./hud-balloon.tsx";
import { ContestBoard } from "./hud-contest-board.tsx";
import type { ZoneSide } from "./hud-touch.tsx";
import { ATTITUDE_HELD, type SkiJumpHud } from "./ski-jump-run.ts";
import type { HudSnapshot } from "./snapshot.ts";
import { STRINGS } from "./strings.ts";

/** The wind's arrow: up the screen a head wind (into his face), turned by
 * the cross wind. */
function WindArrow({ head, across }: { head: number; across: number }) {
  const deg = (Math.atan2(across, head) * 180) / Math.PI;
  return (
    <svg
      class="hud-jump-arrow"
      viewBox="-50 -50 100 100"
      aria-hidden="true"
      style={{ transform: `rotate(${deg.toFixed(0)}deg)` }}
    >
      <path d="M 0 -42 L 30 4 L 10 4 L 10 40 L -10 40 L -10 4 L -30 4 Z" />
    </svg>
  );
}

/** THE BAR'S ROW at the top: the light, the wind, the gate, the round and
 * the bib, the leader. */
export function SkiJumpBar({ jump }: { jump: SkiJumpHud }) {
  return (
    <>
      {jump.light && (
        <div class={`hud-chip hud-jump-light hud-jump-${jump.light}`} role="status">
          <span>
            <span class="hud-jump-lamp" aria-hidden="true" />
            {jump.light === "red" ? STRINGS.skiJumpRed : STRINGS.skiJumpGreen(jump.left)}
          </span>
          <span class="hud-chip-sub">{STRINGS.skiJumpLightLabel}</span>
        </div>
      )}
      <div class={`hud-chip hud-jump-wind${jump.wind < 0 ? " hud-jump-tail" : ""}`}>
        <span>
          <WindArrow head={jump.wind} across={jump.across} />
          {STRINGS.skiJumpWind(jump.wind)}
        </span>
        <span class="hud-chip-sub">{STRINGS.skiJumpWindLabel}</span>
      </div>
      <div class="hud-chip hud-run">
        <span>{STRINGS.skiJumpGate(jump.gate)}</span>
        <span class="hud-chip-sub">
          {STRINGS.skiJumpRound(jump.round)} · {STRINGS.skiJumpBib(jump.bib, jump.of)}
        </span>
      </div>
      <div class="hud-chip hud-jump-leader">
        <span>
          {jump.leader ? STRINGS.skiJumpToBeat(jump.leader.toBeat) : STRINGS.skiJumpFirstUp}
        </span>
        {jump.leader && (
          <span class="hud-chip-sub">{STRINGS.skiJumpLeader(jump.leader.points)}</span>
        )}
      </div>
    </>
  );
}

/** THE MOMENT'S ONE READING at the centre: the speed down the tracks, the
 * edge's speed and word, the attitude in the air, the distance down. */
export function SkiJumpCues({
  jump,
  touch,
  jumpKey,
}: {
  jump: SkiJumpHud;
  touch: boolean;
  jumpKey: string;
}) {
  if (jump.judged) return null;
  if (jump.stage === "bar" && jump.light === "green") {
    return (
      <div class="hud-jump-cue hud-jump-call" role="status">
        <span class="hud-chip-sub">{STRINGS.skiJumpGo(touch, jumpKey)}</span>
      </div>
    );
  }
  if (jump.stage === "tracks") {
    return (
      <div class="hud-jump-cue">
        <span class="hud-jump-big">{STRINGS.skiJumpSpeed(jump.speed)}</span>
        <span class="hud-chip-sub">{STRINGS.skiJumpSpeedLabel}</span>
      </div>
    );
  }
  if (jump.takeOff && jump.edgeSpeed !== null) {
    return (
      <div class="hud-jump-cue" key="edge">
        <span class={`hud-jump-word hud-jump-${jump.takeOff}`}>
          {STRINGS.skiJumpTakeOff(jump.takeOff)}
        </span>
        <span class="hud-jump-mid">{STRINGS.skiJumpSpeed(jump.edgeSpeed)}</span>
        <span class="hud-chip-sub">{STRINGS.skiJumpEdgeLabel}</span>
      </div>
    );
  }
  if (jump.attitude) {
    const off = jump.attitude.aoa - jump.attitude.ideal;
    const at = Math.max(-1, Math.min(1, off / 20));
    const word =
      Math.abs(off) <= ATTITUDE_HELD
        ? STRINGS.skiJumpHold
        : off > 0
          ? STRINGS.skiJumpLeanIn
          : STRINGS.skiJumpSitUp;
    return (
      <div class="hud-jump-cue hud-jump-attitude">
        <span class="hud-jump-gauge" aria-hidden="true">
          <span class="hud-jump-ideal" />
          <span
            class={`hud-jump-mark${Math.abs(off) <= ATTITUDE_HELD ? " hud-jump-held" : ""}`}
            style={{ left: `${(50 + at * 50).toFixed(1)}%` }}
          />
        </span>
        <span class="hud-chip-sub">
          {STRINGS.skiJumpAttitude} · {word}
        </span>
      </div>
    );
  }
  if (jump.distance !== null) {
    return (
      <div class="hud-jump-cue hud-jump-landed" key="down">
        <span class="hud-jump-huge">{STRINGS.skiJumpDistance(jump.distance)}</span>
        {jump.landing && (
          <span class="hud-chip-sub">
            {jump.landing === "fall"
              ? STRINGS.skiJumpFall
              : jump.landing === "twoFooted"
                ? STRINGS.skiJumpTwoFooted
                : STRINGS.skiJumpTelemark}
          </span>
        )}
      </div>
    );
  }
  return null;
}

/** THE JUMP PAD, the lever's glass on a ski jump: JUMP held is the jump
 * key (off the bar, then the push at the edge), TELEMARK held the trick
 * key. Leaving the hill lets both go. */
export function JumpPad({ touch, side }: { touch: InputManager["touch"]; side: ZoneSide }) {
  const held = useRef({ jump: false, telemark: false });
  const write = (): void => {
    touch.lever = held.current.jump;
    touch.jump = held.current.jump;
    touch.trick = held.current.telemark;
  };
  useEffect(
    () => () => {
      touch.lever = false;
      touch.jump = false;
      touch.trick = false;
    },
    [touch],
  );
  return (
    <div class={`hud-zone hud-zone-${side} hud-balloon-pad hud-jump-pad`} data-touch="skijump">
      <HoldPress
        label={STRINGS.skiJumpPadJump}
        kind="burn"
        on={(down) => {
          held.current.jump = down;
          write();
        }}
      />
      <HoldPress
        label={STRINGS.skiJumpPadTelemark}
        kind="vent"
        on={(down) => {
          held.current.telemark = down;
          write();
        }}
      />
    </div>
  );
}

/** Which of the five marks are struck: the highest and the lowest, one
 * each, as the scorer drops them. */
function struck(marks: readonly number[]): Set<number> {
  const order = marks.map((m, i) => [m, i] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return new Set(order.length > 2 ? [order[0][1], order[order.length - 1][1]] : []);
}

export function SkiJumpPlate({
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
  const jump = snap.skiJump;
  if (!jump?.judged) return null;
  const { judged, next } = jump;
  const onward = next?.kind === "round" && onSecond !== null;
  const won = next?.kind === "done" && next.place === 1;
  const off = struck(judged.marks);
  return (
    <div class="hud hud-result-layer">
      <div class="hud-center">
        <div class={`hud-card hud-result hud-result-boarded${won ? " hud-result-record" : ""}`}>
          <span class="hud-card-note hud-result-label">
            {STRINGS.skiJumpTitle(jump.round, jump.hs)}
          </span>
          <span class="hud-card-title hud-result-verdict">
            {judged.dns ? STRINGS.skiJumpNoStart : STRINGS.skiJumpDistance(judged.distance)}
          </span>
          {!judged.dns && (
            <>
              <span class="hud-card-note">
                {STRINGS.skiJumpDistancePoints(judged.distancePoints)}
              </span>
              <span class="hud-card-note hud-jump-marks">
                {judged.marks.map((m, i) => (
                  <span key={i} class={off.has(i) ? "hud-jump-struck" : undefined}>
                    {STRINGS.skiJumpMark(m)}
                  </span>
                ))}
                <span>{STRINGS.skiJumpStyle(judged.style)}</span>
              </span>
              <span class="hud-card-note">
                {STRINGS.skiJumpGatePoints(judged.gate, judged.gatePoints)} ·{" "}
                {STRINGS.skiJumpWindPoints(judged.wind, judged.windPoints)}
              </span>
            </>
          )}
          <span class="hud-card-note hud-jump-points">
            {STRINGS.skiJumpPoints(judged.points)}
            {jump.total !== null ? ` · ${STRINGS.skiJumpTotal(jump.total)}` : ""}
          </span>
          {next && (
            <span
              class="hud-card-note hud-result-award"
              data-cleared={next.kind !== "out" ? "1" : undefined}
            >
              {next.kind === "round"
                ? next.round === "final"
                  ? STRINGS.skiJumpThrough(next.place)
                  : STRINGS.skiJumpOnward(next.place)
                : next.kind === "out"
                  ? STRINGS.skiJumpShort(next.place, SKI_JUMP.final)
                  : STRINGS.skiJumpDone(next.place)}
            </span>
          )}
          {jump.round === "final" && <span class="hud-card-note">{STRINGS.skiJumpFinalBoard}</span>}
          <ContestBoard
            rows={jump.board}
            tight
            name={(r) => (r.you ? STRINGS.skiJumpYou : STRINGS.skiJumpBibOf(r.id))}
            figure={(r) => STRINGS.skiJumpRow(r.distances, r.points, r.fell, r.dns)}
          />
          <div class="hud-result-acts">
            {onward && next?.kind === "round" && (
              <button
                type="button"
                class="hud-mini hud-result-act hud-result-second"
                data-nav-next
                onClick={onSecond ?? undefined}
              >
                {STRINGS.skiJumpNext(next.round)}
              </button>
            )}
            <button
              type="button"
              class="hud-mini hud-result-act"
              data-nav-next={onward ? undefined : true}
              onClick={onAgain}
            >
              {STRINGS.skiJumpAgain}
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
