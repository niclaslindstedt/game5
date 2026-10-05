// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BODY, AS AN ANATOMY PLATE — how the skier is, in one glance at the
// left edge of the frame. The classic figure FROM THE FRONT (`body-figure.ts`,
// made from a whole body's CT; `side="back"` draws him from behind): his
// right on the viewer's left, the flesh of every part painted by its worst
// injury that is not a bone's — green sound, yellow a minor injury, orange a
// moderate one, red serious and worse (`body-tile.ts`) — and over it, as an
// X-ray shows them, the BONES, lit and shaded as they lie: bone grey and
// whole when sound; on a hairline yellow, a fissure cut into the bone;
// broken red, cut through and its fragment displaced (`fractureOf`); a
// harder break knocks a butterfly fragment out of it, and one past the
// energy that shatters it lies in pieces — every piece thrown the further
// the harder he was struck. The bone itself fractured, never a mark drawn on
// it. The part the last blow struck is lit while the g meter holds it, and
// the whole figure SHAKES with the blow he went down on, by how hard it was
// (`shakeOf`, the g meter's own).
//
// The panel is SIZED by how hurt he is (`BodyTile.scale`): half its full
// size while he is sound, growing to it as the injuries mount.
//
// Under the figure, the WORD for the whole body and the worst injuries the
// figure cannot show, in plain words — the organs, the ligaments, the
// sprains; never a fracture, which is on the bone — and the run's hardest
// blow. Every figure is the engine's (`body.ts`).

import type { JSX } from "preact";
import { useEffect, useRef } from "preact/hooks";

import { BODY_PARTS, BONES, type Bone as BoneName } from "@engine";

import {
  EVERYWHERE,
  FIGURE,
  figureView,
  fractureOf,
  moveCss,
  type BoneDraw,
  type FigureSide,
  type Move,
} from "./body-figure.ts";
import type { BodyTile, BodyTone, BoneTone } from "./body-tile.ts";
import { shakeOf } from "./hud-gforce.tsx";
import { STRINGS } from "./strings.ts";

/** The worst paint anywhere on him — the word over the list takes it. */
function worstOf(parts: BodyTone[], bones: BoneTone[]): BodyTone {
  const rank: BodyTone[] = ["ok", "hurt", "spent", "dead"];
  const fromBones: BodyTone[] = bones.map((b) =>
    b === "sound" ? "ok" : b === "hairline" ? "hurt" : "dead",
  );
  return [...parts, ...fromBones].reduce<BodyTone>(
    (w, t) => (rank.indexOf(t) > rank.indexOf(w) ? t : w),
    "ok",
  );
}

/** A bone as it lies: its shapes filled even-odd round their holes, and
 * over them its shading — the lit faces, the shadowed ones and the
 * recesses — in the bone's own colour, whatever that is. */
function Bone({ draw }: { draw: BoneDraw }): JSX.Element {
  return (
    <>
      <path class="hud-bone-fill" d={draw.fill} fill-rule="evenodd" />
      {draw.shadow && <path class="hud-bone-shadow" d={draw.shadow} fill-rule="evenodd" />}
      {draw.deep && <path class="hud-bone-deep" d={draw.deep} fill-rule="evenodd" />}
      {draw.light && <path class="hud-bone-light" d={draw.light} fill-rule="evenodd" />}
    </>
  );
}

/** The bone drawn inside a clip, moved by `move` (none, where it lies).
 * A moved piece is SNAPPED there: it mounts where the bone lay and is
 * thrown to its place (`.hud-bone-move`, `body.css`), and moves on from
 * there when a harder blow throws it further — `delay` staggers a
 * shattered bone's fragments. */
function Clipped({
  id,
  clip,
  move,
  body,
  evenOdd = true,
  delay = 0,
}: {
  id: string;
  clip: string;
  move?: Move | null;
  body: JSX.Element;
  evenOdd?: boolean;
  delay?: number;
}): JSX.Element {
  const inner = (
    <>
      <defs>
        <clipPath id={id}>
          <path d={clip} clip-rule={evenOdd ? "evenodd" : "nonzero"} />
        </clipPath>
      </defs>
      <g clip-path={`url(#${id})`}>{body}</g>
    </>
  );
  if (!move) return inner;
  const css = moveCss(move);
  return (
    <g
      class="hud-bone-move"
      style={{
        "--to": css.transform,
        transformOrigin: css.origin,
        ...(delay ? { animationDelay: `${delay}ms` } : {}),
      }}
    >
      {inner}
    </g>
  );
}

/** One bone, and what is wrong with it — the bone itself, fractured, in
 * its colour (`body.css`); nothing is drawn on it. SOUND: whole. A
 * HAIRLINE: a fissure cut into it from one edge. A BREAK: cut through, a
 * long bone's two pieces turned about their joints and kinked at the
 * break, a small bone's piece displaced. A WEDGE: a break with a butterfly
 * fragment knocked out of it. SHATTERED: the pieces either side moved
 * further and the bone between in fragments, each thrown out from the
 * blow. The bone keeps its element through every grade, so a new grade's
 * paint and flash play on it (`body.css`). */
