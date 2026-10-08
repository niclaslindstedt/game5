// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE APP MARK, as data anything in the app can draw.
//
// The mark is THE CARVE OFF THE PEAK: a faceted mountain on a night tile —
// a lit face, a shadow face, a lower shoulder and a thin blade of alpenglow
// along the sunlit skyline just under the summit — and down the lit face a
// pair of carved ski tracks in the flag's red, starting under the summit and
// swinging down in an S: one long bend to the right, one back to the left.
// Red on white snow is what survives a sixteen-pixel favicon; the tracks are
// drawn few and bold for that reason.
//
// The TRACKS are the part worth reusing on their own, because a track is a
// thing that is CUT, and a pair of them drawing themselves from the summit
// to the run-out is the app's own mark saying it is working (the loading
// card). The PEAK is what the full mark adds, and the title logo draws both
// (`title-logo.tsx`).
//
// THE GEOMETRY IS STATED THREE TIMES and they must agree: here, as the two
// `d` strings and the facets' points; in `pwa/public/icons/icon.svg`, as the
// same paths and polygons; and in `scripts/generate-icons.mjs`, as the arc
// centres and radii and the same polygons the raster icons are drawn from.
// None can import either of the others, so `tests/app_mark_test.ts` reads
// the SVG and holds these to it.
//
// The two arcs of each track are TANGENT where the first bend gives way to
// the second — the second's centre sits on the first's radial through that
// point, on the far side of it — so a track runs continuously through the
// edge change instead of stepping. Because the turn reverses there, a track
// that runs OUTSIDE the first bend runs INSIDE the second: the outer track
// is radius +21 on the first bend and −21 on the second, the inner one the
// other way round, about a spine of radius 96 then 112.

/** The box the two tracks actually ink, stroke and round caps included. NOT
 * the icon's own 512-square: the tracks run down the middle of it with the
 * summit above and the faces either side, so a tracks-only drawing framed on
 * the square is a thin pair of lines adrift in a lot of empty snow. */
export const MARK_TRAIL_VIEWBOX = "144 102 204 384";

/** The outer track and the inner one, summit first: every path starts just
 * under the peak, bends right down the face and swings back left into the
 * run-out. Drawn in that direction the tracks are being CUT; reversed, they
 * are being swept away. */
export const MARK_TRAILS = [
  "M 272.5 117.81 A 117 117 0 0 1 257.83 327.62 A 91 91 0 0 0 210.13 451.88",
  "M 251.5 154.19 A 75 75 0 0 1 242.1 288.68 A 133 133 0 0 0 172.38 470.3",
] as const;

/** How wide a track is drawn in the icon's space. */
export const MARK_WIDTH = 26;

/** The mountain's facets in the icon's 512-square, as SVG `points`, painted
 * in this order: the WHOLE silhouette in the shadow's blue first (so the
 * seams between the faces laid over it antialias against snow, never
 * against the night behind), the lit face the tracks are cut down, the
 * lower-left shoulder a shade off the lit snow, and the alpenglow's blade
 * along the sunlit skyline under the summit. What is left of the first is
 * the shadow face, right of the crest. The summit is (296, 84); every face
 * runs off the square's foot. */
export const MARK_PEAK = [
  { face: "shadow", points: "296,84 512,232 512,512 0,512 0,350 140,214" },
  { face: "lit", points: "296,84 440,512 96,512 140,214" },
  { face: "shoulder", points: "140,214 96,512 0,512 0,350" },
  { face: "glow", points: "296,84 415,165 407,177" },
] as const;

/** Which mark face is painted which colour. The shoulder is the one tone
 * the palette does not carry — the lit snow a step toward its shadow — so
 * it is stated here (and in the SVG and the generator beside it). */
export const MARK_FACE_COLOURS = {
  shadow: "#b9cde0",
  lit: "#f4f8fb",
  shoulder: "#dbe6f1",
  glow: "#ffb27a",
} as const;
