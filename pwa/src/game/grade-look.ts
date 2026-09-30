// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A PISTE GRADE LOOKS LIKE (R23) — the colour on its signs and the
// shape it is signed with, stated once for the mark on every card
// (`grade-mark.tsx`) and the stakes down the piste's edges (`gates.ts`).
//
// THE SCHEME is the European colours with the northern signs' SHAPES: a
// GREEN CIRCLE, a BLUE SQUARE, a RED RECTANGLE (lying down) and a BLACK
// DIAMOND. The colour is what every skier reads first; the shape is there
// so a skier who cannot tell the red from the green still reads the grade,
// and a black diamond is the one mark every skier already knows. The shapes
// are generic signs, the same ones a ski area paints on its piste map.
//
// THE PISTE IS MARKED IN ITS COLOUR: the stakes down both edges are the
// grade's own, the right-hand ones banded orange at the top as a stake is
// in the mountains (so a skier in a fog knows which side he is on) — and
// the race's gates keep their red and blue panels, which are a course's,
// not a piste's.
//
// DOM-free and three-free, so the suite reads it.

import type { PisteGrade } from "@engine";

export type GradeShape = "circle" | "square" | "rectangle" | "diamond";

export type GradeLook = {
  /** The shape on the sign. */
  shape: GradeShape;
  /** The sign's paint, CSS. */
  paint: string;
  /** The rim round it, CSS — what keeps a black diamond readable on the
   * card's dark glass and a green circle on the snow. */
  rim: string;
  /** The stakes' paint down the piste's edges, sRGB hex. */
  stake: number;
};

export const GRADE_LOOK: Readonly<Record<PisteGrade, GradeLook>> = {
  green: { shape: "circle", paint: "#1f9a4e", rim: "#f4f8fb", stake: 0x1f9a4e },
  blue: { shape: "square", paint: "#1f63d0", rim: "#f4f8fb", stake: 0x1f63d0 },
  red: { shape: "rectangle", paint: "#d42a2f", rim: "#f4f8fb", stake: 0xd42a2f },
  black: { shape: "diamond", paint: "#121417", rim: "#f4f8fb", stake: 0x16181b },
};

/** The sign's outline in a 24 × 24 box, as an SVG path — the four shapes
 * sized so each reads as big as the others: the diamond's corners reach
 * the box, the circle and the square sit a little inside it, and the
 * rectangle lies down across it. */
export function gradePath(shape: GradeShape): string {
  switch (shape) {
    case "circle":
      return "M12 3.2a8.8 8.8 0 1 0 0.001 0z";
    case "square":
      return "M4 4h16v16H4z";
    case "rectangle":
      return "M2.5 6.5h19v11h-19z";
    case "diamond":
      return "M12 1.5L22.5 12L12 22.5L1.5 12z";
  }
}
