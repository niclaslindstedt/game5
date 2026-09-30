// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DAMAGE INSTRUMENT — the skier from above, his two skis and the legs
// between them, each painted from sound to wrecked. Drawn only on a run
// with damage on (`HudSnapshot.damage`); a ski with a dulled edge is drawn
// toed in by what it has taken, so the pull the skier feels in that ski is
// the pull he sees. Every figure is the engine's (`damage.ts`); nothing
// here decides what a blow cost.

import { STRINGS } from "./strings.ts";

/** A part's paint, from sound through tired to wrecked. */
export function damageTone(level: number): "ok" | "worn" | "bad" {
  if (level < 0.2) return "ok";
  if (level < 0.55) return "worn";
  return "bad";
}

/** How far a ski with its edge wholly gone is drawn toed in, degrees. */
const TOE = 14;

export function DamageGauge({
  damage,
}: {
  damage: { skiLeft: number; skiRight: number; legs: number };
}) {
  const ski = (x: number, level: number, side: number) => (
    <rect
      class={`hud-damage-${damageTone(level)}`}
      x={x - 2.5}
      y={4}
      width={5}
      height={22}
      rx={2.5}
      transform={`rotate(${side * TOE * level} ${x} 15)`}
    >
      <title>{side < 0 ? STRINGS.damageSkiLeft : STRINGS.damageSkiRight}</title>
    </rect>
  );
  return (
    <div class="hud-damage" role="img" aria-label={STRINGS.damageLabel}>
      <svg viewBox="0 0 40 52" width="100%" height="100%">
        {ski(8, damage.skiLeft, 1)}
        {ski(32, damage.skiRight, -1)}
        {/* The legs between them: the part that takes every landing. */}
        <rect
          class={`hud-damage-${damageTone(damage.legs)}`}
          x={14}
          y={14}
          width={12}
          height={34}
          rx={3}
        >
          <title>{STRINGS.damageLegs}</title>
        </rect>
      </svg>
      <span class="hud-chip-sub">{STRINGS.damageLabel}</span>
    </div>
  );
}
