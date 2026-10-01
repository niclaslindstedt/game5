// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD LAB'S SIGN VIEWS (`make world ARGS=--views=sign,sign-tree`):
// the piste-head sign as a skier at the top of a run reads it.
//
//   * sign — the sign at the head of the course raced, from a chase lens's
//     step back up the run at a skier's eye, looking past it down the run;
//   * sign-tree — the post carrying the most boards (the runs leaving one
//     lift's top together; of equal ones, a lane's junction sign), the same.
//
// The lens stands clear of the lifts as the signs do (`clearOfLifts`), so a
// station house is never the picture.

import type { Level } from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { clearOfLifts, signPlan, type SignPost } from "../game/run-sign-plan.ts";

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
