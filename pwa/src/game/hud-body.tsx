// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BODY, AS AN ANATOMY PLATE — how the skier is, in one glance at the
// left edge of the frame. The classic figure FROM THE FRONT (`body-figure.ts`,
// traced): his right on the viewer's left, the flesh of every part painted
// by its worst injury that is not a bone's — green sound, yellow a minor
// injury, orange a moderate one, red serious and worse (`body-tile.ts`) —
// and over it, as an X-ray shows them, the BONES: ivory when sound, yellow
// with a hairline across it when cracked, red with a gap through it when
// broken. The part the last blow struck is lit while the g meter holds it.
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
  crackPath,
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

/** One bone: its shapes (each ring filled even-odd round its holes), its
 * shading, and the crack across it. */
function BoneMark({ bone, tone }: { bone: Bone; tone: BoneTone }): JSX.Element {
  const b = BONE_SHAPES[bone];
  return (
    <g class={`hud-bone hud-bone-${tone}`}>
      {b.fill.map((d, i) => (
        <path key={`f${i}`} class="hud-bone-fill" d={d} fill-rule="evenodd" />
      ))}
      {b.shade.map((d, i) => (
        <path key={`s${i}`} class="hud-bone-shade" d={d} />
      ))}
      {tone !== "sound" && (
        <path class="hud-bone-crack" d={crackPath(b.mark, tone === "break" ? 2 : 1)} />
      )}
      {/* A break's two ends apart: the gap down the middle of the crack. */}
      {tone === "break" && <path class="hud-bone-gap" d={crackPath(b.mark, 2)} />}
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
