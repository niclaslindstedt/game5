// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A MEDAL, DRAWN — a disc on a short ribbon in the gold, the silver or the
// bronze (`medal-look.ts`), or an empty ring for none, in a 24 × 24 box
// sized by the surrounding type; its name its accessible label. The HUD's
// chip and plate, the pause card's list and the statistics' tally all draw
// a medal with this one mark.

import type { Medal } from "@engine";

import { MEDAL_LOOK } from "./medal-look.ts";
import { STRINGS } from "./strings.ts";

export function MedalMark({ medal, className }: { medal: Medal | null; className?: string }) {
  const name = medal ? STRINGS.medalNames[medal] : STRINGS.challengePlateNone;
  const cls = `medal-mark medal-mark-${medal ?? "none"}${className ? ` ${className}` : ""}`;
  if (!medal) {
    return (
      <svg class={cls} viewBox="0 0 24 24" role="img" aria-label={name} focusable="false">
        <title>{name}</title>
        <circle
          cx="12"
          cy="14"
          r="7.5"
          fill="none"
          stroke="currentColor"
          stroke-opacity="0.55"
          stroke-width="2"
          stroke-dasharray="3 2.4"
        />
      </svg>
    );
  }
  const look = MEDAL_LOOK[medal];
  return (
    <svg class={cls} viewBox="0 0 24 24" role="img" aria-label={name} focusable="false">
      <title>{name}</title>
      {/* The ribbon: two bands meeting under the disc. */}
      <path d="M6.5 1 L11 8.5 L13 8.5 L9.5 1 Z" fill="#c9302c" />
      <path d="M17.5 1 L13 8.5 L11 8.5 L14.5 1 Z" fill="#2a5db0" />
      <circle cx="12" cy="14.5" r="8.4" fill={look.deep} stroke={look.rim} stroke-width="1.3" />
      <circle cx="12" cy="14.5" r="5.6" fill={look.light} fill-opacity="0.85" />
      <circle cx="10.2" cy="12.6" r="1.6" fill="#ffffff" fill-opacity="0.7" />
    </svg>
  );
}
