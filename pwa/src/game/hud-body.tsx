// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BODY, AS AN ANATOMY PLATE — how the skier is, in one glance at the
// left edge of the frame. The classic figure FROM THE FRONT (`body-figure.ts`,
// traced): his right on the viewer's left, the flesh of every part painted
// by its worst injury that is not a bone's — green sound, yellow a minor
// injury, orange a moderate one, red serious and worse (`body-tile.ts`) —
// and over it, as an X-ray shows them, the BONES: ivory and whole when
// sound; on a hairline yellow, a fissure cut into the bone; broken red, cut
// through and its fragment displaced (`fractureOf`) — the bone itself
// fractured, never a mark drawn on it. The part the last blow struck is lit while the g meter holds it.
//
// Under the figure, the WORD for the whole body and the worst injuries the
// figure cannot show, in plain words — the organs, the ligaments, the
// sprains; never a fracture, which is on the bone — and the run's hardest
// blow. Every figure is the engine's (`body.ts`).

import type { JSX } from "preact";

import { BODY_PARTS, BONES, type Bone } from "@engine";

import {
  BACK,
  BONE_ORDER,
  BONE_SHAPES,
  FIGURE,
  OUTLINE,
  REGIONS,
  fractureOf,
} from "./body-figure.ts";
import type { BodyTile, BodyTone, BoneTone } from "./body-tile.ts";
import { STRINGS } from "./strings.ts";

/** The worst paint anywhere on him — the word over the list takes it. */
function worstOf(parts: BodyTone[], bones: BoneTone[]): BodyTone {
  const rank: BodyTone[] = ["ok", "hurt", "spent", "dead"];
  const fromBones: BodyTone[] = bones.map((b) =>
    b === "break" ? "dead" : b === "hairline" ? "hurt" : "ok",
  );
  return [...parts, ...fromBones].reduce<BodyTone>(
    (w, t) => (rank.indexOf(t) > rank.indexOf(w) ? t : w),
    "ok",
  );
}

/** A bone's own shapes, filled even-odd round their holes. */
function Fills({ bone }: { bone: Bone }): JSX.Element {
  return (
    <>
      {BONE_SHAPES[bone].fill.map((d, i) => (
        <path key={i} class="hud-bone-fill" d={d} fill-rule="evenodd" />
      ))}
    </>
  );
}

/** One bone, and what is wrong with it — the bone itself, fractured, in
 * its colour (`body.css`); nothing is drawn on it. SOUND: whole. A
 * HAIRLINE: a fissure cut into it from one edge. A BREAK: cut through,
 * the far fragment displaced and angulated, a long bone's butterfly
 * fragment knocked out of the break. */
function BoneMark({ bone, tone }: { bone: Bone; tone: BoneTone }): JSX.Element {
  const b = BONE_SHAPES[bone];
  const body = (
    <>
      <Fills bone={bone} />
      {b.shade.map((d, i) => (
        <path key={`s${i}`} class="hud-bone-shade" d={d} />
      ))}
    </>
  );
  if (tone === "sound") return <g class="hud-bone hud-bone-sound">{body}</g>;
  const fr = fractureOf(bone);
  const id = `hud-bone-${bone}`;
  if (tone === "hairline") {
    return (
      <g class="hud-bone hud-bone-hairline">
        <defs>
          <clipPath id={`${id}-whole`}>
            <path d={`M-20,-20H112V231H-20Z${fr.fissure}`} clip-rule="evenodd" />
          </clipPath>
        </defs>
        <g clip-path={`url(#${id}-whole)`}>{body}</g>
      </g>
    );
  }
  return (
    <g class="hud-bone hud-bone-break">
      <defs>
        <clipPath id={`${id}-rest`}>
          <path d={fr.rest} clip-rule="evenodd" />
        </clipPath>
        <clipPath id={`${id}-piece`}>
          <path d={fr.piece} clip-rule="evenodd" />
        </clipPath>
        {fr.chip && (
          <clipPath id={`${id}-chip`}>
            <path d={fr.chip} />
          </clipPath>
        )}
      </defs>
      <g clip-path={`url(#${id}-rest)`}>{body}</g>
      <g transform={fr.move}>
        <g clip-path={`url(#${id}-piece)`}>{body}</g>
      </g>
      {fr.chip && (
        <g transform={fr.chipMove}>
          <g clip-path={`url(#${id}-chip)`}>{body}</g>
        </g>
      )}
    </g>
  );
}

export function BodyPanel({ tile }: { tile: BodyTile }): JSX.Element {
  const worst = worstOf(tile.parts, tile.bones);
  const word = STRINGS.conditions[tile.condition];
  const injuries = tile.lines.length + tile.more;
  const back = BODY_PARTS.indexOf("back");
  const lit = (part: string): string => (tile.struck === part ? " hud-body-struck" : "");
  return (
    <div
      class={`hud-body hud-hp-${worst}`}
      role="img"
      aria-label={STRINGS.bodyAria(word, injuries)}
    >
      <svg class="hud-body-figure" viewBox={`0 0 ${FIGURE.w} ${FIGURE.h}`} aria-hidden="true">
        <defs>
          <clipPath id="hud-body-skin">
            <path d={OUTLINE} />
          </clipPath>
        </defs>
        {/* THE FLESH: each part cut out of the one outline. */}
        <g clip-path="url(#hud-body-skin)">
          {BODY_PARTS.map((part, i) =>
            part === "back" ? null : (
              <path
                key={part}
                class={`hud-body-part hud-hp-${tile.parts[i]}${lit(part)}`}
                d={REGIONS[part]}
              />
            ),
          )}
          <path class={`hud-body-back hud-hp-${tile.parts[back]}${lit("back")}`} d={BACK} />
        </g>
        <path class="hud-body-skin" d={OUTLINE} />
        {/* THE BONES, back to front, inside the flesh. */}
        <g clip-path="url(#hud-body-skin)">
          {BONE_ORDER.map((bone) => (
            <BoneMark key={bone} bone={bone} tone={tile.bones[BONES.indexOf(bone)]} />
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
