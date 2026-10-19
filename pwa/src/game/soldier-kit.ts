// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SOLDIER'S KIT, AS NUMBERS — what the army's winter infantry wear and
// carry, stated once for the figure that draws them (`soldier-shapes.ts`),
// the poses that hold them (`soldier-pose.ts`) and the lab (`make army`).
// Three-free, so the suite reads it (`tests/soldier_test.ts`).
//
// WHAT A WINTER SOLDIER LOOKS LIKE (`docs/army.md` has the research): a
// white smock and trousers worn OVER the field uniform — either plain
// "whites" or a snow camouflage, white with sparse grey-green and grey
// blotches; a helmet under a white cloth cover; goggles over a balaclava;
// a chest rig of magazine pouches; a big white-covered pack; mittens; and
// white, wide, cable-bound touring skis about two metres long. The rifle
// is a 5.56 mm-class assault rifle under a metre long; a section's
// anti-armour man carries a disposable launcher, a tube about a metre long
// and under a decimetre across.

/** The colours of the kit, linear-ish sRGB hex: the cloth's whites and
 * its blotches, the webbing's, the helmet cover's, the skin the
 * balaclava leaves, the lens, the boots, the metal and polymer of the
 * weapons, the launcher's olive tube, the skis' white, their edges and
 * their binding. */
export const KIT_COLOURS = {
  white: 0xe9ecee,
  whiteShade: 0xd3d8dc,
  blotch: 0x8d968a,
  blotchDark: 0x5e665c,
  webbing: 0xc9ccc4,
  pouch: 0xb8bcb3,
  cover: 0xeef0f1,
  balaclava: 0xdfe2e3,
  skin: 0xc49a80,
  lens: 0x3a4652,
  boot: 0x2b2a28,
  mitten: 0xd8dbd6,
  metal: 0x2a2c2e,
  polymer: 0x3b3d3a,
  tube: 0x4d5636,
  skis: 0xf2f3f2,
  edge: 0x6c7277,
  binding: 0x30302e,
  pole: 0x8e959c,
} as const;
export type KitColour = keyof typeof KIT_COLOURS;

/** THE RIFLE, m along its bore from the butt: the stock's length to the
 * receiver, the receiver's, the handguard's, the barrel past it; the pistol
 * grip's place and the magazine's (from the butt), their drops below the
 * bore, and the bore's height over the receiver's floor. About 0.9 m with
 * the stock extended — the class's. */
export const RIFLE = {
  length: 0.9,
  stock: 0.27,
  receiver: 0.24,
  handguard: 0.24,
  barrel: 0.15,
  grip: 0.32,
  gripDrop: 0.11,
  magazine: 0.42,
  magazineDrop: 0.2,
  depth: 0.06,
  width: 0.034,
} as const;

/** THE LAUNCHER: a disposable anti-armour tube, m — its length, its
 * outer diameter, the grip's place from its rear and how far below the
 * tube's axis it is, the sight's place from the rear. */
export const LAUNCHER = {
  length: 1.0,
  diameter: 0.09,
  grip: 0.42,
  gripDrop: 0.09,
  sight: 0.55,
} as const;

/** THE SKIS: a military touring pair — longer, wider and plainer than a
 * resort pair, white top to bottom, a cable binding; length and width, m. */
export const ARMY_SKIS = { length: 2.1, width: 0.085 } as const;

/** WHAT HE WEARS OVER HIS UNIFORM: plain whites, or a snow camouflage. */
export type Smock = "whites" | "camo";

/** The share of a cloth's surface each blotch colour takes in the snow
 * camouflage — sparse, so the white reads from a distance. */
export const CAMO_SHARE = { blotch: 0.13, dark: 0.06 } as const;

/** THE SNOW CAMOUFLAGE at a point of the cloth (in the figure's own frame
 * at its rest pose, m): 0 white, 1 the grey-green blotch, 2 the dark one.
 * A sum of a few skewed waves, thresholded — big soft-edged blotches about
 * a hand to a forearm across, the same on every man (`seed` shifts them
 * for a second pattern), plain white where the smock is `whites`. */
export function camoAt(x: number, y: number, z: number, seed = 0): 0 | 1 | 2 {
  const s = seed * 1.7;
  const f =
    Math.sin(9.1 * x + 3.7 * y + s) * Math.cos(7.3 * z - 5.1 * y + 1.3 + s) +
    0.55 * Math.sin(13.7 * y - 8.9 * z + 4.1 * x + 2.2) +
    0.35 * Math.cos(17.9 * x + 11.3 * z - 6.7 * y + s);
  // f spans about ±1.9: the top fifth is a blotch, its top third dark.
  if (f > 1.08) return 2;
  if (f > 0.62) return 1;
  return 0;
}
