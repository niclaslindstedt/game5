// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LOGO: the mark leant beside the FALL LINE wordmark, in one of its two
// lockups (`wordmark.ts`), and — on the title — revealed.
//
// It is drawn as TWO svg layers over one coordinate space, the mark's and
// the name's, because the reveal treats them differently: the name is swept
// on by a slanted window that only an HTML element's `clip-path` can carry
// reliably across browsers, and that window must not cut the mark beside it.
//
// THE REVEAL (`title.css`, `reveal`): the peak rises into place and the
// alpenglow flashes on its ridge; the carve draws itself down the face from
// the summit; the name is swept on along the fall line, whole, and only then
// does the cut open in it (the uncut copy over it fades); a little snow dust
// puffs off the letters' foot as the sweep lands, and once the logo has
// settled a glint runs across the letters. Transforms and opacity only, but
// for the carve's dash and the sweep's window. Without `reveal`, or under
// reduced motion, the logo simply stands finished.

import { useId } from "preact/hooks";

import { APP_NAME } from "../identity.ts";
import { MARK_FACE_COLOURS, MARK_PEAK, MARK_TRAILS, MARK_WIDTH } from "./app-mark.ts";
import { cutBand, lockup, pathOf, WORDMARK_CAP, type LockupKind, type Pt } from "./wordmark.ts";

/** Room round the lockup's own box for what is drawn past it: the tile's
 * rim, and the letters' depth to the lower right. Units. */
const PAD = { left: 4, top: 4, right: 10, bottom: 10 } as const;

/** The letters' depth: how far the dark copy under them is set off, units. */
const DEPTH: Pt = [3, 5];

/** The puffs of snow dust off the letters' foot: where along the foot each
 * starts (a share of the name's width) and which way it drifts, units. */
const DUST: readonly { at: number; dx: number; dy: number; r: number }[] = [
  { at: 0.08, dx: -10, dy: -14, r: 2.4 },
  { at: 0.2, dx: -4, dy: -22, r: 1.8 },
  { at: 0.33, dx: 6, dy: -12, r: 2.8 },
  { at: 0.45, dx: -6, dy: -18, r: 1.6 },
  { at: 0.58, dx: 10, dy: -24, r: 2.2 },
  { at: 0.7, dx: 4, dy: -10, r: 1.9 },
  { at: 0.82, dx: 12, dy: -18, r: 2.5 },
  { at: 0.93, dx: 16, dy: -12, r: 1.7 },
];

const pts = (poly: readonly Pt[]): string => poly.map(([x, y]) => `${x},${y}`).join(" ");

