// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BODY, AS A SCHEMATIC — how the skier is feeling, in one glance at the
// left edge of the frame (the rally game's car schematic, retyped for a
// body). A figure seen FROM BEHIND, the way the chase camera sees him, so
// his left is on the left: the head, the neck, the shoulders, the chest,
// the belly and the hips down the trunk with the spine drawn over them,
// and the arms, the hands, the thighs, the knees, the shins and the boots.
// Blocks with gaps between them, four colours (`body-tile.ts`): green
// sound, yellow a minor injury, orange a moderate one, red serious and
// worse. The part the last blow struck is lit while the g meter holds it.
//
// Under the figure, the WORD for the whole body and the worst injuries in
// plain words — what is broken, sprained or torn, never how it looks — and
// the run's hardest blow. Every figure is the engine's (`body.ts`).

import type { JSX } from "preact";

import { BODY_PARTS, type BodyPart } from "@engine";

import type { BodyTile, BodyTone } from "./body-tile.ts";
import { STRINGS } from "./strings.ts";

/** A part's shape in the 60 × 124 box, head up. */
type Shape =
  | { rect: [number, number, number, number]; r?: number }
  | { circle: [number, number, number] }
  | { poly: string };

const SHAPES: Record<BodyPart, Shape> = {
  head: { circle: [30, 9.5, 7] },
  neck: { rect: [27, 17.5, 6, 4], r: 1.2 },
  shoulderL: { rect: [12.5, 22, 9, 9], r: 4 },
  shoulderR: { rect: [38.5, 22, 9, 9], r: 4 },
  chest: { poly: "22.5,22 37.5,22 38,38 22,38" },
  back: { rect: [28.6, 23, 2.8, 36], r: 1.2 },
  abdomen: { poly: "22,39.5 38,39.5 37.6,51 22.4,51" },
  pelvis: { poly: "22,52.5 38,52.5 39.5,61 20.5,61" },
  armL: { rect: [11, 32.5, 6.5, 23], r: 3 },
  armR: { rect: [42.5, 32.5, 6.5, 23], r: 3 },
  handL: { circle: [14, 60, 3.4] },
  handR: { circle: [46, 60, 3.4] },
  thighL: { rect: [21.5, 62.5, 8, 18.5], r: 3 },
  thighR: { rect: [30.5, 62.5, 8, 18.5], r: 3 },
  kneeL: { circle: [25.4, 84.6, 3.4] },
  kneeR: { circle: [34.6, 84.6, 3.4] },
  shinL: { rect: [22, 88.6, 6.8, 17], r: 3 },
  shinR: { rect: [31.2, 88.6, 6.8, 17], r: 3 },
  footL: { rect: [20.5, 107.4, 9, 6.5], r: 2 },
  footR: { rect: [30.5, 107.4, 9, 6.5], r: 2 },
};

/** The spine is drawn over the trunk as a column of vertebrae, so its
 * colour reads through the chest's and the belly's. */
const VERTEBRAE = Array.from({ length: 9 }, (_, i) => 23.4 + i * 4);

function shapeOf(part: BodyPart, cls: string): JSX.Element {
  const s = SHAPES[part];
  if ("circle" in s) {
    const [cx, cy, r] = s.circle;
    return <circle key={part} class={cls} cx={cx} cy={cy} r={r} />;
  }
  if ("poly" in s) return <polygon key={part} class={cls} points={s.poly} />;
  const [x, y, w, h] = s.rect;
  return <rect key={part} class={cls} x={x} y={y} width={w} height={h} rx={s.r ?? 0} />;
}

/** The worst paint anywhere on him — the word over the list takes it. */
function worstOf(parts: BodyTone[]): BodyTone {
  const rank: BodyTone[] = ["ok", "hurt", "spent", "dead"];
  return parts.reduce<BodyTone>((w, t) => (rank.indexOf(t) > rank.indexOf(w) ? t : w), "ok");
}

export function BodyPanel({ tile }: { tile: BodyTile }): JSX.Element {
  const worst = worstOf(tile.parts);
  const word = STRINGS.conditions[tile.condition];
  const injuries = tile.lines.length + tile.more;
  return (
    <div
      class={`hud-body hud-hp-${worst}`}
      role="img"
      aria-label={STRINGS.bodyAria(word, injuries)}
    >
      <svg class="hud-body-figure" viewBox="0 0 60 124" aria-hidden="true">
        {BODY_PARTS.map((part, i) =>
          part === "back"
            ? null
            : shapeOf(
                part,
                `hud-body-part hud-hp-${tile.parts[i]}${tile.struck === part ? " hud-body-struck" : ""}`,
              ),
        )}
        {/* THE SPINE, over the trunk. */}
        <g
          class={`hud-body-spine hud-hp-${tile.parts[BODY_PARTS.indexOf("back")]}${tile.struck === "back" ? " hud-body-struck" : ""}`}
        >
          {VERTEBRAE.map((y) => (
            <rect key={y} x={28.4} y={y} width={3.2} height={2.6} rx={0.9} />
          ))}
        </g>
      </svg>
      <span class="hud-body-word">{word}</span>
      {tile.lines.map((l) => (
        <span
          key={`${l.part}-${l.kind}`}
          class={`hud-body-line hud-hp-${l.ais >= 3 ? "dead" : l.ais === 2 ? "spent" : "hurt"}${l.fresh ? " hud-body-fresh" : ""}`}
        >
          {STRINGS.injury(l.kind, l.part)}
        </span>
      ))}
      {tile.more > 0 && (
        <span class="hud-body-line hud-body-more">{STRINGS.injuryMore(tile.more)}</span>
      )}
      {tile.peak > 0 && (
        <span class="hud-chip-sub hud-body-peak">{STRINGS.hardest(tile.peak)}</span>
      )}
    </div>
  );
}
