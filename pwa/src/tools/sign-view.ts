// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD LAB'S SIGN VIEWS (`make world ARGS=--views=sign,sign-tree`):
// the piste-head sign as a skier at the top of a run reads it.
//
//   * sign — the sign at the head of the course raced, from a chase lens's
//     step back up the run at a skier's eye, looking past it down the run;
//   * sign-tree — the post carrying the most boards (the runs leaving one
//     lift's top together; of equal ones, a lane's junction sign), the same;
//   * sign-summit, sign-summit-2 — a top's piste map board and the arrow
//     signs beside it, from where the rider is let go.
//
// The lens stands clear of the lifts as the signs do (`clearOfLifts`), so a
// station house is never the picture.

import { clearOfLifts, liftPlans, type Level, type LiftPlan } from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { signPlan, summitSigns, type SignPost } from "../game/run-sign-plan.ts";
import { mapBoardOf } from "../game/station-plan.ts";

/** Up the run from `post`, looking past it down the way it faces. */
function lensOn(level: Level, post: SignPost): LensPose {
  const fx = Math.sin(post.heading);
  const fz = Math.cos(post.heading);
  let eye = { x: post.x - fx * 9, z: post.z - fz * 9 };
  search: for (const back of [9, 7, 11, 13, 6]) {
    for (const side of [1.5, -1.5, 4, -4]) {
      const x = post.x - fx * back - fz * side;
      const z = post.z - fz * back + fx * side;
      if (clearOfLifts(level, x, z)) {
        eye = { x, z };
        break search;
      }
    }
  }
  const tx = post.x + fx * 6;
  const tz = post.z + fz * 6;
  const top = post.boards[0];
  return {
    eye: { x: eye.x, y: level.groundAt(eye.x, eye.z) + 1.8, z: eye.z },
    target: { x: tx, y: level.groundAt(tx, tz) + (top.y + top.height) * 0.8, z: tz },
    fov: 58,
    roll: 0,
  };
}

const said = (post: SignPost): string =>
  post.boards.map((b) => `${b.number} ${b.name} ${b.arrow}`).join(", ");

export function signView(level: Level, tree: boolean): { pose: LensPose; note: string } | null {
  const posts = signPlan(level);
  if (posts.length === 0) return null;
  if (tree) {
    // The most boards; of equal stacks, one with a lane on it.
    const score = (p: SignPost) => p.boards.length * 2 + (p.boards.some((b) => b.lane) ? 1 : 0);
    const post = posts.reduce((a, b) => (score(b) > score(a) ? b : a));
    return {
      pose: lensOn(level, post),
      note: `the sign tree of ${post.boards.length}: ${said(post)}`,
    };
  }
  const resort = level.resort;
  const course = resort?.courses.find((c) => c.id === resort.course);
  const id = course?.runs[0] ?? resort?.runs[0]?.id;
  const post = posts.find((p) => p.boards.some((b) => b.run === id));
  if (!post) return null;
  return { pose: lensOn(level, post), note: `the head of run ${id}: ${said(post)}` };
}

/** THE SIGNS BESIDE A TOP'S PISTE MAP BOARD (`sign-summit`): from where a
 * rider is let go off a chair's or a gondola's top, at his eye, looking at
 * the board with its signs either side — the top with runs leaving both
 * ways if there is one, else the one with the most runs off it. `pick`
 * walks the tops in that order (0 the first). */
export function summitSignView(level: Level, pick = 0): { pose: LensPose; note: string } | null {
  const posts = summitSigns(level);
  const tops = liftPlans(level)
    .map((plan) => ({ plan, board: mapBoardOf(plan) }))
    .filter(
      (t): t is { plan: LiftPlan; board: NonNullable<ReturnType<typeof mapBoardOf>> } =>
        t.board !== null && (t.plan.lift.ramps?.length ?? 0) > 0,
    )
    .map((t) => {
      const near = posts.filter((p) => Math.hypot(p.x - t.board.x, p.z - t.board.z) < 5);
      return {
        ...t,
        near,
        score: near.length * 10 + near.reduce((a, p) => a + p.boards.length, 0),
      };
    })
    .sort((a, b) => b.score - a.score);
  const top = tops[Math.min(pick, tops.length - 1)];
  if (!top) return null;
  const { board, near } = top;
  const dx = board.x - board.off.x;
  const dz = board.z - board.off.z;
  const d = Math.hypot(dx, dz) || 1;
  // A step back off the let-go if it is close, so both posts are in frame.
  const back = Math.max(0, 9 - d);
  const ex = board.off.x - (dx / d) * back;
  const ez = board.off.z - (dz / d) * back;
  return {
    pose: {
      eye: { x: ex, y: level.groundAt(ex, ez) + 1.7, z: ez },
      target: { x: board.x, y: level.groundAt(board.x, board.z) + 1.6, z: board.z },
      fov: 50,
      roll: 0,
    },
    note: `${top.plan.lift.id}'s top: ${near.map(said).join(" | ")}`,
  };
}

/** The world lab's sign views, by name. */
export const SIGN_VIEWS = [
  "sign",
  "sign-tree",
  "sign-summit",
  "sign-summit-2",
  "sign-summit-3",
] as const;

export function namedSignView(level: Level, name: string): { pose: LensPose; note: string } | null {
  if (name === "sign" || name === "sign-tree") return signView(level, name === "sign-tree");
  return summitSignView(level, Number(name.split("-")[2] ?? 1) - 1);
}
