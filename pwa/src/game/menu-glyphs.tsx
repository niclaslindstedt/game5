// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MARKS THE CARDS ARE READ BY — one 24×24 box per idea, stroked in
// `currentColor`, so a mark takes the colour of whatever it sits in. A card
// a player has to READ to find the press they came for is a card that has
// failed; a mark is found without reading.
//
// Only the marks this slice's cards use: the flag on RACE, the kicker on FREE
// RIDE, the flip on TRICKS, the shutter on the
// GALLERY chip, the sliders on the front door's OPTIONS chip,
// the four the pause card is read by — carry on, start again, watch it
// back, leave — the
// sliders again on the pause card's OPTIONS, and the three more its groups are headed with
// (the keys, the dial, the screen; SOUND takes the speaker). Each group mark
// is chosen for what it is NOT: a wide box with a spacebar in it is not a
// screen on a stand, and a dial shares no silhouette with either.

import type { JSX } from "preact";

export const GLYPH_NAMES = [
  "flag",
  "speaker",
  "mute",
  "play",
  "restart",
  "exit",
  "sliders",
  "keyboard",
  "gauge",
  "display",
  "kicker",
  "camera",
  "flip",
  "replay",
  "chart",
] as const;

export type GlyphName = (typeof GLYPH_NAMES)[number];

/** The 24x24 body of each mark. Stroke geometry only — the wrapper below
 * sets the paint. */
