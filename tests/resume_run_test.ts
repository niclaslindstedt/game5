// RESUME on the front door (`pwa/src/game/resume-run.ts`): the run the
// player left for the menu is kept while the bot rides it under the cards —
// a free ride stood up again as itself when the bot has ridden it out — and
// taken back from wherever the bot has got to; anything else lets it go.

import { describe, expect, it } from "vitest";
import { createGame, showcaseOver, step, TUNING, type SkierInput } from "@engine";
import { freeAgainOptions } from "../pwa/src/game/free-ride.ts";
import { createResumeRun } from "../pwa/src/game/resume-run.ts";
import { syntheticLevel } from "./support/synthetic.ts";

const still: SkierInput = { steer: 0, tuck: 0, brake: 1, lean: 0, reset: false };

/** Steps `state` until the restart rule hands the backdrop on. */
function rideOut(state: ReturnType<typeof createGame>, next: () => unknown): unknown {
  for (let i = 0; i < 20 * TUNING.physicsHz; i++) {
    step(state, still);
    const after = next();
    if (after) return after;
  }
  return null;
}

describe("resume", () => {
  it("takes back the run left for the menu, once", () => {
    const resume = createResumeRun();
    const run = createGame({ level: syntheticLevel(), seed: 1, quiet: true, mode: "free" });
    expect(resume.can(run)).toBe(false);
    resume.leave(run, "free");
    expect(resume.can(run)).toBe(true);
    expect(resume.take(run)).toBe("free");
    expect(resume.can(run)).toBe(false);
    expect(resume.take(run)).toBeNull();
  });

  it("keeps a free ride the bot rides out as that ride again, not a showcase", () => {
    const resume = createResumeRun();
    const opts = { level: syntheticLevel(), seed: 1, quiet: true, mode: "free" as const };
    const run = createGame(opts);
    const again = freeAgainOptions(opts, run.level);
    resume.leave(run, "free");
    const next = rideOut(run, () => resume.next(run, again)) as ReturnType<typeof createGame>;
    expect(next).not.toBeNull();
    expect(next.showcase).toBeUndefined();
    expect(next.rules.course).toBe(false);
    expect(resume.can(next)).toBe(true);
    expect(resume.can(run)).toBe(false);
  });

  it("lets a run go that is not the one left: the backdrop's showcase", () => {
    const resume = createResumeRun();
    const show = createGame({ level: syntheticLevel(), seed: 1, quiet: true, showcase: 0 });
    const next = rideOut(show, () => resume.next(show, null)) as ReturnType<typeof createGame>;
    expect(next.showcase).toBe(1);
    expect(resume.can(next)).toBe(false);
  });

  it("counts a left run's time out from when it was left, not from its start", () => {
    const run = createGame({ level: syntheticLevel(), seed: 1, quiet: true, mode: "free" });
    run.t = 1000;
    expect(showcaseOver(run)).not.toBe("long");
  });
});