export function TitleLogo({
  lockup: kind,
  reveal = false,
  className,
}: {
  lockup: LockupKind;
  /** Play the title's reveal on arrival rather than standing finished. */
  reveal?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (name: string) => `tl-${uid}-${name}`;
  const L = lockup(kind);
  const x = -PAD.left;
  const y = -PAD.top;
  const w = L.width + PAD.left + PAD.right;
  const h = L.height + PAD.top + PAD.bottom;
  const viewBox = `${x} ${y} ${w} ${h}`;
  const letters = L.letters.map((g) => pathOf(g.parts));
  const words = letters.map((d) => <path key={d} d={d} />);
  // The name's foot and its span, for the dust.
  let left = Infinity;
  let right = -Infinity;
  let foot = -Infinity;
  for (const g of L.letters) {
    for (const part of g.parts) {
      for (const [px, py] of part) {
        left = Math.min(left, px);
        right = Math.max(right, px);
        foot = Math.max(foot, py);
      }
    }
  }
  const tile = MARK_PEAK.filter((f) => f.face !== "glow");
  const glow = MARK_PEAK.find((f) => f.face === "glow");
  return (
    <div
      class={`title-logo title-logo-${kind}${reveal ? " title-logo-reveal" : ""}${className ? ` ${className}` : ""}`}
      style={{ aspectRatio: `${w} / ${h}` }}
      role="img"
      aria-label={APP_NAME}
    >
      <svg class="title-logo-layer title-logo-mark" viewBox={viewBox} aria-hidden="true">
        <defs>
          <linearGradient id={id("night")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="var(--brand-night)" />
            <stop offset="1" stop-color="var(--dusk)" />
          </linearGradient>
          <clipPath id={id("tile")}>
            <rect width="512" height="512" rx="96" />
          </clipPath>
        </defs>
        <g transform={L.markTransform}>
          <rect
            class="title-logo-tile"
            width="512"
            height="512"
            rx="96"
            fill={`url(#${id("night")})`}
          />
          <g clip-path={`url(#${id("tile")})`}>
            <g class="title-logo-peak">
              {tile.map((f) => (
                <polygon key={f.face} fill={MARK_FACE_COLOURS[f.face]} points={f.points} />
              ))}
            </g>
            {glow && (
              <polygon class="title-logo-glow" fill={MARK_FACE_COLOURS.glow} points={glow.points} />
            )}
            <g class="title-logo-carve" stroke-width={MARK_WIDTH}>
              {MARK_TRAILS.map((d) => (
                <path key={d} d={d} pathLength={1} />
              ))}
            </g>
          </g>
          <rect class="title-logo-rim" width="512" height="512" rx="96" />
        </g>
      </svg>
      <svg class="title-logo-layer title-logo-word" viewBox={viewBox} aria-hidden="true">
        <defs>
          {/* Per letter: snow at the top, ice toward the foot. */}
          <linearGradient id={id("ink")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.42" stop-color="var(--snow)" />
            <stop offset="1" stop-color="var(--ice)" />
          </linearGradient>
          <linearGradient id={id("glint")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#fff" stop-opacity="0" />
            <stop offset="0.5" stop-color="#fff" stop-opacity="0.75" />
            <stop offset="1" stop-color="#fff" stop-opacity="0" />
          </linearGradient>
          {/* THE CUT, a gap: everything but its band is let through. */}
          <mask id={id("cut")} maskUnits="userSpaceOnUse" x={x} y={y} width={w} height={h}>
            <rect x={x} y={y} width={w} height={h} fill="#fff" />
            <polygon points={pts(cutBand(L.cut))} fill="#000" />
          </mask>
          <clipPath id={id("letters")}>{words}</clipPath>
        </defs>
        <g mask={`url(#${id("cut")})`}>
          <g class="title-logo-depth" transform={`translate(${DEPTH[0]} ${DEPTH[1]})`}>
            {words}
          </g>
          <g fill={`url(#${id("ink")})`}>{words}</g>
        </g>
        {/* The same letters whole, over the cut ones: the reveal fades them
            out last, which is the cut opening. Standing still they are not
            drawn at all. */}
        {reveal && (
          <g class="title-logo-whole" fill={`url(#${id("ink")})`}>
            {words}
          </g>
        )}
        {reveal && (
          <g clip-path={`url(#${id("letters")})`}>
            {/* Leant the other way from the letters, so it crosses them
                rather than running down a stem. */}
            <g transform="skewX(-24)">
              <rect
                class="title-logo-glint"
                x={left - WORDMARK_CAP * 0.6}
                y={-PAD.top}
                width={WORDMARK_CAP * 0.45}
                height={h}
                fill={`url(#${id("glint")})`}
                style={{ "--glint-run": `${right - left + WORDMARK_CAP * 2.6}px` }}
              />
            </g>
          </g>
        )}
        {reveal && (
          <g class="title-logo-dust">
            {DUST.map((d) => (
              <circle
                key={d.at}
                cx={left + (right - left) * d.at}
                cy={foot - 2}
                r={d.r}
                style={{ "--dust-x": `${d.dx}px`, "--dust-y": `${d.dy}px` }}
              />
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}
