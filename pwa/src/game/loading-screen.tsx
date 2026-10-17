// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CARD OVER A RACE BEING STOOD UP.
//
// What is behind it is `run-loader.ts`: the map generated from its seed, the
// field stood on the start line, the terrain, the forest and the gates built
// off the map, and every shader in the scene compiled before the first frame
// the player is asked to ride. A second or two of work, and the alternative
// to a card over it is a frozen page and then a race that stutters while the
// rest arrives.
//
// The card is the app's own MARK — the two trails, laid over and over
// (`mark-trails.tsx`) — with the word under it, then the phase being paid
// for and where it sits in the count, then ONE bar for the whole load, and
// under it what the work is doing right now: the stage the generator is on,
// the trees planted of the forest's.
//
// THE BAR IS THE WHOLE LOAD, each step weighted by what it cost the last
// time this machine stood a run up (or what it typically costs, before
// that — `run-loader.ts`'s `loadShare`). The steps that can count their own
// work fill their share by that count: the generator by the stage it has
// reached, the forest by its trees. The ones that cannot run their share
// against the time they have been at it, and stop short of its end until
// they really finish. A layout the generator throws away takes its share of
// the bar back with it, and the line under the bar says which layout it is
// on now.
//
// IT IS A TRANSFORM, which the compositor eases between the values it is
// handed — so it moves on through a frame the main thread holds.

import { MarkTrails } from "./mark-trails.tsx";
import type { LoadPhase } from "./run-loader.ts";
import { STRINGS } from "./strings.ts";

export function LoadingScreen({
  leaving,
  phase,
  failed,
  onBack,
}: {
  leaving: boolean;
  phase: LoadPhase | null;
  /** Set once a step has thrown — see `run-loader.ts`'s `LoadJob.failed`. */
  failed: string | null;
  /** The way out of a load that will not finish. */
  onBack: () => void;
}) {
  // A FAILED LOAD KEEPS THE CARD UP rather than dropping the player back on
  // the menu with nothing said. The map they asked for is the thing that
  // did not happen, and this is the surface that was promising it to them;
  // sliding silently back to the front door would read as a press that did
  // not land, and they would make it again.
  if (failed !== null) {
    return (
      <div class="loading loading-failed" aria-live="assertive">
        <div class="loading-card">
          {/* STILL, not looping: the loop's fill is what says "the game is
              working", and a mark still turning over a load that has stopped
              would be the card contradicting its own word. */}
          <MarkTrails lay="once" className="loading-mark" title={STRINGS.loadFailed} />
          <p class="loading-word">{STRINGS.loadFailed}</p>
          <p class="loading-step">{STRINGS.loadFailedHint}</p>
          {/* `data-nav-back` is every surface's way out (menu-nav.ts), so
              Escape leaves this card without it learning about a key. */}
          <button type="button" class="menu-item loading-back" data-nav-back onClick={onBack}>
            <span class="menu-item-name">{STRINGS.loadFailedBack}</span>
          </button>
        </div>
      </div>
    );
  }
  return (
    <div class={`loading${leaving ? " leaving" : ""}`} aria-live="polite" aria-busy={!leaving}>
      <div class="loading-card">
        <MarkTrails lay="loop" className="loading-mark" title={STRINGS.loading} />
        <p class="loading-word">{STRINGS.loading}</p>
        {/* Both held open whether or not there is a phase to name: a line and
            a bar arriving on the second frame would shift the mark above
            them. */}
        <p class="loading-step">
          {phase ? STRINGS.loadStep(phase.label, phase.at, phase.of) : " "}
        </p>
        <LoadBar phase={phase} />
        <p class="loading-count">{phase?.detail ?? " "}</p>
      </div>
    </div>
  );
}

function LoadBar({ phase }: { phase: LoadPhase | null }) {
  return (
    <div class="loading-bar" aria-hidden="true">
      <div class="loading-bar-fill" style={{ transform: `scaleX(${phase?.overall ?? 0})` }} />
    </div>
  );
}
