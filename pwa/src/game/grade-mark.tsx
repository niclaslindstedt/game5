// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GRADE'S SIGN on a card (R23): the green circle, the blue square, the
// red rectangle or the black diamond (`grade-look.ts`), in a 24 × 24 box
// sized by the surrounding type, its name its accessible label — so a box, a
// tab, a loading card or a row of the start card says what colour of run it
// is before a word has been read.

import type { RunGrade } from "@engine";

import { GRADE_LOOK, gradePath } from "./grade-look.ts";
import { STRINGS } from "./strings.ts";

export function GradeMark({ grade, className }: { grade: RunGrade; className?: string }) {
  const look = GRADE_LOOK[grade];
  const name = STRINGS.gradeRun(STRINGS.gradeNames[grade]);
  return (
    <svg
      class={`grade-mark grade-mark-${grade}${className ? ` ${className}` : ""}`}
      viewBox="0 0 24 24"
      role="img"
      aria-label={name}
      focusable="false"
    >
      <title>{name}</title>
      <path
        d={gradePath(look.shape)}
        fill={look.paint}
        stroke={look.rim}
        stroke-width="1.6"
        stroke-linejoin="round"
      />
    </svg>
  );
}
