// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HUD'S GLASS CRACKED, AND HIS DEATH (`hud-wreck.ts` decides, this
// draws): the stars of cracks across the readouts as his injuries mount,
// and the word DIED over a picture going dark. Only with the INJURIES
// switch on; `hud.tsx` leaves both out otherwise.

import type { JSX } from "preact";
import type { DeathCause } from "@engine";

import { crackStar, type Wreck } from "./hud-wreck.ts";
import { STRINGS } from "./strings.ts";

/** The glass's own units: 1 high, this wide — the cracks are laid in it
 * and stretched to the screen, as a visor's would be. */
const ASPECT = 16 / 9;

/** THE CRACKED GLASS: `wreck.cracks` stars, each a ring round its strike
 * and its rays run out in jags, a dark line under a pale one so it reads on
 * the snow and the sky alike. */
export function WreckGlass({ wreck }: { wreck: Wreck }): JSX.Element | null {
  if (wreck.cracks === 0) return null;
  const stars = Array.from({ length: wreck.cracks }, (_, n) => crackStar(n, ASPECT));
  const path = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(3)} ${p.y.toFixed(3)}`).join("");
  return (
    <svg
      class="hud-glass"
      viewBox={`0 0 ${ASPECT} 1`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {stars.map((s, n) => (
        <g key={n}>
          {s.rays.map((r, i) => (
            <path key={`d${i}`} class="hud-crack-shade" d={path(r)} />
          ))}
          {s.rays.map((r, i) => (
            <path key={`l${i}`} class="hud-crack" d={path(r)} />
          ))}
          <circle class="hud-crack-ring" cx={s.x} cy={s.y} r={s.ring} />
        </g>
      ))}
    </svg>
  );
}

/** THE DEATH CARD: the picture going dark, the word over it, what killed
 * him under it, and that a new rider starts at the top. */
export function DeathCard({ wreck, cause }: { wreck: Wreck; cause: DeathCause }): JSX.Element {
  return (
    <div class="hud-death" role="alert" style={{ "--death-dark": String(wreck.dark) }}>
      <div class="hud-death-words" style={{ opacity: String(wreck.word) }}>
        <span class="hud-death-word">{STRINGS.died}</span>
        <span class="hud-death-cause">{STRINGS.diedOf[cause]}</span>
        <span class="hud-death-again">{STRINGS.diedAgain}</span>
      </div>
    </div>
  );
}
