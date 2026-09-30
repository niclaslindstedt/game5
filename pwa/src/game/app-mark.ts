// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE APP MARK'S TRACKS, as paths anything in the app can draw.
//
// The mark is a pair of carved ski tracks coming down off a peak: a white
// mountain under a clear sky with a shadowed ridge behind it, the two
// parallel tracks starting just under the summit and swinging down the face
// in an S — one bend to the right, one back to the left — toward the lower
// left, with a red slalom gate standing on the face beside them. The gate
// and the mountain belong to the ICON and stay there; the TRACKS are the
// part worth reusing, because a track is a thing that is CUT, and a pair of
// them drawing themselves from the summit to the run-out is the app's own
// mark saying it is working.
//
// THE GEOMETRY IS STATED THREE TIMES and they must agree: here, as the two
// `d` strings; in `pwa/public/icons/icon.svg`, as the same two; and in
// `scripts/generate-icons.mjs`, as the arc centres and radii the raster icons
// are drawn from. None can import either of the others, so that is not a
// comment anybody has to remember — `tests/app_mark_test.ts` reads the SVG
// and holds these to it.
//
// The two arcs of each track are TANGENT where the first turn gives way to
// the second — the second's centre sits on the first's radial through that
// point, on the far side of it — so a track runs continuously through the
// edge change instead of stepping. Because the turn reverses there, a track
// that runs OUTSIDE the first bend runs INSIDE the second: the outer track
// is radius +0 on both, the inner one −36 on the first bend and +36 on the
// second.

/** The box the two tracks actually ink, stroke and round caps included. NOT
 * the icon's own 512-square: the tracks run down the left half of it with
 * the summit above and the gate to the right, so a tracks-only drawing
 * framed on the square is a thin pair of lines adrift in a lot of empty
 * snow. */
export const MARK_TRAIL_VIEWBOX = "60 130 290 310";

/** The outer track and the inner one, summit first: every path starts just
 * under the peak, bends right down the face and swings back left into the
 * run-out. Drawn in that direction the tracks are being CUT; reversed, they
 * are being swept away. */
export const MARK_TRAILS = [
  "M 320.95 148.7 A 150 150 0 0 1 206.05 347.72 A 130 130 0 0 0 110.8 420.81",
  "M 287.12 161.01 A 114 114 0 0 1 199.8 312.27 A 166 166 0 0 0 78.17 405.6",
] as const;

/** How wide a track is drawn in the icon's space. */
export const MARK_WIDTH = 22;
