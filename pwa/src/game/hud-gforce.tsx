// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE G METER — how hard that was. The moment a landing, the body on the
// snow, a trunk or another skier lands a blow worth billing (`body.ts`) AND
// someone goes down on it — he, or the skier he shouldered — its peak in g goes up over the skier in big figures, SHAKING by how hard
// it was — a jolt barely trembles, a blow past what a body takes whole
// rattles the number — and fades out over the hold. Under it, what took it
// from what. Keyed on the blow's number, so a harder one arriving in the
// hold lands with its own shake; a softer one waits its turn in the engine.
// Every figure is the engine's; nothing here decides what a blow was.

import type { JSX } from "preact";

import { blowTone, type BlowTile } from "./body-tile.ts";
import { STRINGS } from "./strings.ts";

/** How far the number is thrown about, px: a little at a jolt, up to
 * `SHAKE_MAX` at a blow past the chest's sixty g. */
const SHAKE_MAX = 14;

export function shakeOf(g: number): number {
  return Math.min(SHAKE_MAX, 1 + g / 5);
}

export function GForce({ blow }: { blow: BlowTile }): JSX.Element {
  return (
    <div
      class={`hud-gforce hud-gforce-${blowTone(blow.g)}`}
      key={blow.id}
      role="status"
      style={{ "--shake": `${shakeOf(blow.g).toFixed(1)}px` }}
    >
      <span class="hud-gforce-read">
        <span class="hud-gforce-num">{STRINGS.gForce(blow.g)}</span>
        <span class="hud-gforce-unit">{STRINGS.gUnit}</span>
      </span>
      <span class="hud-gforce-what">{STRINGS.gWhat(blow.source, blow.part)}</span>
    </div>
  );
}