function BoneMark({
  bone,
  tone,
  force,
  side,
}: {
  bone: BoneName;
  tone: BoneTone;
  force: number;
  side: FigureSide;
}): JSX.Element {
  const draw = figureView(side).bones[bone];
  if (!draw.fill) return <g />;
  const body = <Bone draw={draw} />;
  if (tone === "sound") return <g class="hud-bone hud-bone-sound">{body}</g>;
  const fr = fractureOf(bone, side, force);
  const id = `hud-bone-${side}-${bone}`;
  if (tone === "hairline") {
    return (
      <g class="hud-bone hud-bone-hairline">
        <Clipped id={`${id}-whole`} clip={`${EVERYWHERE}${fr.fissure}`} body={body} />
      </g>
    );
  }
  if (tone === "shatter") {
    const sh = fr.shatter;
    return (
      <g class="hud-bone hud-bone-break hud-bone-shatter">
        <Clipped id={`${id}-srest`} clip={sh.rest} move={sh.restMove} body={body} />
        <Clipped id={`${id}-spiece`} clip={sh.piece} move={sh.move} body={body} />
        {sh.shards.map((s, i) => (
          <Clipped
            key={i}
            id={`${id}-shard${i}`}
            clip={s.clip}
            move={s.move}
            body={body}
            delay={(i % 4) * 25}
          />
        ))}
      </g>
    );
  }
  const wedge = tone === "wedge";
  return (
    <g class={`hud-bone hud-bone-break${wedge ? " hud-bone-wedge" : ""}`}>
      <Clipped id={`${id}-rest`} clip={fr.rest} move={fr.restMove} body={body} />
      <Clipped
        id={`${id}-piece`}
        clip={wedge ? `${fr.piece}${fr.chip}` : fr.piece}
        move={fr.move}
        body={body}
      />
      {wedge && (
        <Clipped
          id={`${id}-chip`}
          clip={fr.chip}
          move={fr.chipMove}
          body={body}
          evenOdd={false}
          delay={40}
        />
      )}
    </g>
  );
}

/** THE SHAKE'S FRAMES, thrown about by `px` and a few degrees and settling
 * over the run of them. */
export function shakeFrames(px: number): Keyframe[] {
  const at = (x: number, y: number, deg: number, offset: number): Keyframe => ({
    transform: `translate(${(x * px).toFixed(1)}px, ${(y * px).toFixed(1)}px) rotate(${deg}deg)`,
    offset,
  });
  return [
    { transform: "none", offset: 0 },
    at(-1, 0.4, -4, 0.08),
    at(1, -0.5, 3.5, 0.18),
    at(-0.75, 0.3, -2.5, 0.3),
    at(0.5, -0.25, 1.5, 0.44),
    at(-0.3, 0.15, -0.8, 0.6),
    at(0.12, 0, 0.3, 0.78),
    { transform: "none", offset: 1 },
  ];
}

export function BodyPanel({
  tile,
  side = "front",
}: {
  tile: BodyTile;
  side?: FigureSide;
}): JSX.Element {
  const view = figureView(side);
  const skinId = `hud-body-skin-${side}`;
  const worst = worstOf(tile.parts, tile.bones);
  const word = STRINGS.conditions[tile.condition];
  const injuries = tile.lines.length + tile.more;
  const back = BODY_PARTS.indexOf("back");
  const lit = (part: string): string => (tile.struck === part ? " hud-body-struck" : "");
  // THE SHAKE: played on the figure for each blow he goes down on — a
  // little less than the g meter's number, it is smaller — without
  // remounting it, so the bones' own snaps are not played again.
  const blow = tile.blow;
  const shaker = useRef<HTMLDivElement>(null);
  const shakeId = blow ? blow.id : 0;
  const shakeG = blow ? blow.g : 0;
  useEffect(() => {
    const el = shaker.current;
    if (!shakeId || !el || typeof el.animate !== "function") return;
    if (globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    el.animate(shakeFrames(shakeOf(shakeG) * 0.6), { duration: 750, easing: "linear" });
  }, [shakeId, shakeG]);
  return (
    <div
      class={`hud-body hud-hp-${worst}`}
      role="img"
      aria-label={STRINGS.bodyAria(word, injuries)}
      style={{ "--body-scale": tile.scale.toFixed(3) }}
    >
      <div ref={shaker} class="hud-body-shake">
        <svg class="hud-body-figure" viewBox={`0 0 ${FIGURE.w} ${FIGURE.h}`} aria-hidden="true">
          <defs>
            <clipPath id={skinId}>
              <path d={view.outline} clip-rule="evenodd" />
            </clipPath>
          </defs>
          {/* THE FLESH: each part cut out of the one outline. */}
          <g clip-path={`url(#${skinId})`}>
            {BODY_PARTS.map((part, i) => {
              const d = view.regions[part];
              return d ? (
                <path
                  key={part}
                  class={`hud-body-part hud-hp-${tile.parts[i]}${lit(part)}`}
                  d={d}
                />
              ) : null;
            })}
            {view.strip && (
              <path
                class={`hud-body-back hud-hp-${tile.parts[back]}${lit("back")}`}
                d={view.strip}
              />
            )}
          </g>
          <path class="hud-body-skin" d={view.outline} fill-rule="evenodd" />
          {/* THE BONES, back to front, inside the flesh. */}
          <g clip-path={`url(#${skinId})`}>
            {view.order.map((bone) => (
              <BoneMark
                key={bone}
                bone={bone}
                side={side}
                tone={tile.bones[BONES.indexOf(bone)]}
                force={tile.force[BONES.indexOf(bone)]}
              />
            ))}
          </g>
        </svg>
      </div>
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
