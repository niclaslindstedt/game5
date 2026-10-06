// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A RACE SAYS: the line in the news column an engine event earns. Pure
// — an event and the state it came off in, a line out — so the root suite
// reads every rung without a browser, and `App.tsx` only calls it. Every
// word is the strings table's (§39.1).
//
// NEWS IS WHAT CHANGED THE RUN: a gate taken and its clock, one missed, a
// tree met, a landing the legs could not take, a wipeout and what caused
// it, an injury and what it was, the skier bogged, an edge dulled or a
// knee hurt, a reset, the skier
// blown into a wind tunnel, the finish. On a SLALOM a gate comes every
// second, so only its two intermediates are billed, with the gap to the
// leader there; a gate pole driven over hard is news (a brush is not — a
// racer clears a pole at nearly every gate), and so is going OUT — the
// disqualification or the fall, and why.
// What the HUD already shows in its own corner every frame — the speed, the
// place — is not news, and neither is a landing the skis simply rode away
// from.

import { TUNING, type GameEvent, type GameState } from "@engine";

import { gapAt, timingGates } from "./slalom-board.ts";
import { gatesTaken } from "./snapshot.ts";
import { STRINGS } from "./strings.ts";

/** A line in the news column: what it says, its colour, and an id the list
 * is keyed on so a line leaving does not restart the animation of the one
 * under it. */
/** How near a save must have come to a fall to be said (`Save.size`). */
const SAVE_SAID = 0.6;

/** How hard a gate pole must be driven into to be said, m/s of closing
 * speed — a racer clearing a pole with his shin and his guard closes on it
 * at a couple; one skied straight over closes at most of his speed. */
export const POLE_SAID = 6;

export type HudFlash = { id: number; text: string; tone: "good" | "bad" | "info" };

export type NewsLine = Omit<HudFlash, "id">;

