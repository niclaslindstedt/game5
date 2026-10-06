// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER'S INSTRUMENTS (`heli.ts`) — top centre, where the air clock
// stands on the snow (the two are never up together: sat on the skid he is
// not in the air on his skis). Flown by hand with nothing holding it, the
// machine is read off three instruments, as a pilot reads one: THE DROP —
// how high its skids are over the snow, the fall a jump off them is, the
// number the whole game of it is played against — with its climb under it;
// THE HORIZON, the airframe's pitch and bank; and THE COLLECTIVE, the
// lever where it was left. And while it waits on its pad near him, the word
// that it is there and how far — and stood beside its skid, the machine key
// that sits him on it. Every figure is the snapshot's (`heliOf`) but the
// collective's, which fills as the thumb holds it and is drawn every frame.

import { useEffect, useRef } from "preact/hooks";

import type { HudHeli } from "./snapshot.ts";
import type { HudLive } from "./hud-live.ts";
import { STRINGS } from "./strings.ts";

/** The horizon's pitch scale, px of the dial per rad. */
const PITCH_PX = 60;

/** The collective's bar, written once a frame (`hud-live.ts`) so it fills
 * smoothly rather than in the snapshot's steps. */
function CollectiveBar({ live }: { live: HudLive }) {
  const fillRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const draw = (): void => {
      if (fillRef.current) fillRef.current.style.height = `${(live.collective * 100).toFixed(1)}%`;
    };
    live.draws.add(draw);
    draw();
    return () => {
      live.draws.delete(draw);
    };
  }, [live]);
  return (
    <div class="hud-heli-coll" aria-label={STRINGS.heliCollective}>
      <div ref={fillRef} class="hud-heli-coll-fill" />
      <span class="hud-heli-coll-word">{STRINGS.heliCollectiveShort}</span>
    </div>
  );
}

export function HeliReadout({
  heli,
  live,
  touch,
  machineKey,
}: {
  heli: HudHeli;
  live: HudLive;
  touch: boolean;
  /** The machine key as bound, as the player reads it off the keyboard. */
  machineKey: string;
}) {
  if (heli.kind === "waiting") {
    return (
      <div class="hud-heli hud-heli-call" role="status">
        <span class="hud-heli-word">{STRINGS.heliCall}</span>
        <span class="hud-heli-sub">
          {heli.near ? STRINGS.heliTake(touch, machineKey) : STRINGS.heliPad(heli.pad)}
        </span>
      </div>
    );
  }
  const deg = (-heli.bank * 180) / Math.PI;
  const shift = Math.max(-30, Math.min(30, heli.pitch * PITCH_PX));
  return (
    <div class="hud-heli" role="status">
      <div class="hud-heli-row">
        <svg class="hud-heli-horizon" viewBox="-36 -36 72 72" aria-hidden="true">
          <defs>
            <clipPath id="hud-heli-dial">
              <circle r="34" />
            </clipPath>
          </defs>
          <g clip-path="url(#hud-heli-dial)">
            <g transform={`rotate(${deg.toFixed(1)}) translate(0 ${shift.toFixed(1)})`}>
              <rect x="-80" y="-80" width="160" height="80" class="hud-heli-sky" />
              <rect x="-80" y="0" width="160" height="80" class="hud-heli-ground" />
              <line x1="-80" y1="0" x2="80" y2="0" class="hud-heli-line" />
            </g>
          </g>
          <path d="M -18 0 L -6 0 L 0 5 L 6 0 L 18 0" class="hud-heli-wings" />
          <circle r="34" class="hud-heli-ring" />
        </svg>
        <div class="hud-heli-read">
          <span class="hud-chip-sub">{STRINGS.heliHeight}</span>
          <span class="hud-heli-num">{STRINGS.heliMetres(heli.height)}</span>
          <span class="hud-heli-sub">{STRINGS.heliClimb(heli.climb)}</span>
        </div>
        <CollectiveBar live={live} />
      </div>
      <span class="hud-heli-hint">
        {heli.landed ? STRINGS.heliLanded(touch, machineKey) : STRINGS.heliJump(touch, machineKey)}
      </span>
    </div>
  );
}