const GLYPHS: Record<GlyphName, JSX.Element> = {
  // THE CHEQUERED FLAG: the race — the one mark every player already knows.
  flag: (
    <>
      <path d="M5 3.5v17.5" />
      <path d="M5 4.5h14v9H5z" />
      <path
        d="M5 4.5h3.5v4.5H5zM12 4.5h3.5v4.5H12zM8.5 9H12v4.5H8.5zM15.5 9H19v4.5h-3.5z"
        fill="currentColor"
        stroke="none"
      />
    </>
  ),
  // A CONE AND TWO ARCS: the sound, on. Only two arcs — a third is a hair's
  // width from the second at the small end and turns the pair into a smudge.
  speaker: (
    <>
      <path d="M3.4 9.2h3.5L12.2 5v14L6.9 14.8H3.4z" />
      <path d="M15.8 9.7a3.6 3.6 0 0 1 0 4.6M18.6 7.2a7.3 7.3 0 0 1 0 9.6" />
    </>
  ),
  // ...and off: the same cone with a cross where the sound was.
  mute: (
    <>
      <path d="M3.4 9.2h3.5L12.2 5v14L6.9 14.8H3.4z" />
      <path d="M15.6 9.2l5.6 5.6M21.2 9.2l-5.6 5.6" />
    </>
  ),
  // A PLAY TRIANGLE: back onto the snow, on the very frame the race was
  // left on.
  play: <path d="M8.2 4.8 19.6 12 8.2 19.2Z" fill="currentColor" stroke="none" />,
  // A BAR AND A WEDGE BACK TO IT: the race again, from the grid.
  restart: (
    <>
      <path d="M5.2 5.8v12.4" />
      <path d="M19 6.2v11.6L8.4 12Z" fill="currentColor" stroke="none" />
    </>
  ),
  // A DOOR WITH THE WAY OUT THROUGH IT: the front door, and the one press on
  // the pause card that ends the race.
  exit: (
    <>
      <path d="M13.2 3.4H5.6a2 2 0 0 0-2 2v13.2a2 2 0 0 0 2 2h7.6" />
      <path d="M9.8 12h10.6" />
      <path d="M16.9 8.5 20.4 12l-3.5 3.5" />
    </>
  ),
  // THREE FADERS AT THREE LEVELS: the options — every knob the game has.
  sliders: (
    <>
      <path d="M3 6.5h4M13 6.5h8" />
      <circle cx="10" cy="6.5" r="2.4" />
      <path d="M3 12h9M18 12h3" />
      <circle cx="15" cy="12" r="2.4" />
      <path d="M3 17.5h2M11 17.5h10" />
      <circle cx="8" cy="17.5" r="2.4" />
    </>
  ),
  // A KEYBOARD: a wide box, three keys and a spacebar — the controls.
  keyboard: (
    <>
      <rect x="1.6" y="6.4" width="20.8" height="11.2" rx="2.2" />
      <path d="M6.2 10.4h1.3M11.35 10.4h1.3M16.5 10.4h1.3" />
      <path d="M8 14.2h8" />
    </>
  ),
  // A DIAL AND ITS NEEDLE: the help the skis gives. The needle stops well
  // short of the arc and is thick at the hub, so the two never merge at the
  // small end, where a group heading is read.
  gauge: (
    <>
      <path d="M2.9 18.4a9.1 9.1 0 1 1 18.2 0" />
      <path d="M12 18 15.9 12.6" />
      <circle cx="12" cy="18.4" r="1.9" fill="currentColor" stroke="none" />
    </>
  ),
  // A SCREEN ON A STAND: the picture.
  display: (
    <>
      <rect x="2.4" y="4" width="19.2" height="13" rx="2.2" />
      <path d="M12 17v3.4M8.4 20.4h7.2" />
    </>
  ),
  // A WEDGE AND THE ARC OFF ITS LIP: the free ride — the kicker a skier goes
  // out into the country to find, and the air it throws him.
  kicker: (
    <>
      <path d="M3 19.5h9.5L12.5 14Z" fill="currentColor" stroke="none" />
      <path d="M3 19.5h18" />
      <path d="M13 13.2c2.2-4.6 5.4-6 7.6-3.8" />
      <circle cx="20.4" cy="12.4" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  // A LIP AND A LOOP OFF IT: the tricks run — the same wedge as the free
  // ride's, and what is turned over it rather than how far it throws.
  flip: (
    <>
      <path d="M2.5 20h8L10.5 16Z" fill="currentColor" stroke="none" />
      <path d="M2.5 20h19" />
      <path d="M12.6 14.6a4.6 4.6 0 1 1 5.6 2" />
      <path d="M19.6 13.4l-1.4 3.2-3.2-1.2" />
    </>
  ),
  // THE SHUTTER: the pictures a skier took, and the press that takes one — a
  // stills camera, never the HUD's movie camera, which walks the ladder.
  camera: (
    <>
      <rect x="2.6" y="7.4" width="18.8" height="12.4" rx="2.4" />
      <path d="M8.4 7.4 9.9 5h4.2l1.5 2.4" />
      <circle cx="12" cy="13.6" r="3.6" />
    </>
  ),
  // AN ARROW COME ROUND ON ITSELF WITH A PLAY WEDGE INSIDE: the run watched
  // again — not RESUME's bare wedge, which sits two rows above it.
  replay: (
    <>
      <path d="M4.6 9.2A8 8 0 1 1 4 12" />
      <path d="M4.2 4.8v4.6h4.6" />
      <path d="M10.2 8.8 15.4 12l-5.2 3.2Z" fill="currentColor" stroke="none" />
    </>
  ),
  // THREE BARS OFF A BASELINE, climbing: the statistics — a skier's numbers
  // added up. Bars rather than a line, so it shares no silhouette with the
  // gauge.
  chart: (
    <>
      <path d="M3.5 20.5h17" />
      <rect x="5.4" y="12.5" width="3.4" height="8" rx="0.6" />
      <rect x="10.3" y="8" width="3.4" height="12.5" rx="0.6" />
      <rect x="15.2" y="3.5" width="3.4" height="17" rx="0.6" />
    </>
  ),
};

/** One mark, sized by whatever it sits in. Always decorative: every glyph
 * in the menus stands beside a word that names the same thing. */
export function Glyph({ name, className }: { name: GlyphName; className?: string }) {
  return (
    <svg
      class={`menu-glyph ${className ?? ""}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      {GLYPHS[name]}
    </svg>
  );
}