/** The line `e` earns, or null for an event that is not news. */
export function newsFor(e: GameEvent, state: GameState): NewsLine | null {
  switch (e.kind) {
    case "checkpoint":
      // The START GATE opens the run and is worth a word; every later gate
      // is billed with its clock — but not the finish line, whose crossing
      // the `finish` event says better.
      if (e.index === 0) return { text: STRINGS.newsStart, tone: "info" };
      if (e.index >= state.level.checkpoints.length - 1) return null;
      if (state.field) {
        const point = timingGates(state.level).indexOf(e.index);
        if (point < 0) return null;
        const gap = gapAt(state, e.index);
        return {
          text: STRINGS.newsTiming(point + 1, e.split, gap),
          tone: gap !== null && gap > 0 ? "bad" : "good",
        };
      }
      return { text: STRINGS.newsCheckpoint(e.index, e.split), tone: "good" };
    case "lap":
      // A piste is one run: the finish line ends it, and the `finish`
      // event beside this one carries the line.
      return null;
    case "missed":
      // A slalom gate skied past is charged on the clock: the line says
      // what it cost.
      return { text: STRINGS.newsMissed(e.index, e.penalty), tone: "bad" };
    case "hit":
      return { text: e.post ? STRINGS.newsPost : STRINGS.newsTree, tone: "bad" };
    case "stake":
      // A stake bent over is nothing to say; one snapped is.
      return e.broke ? { text: STRINGS.newsStake, tone: "info" } : null;
    case "land":
      // A landing the legs paid for, or one that loaded them past what a
      // clean landing asks (`TUNING.landing.clean`): its load, in g.
      if (e.harsh) return { text: STRINGS.newsHarsh(e.g), tone: "bad" };
      return e.g > TUNING.landing.clean ? { text: STRINGS.newsLoad(e.g), tone: "info" } : null;
    case "reset":
      return { text: STRINGS.newsReset, tone: "info" };
    case "save":
      // A near fall ridden out is worth a word only when it was near.
      return e.size >= SAVE_SAID ? { text: STRINGS.newsSave(e.save), tone: "good" } : null;
    case "wipeout":
      // Over the leading end riding switch is over the TAILS (`switch.ts`).
      if (e.cause === "nose" && state.skier.switched)
        return { text: STRINGS.newsTailDug, tone: "bad" };
      // In a ski-cross heat a rival's shoulder put him down in the pack.
      if (state.cross && e.cause === "skier") return { text: STRINGS.newsKnocked, tone: "bad" };
      return { text: STRINGS.newsWipeout(e.cause), tone: "bad" };
    case "stuck":
      return { text: STRINGS.newsStuck, tone: "bad" };
    case "grimbear":
      // Out of the trees, and pulled up short; the catch is the wipeout's.
      return e.phase === "burst"
        ? { text: STRINGS.newsGrimbear, tone: "bad" }
        : e.phase === "halt"
          ? { text: STRINGS.newsGrimbearHalt, tone: "info" }
          : null;
    case "bump": {
      // One of the crowd shouldered on a free ride: whether he stayed up.
      if (e.amateur === undefined) return null;
      const who = state.crowd?.amateurs[e.amateur];
      return who?.mode === "down"
        ? { text: STRINGS.newsCrowdDown, tone: "bad" }
        : { text: STRINGS.newsCrowdBump, tone: "info" };
    }
    case "damage":
      return { text: STRINGS.newsDamage(e.part), tone: "bad" };
    case "injury":
      // What the body took is the body panel's to show (`hud-body.tsx`),
      // never a line of news.
      return null;
    case "combo":
      return e.sketchy
        ? { text: `${STRINGS.comboSketchy} ${STRINGS.comboBanked(e.points)}`, tone: "info" }
        : { text: STRINGS.comboBanked(e.points), tone: "good" };
    case "bail":
      return { text: STRINGS.comboBailed(e.lost), tone: "bad" };
    case "pole":
      return e.speed >= POLE_SAID ? { text: STRINGS.newsPole(e.gate), tone: "info" } : null;
    case "out":
      // A red card in a ski-cross heat: the jury's word for it.
      return {
        text: e.out.why === "contact" ? STRINGS.newsCard : STRINGS.newsOut(e.out),
        tone: "bad",
      };
    // A DOWNHILL'S SPEED TRAP, and the A-nets (R32): the out that follows a
    // drive into them says the rest.
    case "trap":
      // ...and a speed track's timing zone, whose speed is the result (R34).
      return state.level.speedSki
        ? { text: STRINGS.newsSpeed(e.speed * 3.6), tone: "good" }
        : { text: STRINGS.newsTrap(e.speed * 3.6), tone: "info" };
    case "net":
      return state.progress.out ? null : { text: STRINGS.newsNet, tone: "bad" };
    case "finish": {
      // A tricks run is its score; a run alone has no place, only a time.
      if (state.rules.tricks)
        return { text: STRINGS.newsTricksFinish(state.tricks.score), tone: "good" };
      // A speed race's result is the speed its zone timed, said above.
      if (state.level.speedSki) return null;
      const field = state.field?.runs.length ?? state.rivals.length;
      if (field === 0) return { text: STRINGS.newsFinishAlone(e.time), tone: "good" };
      return { text: STRINGS.newsFinish(e.place, field + 1, e.time), tone: "good" };
    }
    case "tunnel":
      // Blown into a wind tunnel; coming out of the far end is not news,
      // the run carrying on.
      return e.phase === "in" ? { text: STRINGS.newsTunnel, tone: "info" } : null;
    case "lift":
      // Taken onto a lift: which kind, and that the top is where it goes —
      // and, carried, how to skip the ride or leave it.
      if (e.phase === "board") return { text: STRINGS.newsLift(e.lift), tone: "info" };
      return e.phase === "take" ? { text: STRINGS.newsLiftTaken, tone: "info" } : null;
    case "heli":
      // The helicopter: sat on, pushed off (from how high over the snow),
      // flown into the mountain, and the ride begun again on the pad.
      if (e.phase === "board") return { text: STRINGS.newsHeliBoard, tone: "info" };
      if (e.phase === "drop")
        return {
          text: STRINGS.newsHeliDrop(e.y - state.level.groundAt(e.x, e.z)),
          tone: "good",
        };
      if (e.phase === "crash") return { text: STRINGS.newsHeliCrash, tone: "bad" };
      return e.phase === "restart" ? { text: STRINGS.newsHeliRestart, tone: "info" } : null;
    case "sled":
      // The snowmobile: taken, hopped off, the rider thrown, back on it.
      // The crash is the wipeout's line, said by the wipeout itself.
      if (e.phase === "board") return { text: STRINGS.newsSledBoard, tone: "info" };
      if (e.phase === "hop") return { text: STRINGS.newsSledHop, tone: "good" };
      if (e.phase === "right") return { text: STRINGS.newsSledRight, tone: "info" };
      return e.phase === "restart" ? { text: STRINGS.newsSledRestart, tone: "info" } : null;
    case "para":
      // The paramotor: off the summit, in the air, skiing under it, the rig
      // folded by rough air, dropped or cut away, the ride begun again.
      if (e.phase === "launch") return { text: STRINGS.newsParaLaunch, tone: "info" };
      if (e.phase === "takeoff") return { text: STRINGS.newsParaTakeoff, tone: "good" };
      if (e.phase === "touch") return { text: STRINGS.newsParaTouch, tone: "info" };
      if (e.phase === "drop") return { text: STRINGS.newsParaDrop, tone: "good" };
      if (e.phase === "collapse") return { text: STRINGS.newsParaCollapse, tone: "bad" };
      if (e.phase === "fold") return { text: STRINGS.newsParaFold, tone: "bad" };
      return { text: STRINGS.newsParaRestart, tone: "info" };
    default:
      return null;
  }
}

/** WHAT A PICTURE IS CALLED: the mountain it was taken on, where on the
 * piste — the gate count, or the free ride that counts none — how fast, and
 * on which pair.
 * It is the gallery's caption and most of the file's name
 * (`screenshots.ts`), read at the SHUTTER'S press, so it is the moment the
 * button went down rather than the frame that served it. */
export function shotLabel(state: GameState): string {
  return STRINGS.shotLabel({
    seed: state.seed,
    gate: state.rules.course ? gatesTaken(state.progress, state.level.checkpoints.length) : null,
    gates: state.level.checkpoints.length,
    kmh: state.skier.speed * 3.6,
    skis: state.skier.spec.name,
  });
}
