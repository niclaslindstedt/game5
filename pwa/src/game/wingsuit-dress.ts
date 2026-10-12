// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WINGSUIT'S BODY — the suit over the trunk, the arms and the legs, the
// gloves and the full-face helmet — cut on the loom as the skier's own
// clothes are (`dress.ts`), recoloured in the suit's colourway. Three-free,
// so the suite reads it.
//
// A wingsuit's body is a close one-piece over a flyer's clothes, so it is
// cut from the catalog's closest pieces: the race shell over the trunk and
// arms, the insulated pants (a suit's legs are roomy over a flyer's
// trousers), the race gloves and the visored helmet; NO POLES. Each of
// their catalog colours is then painted in the suit's: the shell's body
// the suit's base, its panels the dark and its trim the edge's colour; the
// legs the base; the gloves dark with the accent's grip; the helmet's shell
// the accent, its visor smoked. The feet are the boots' liners — the
// suit's booties (`dress-garments.ts`'s `cutFeet`), which a wingsuit run
// draws with no ski boots over them. The WINGS are lofted apart, every
// frame (`wingsuit-cloth.ts`).

import { dressOutfit, keptCut } from "./dress.ts";
import { linear, type DressMesh, type DressPart } from "./dress-loft.ts";
import { GLOVES, HELMETS, JACKETS, PANTS, type Outfit } from "./outfit.ts";
import { colourwayOf } from "./wingsuit-look.ts";

/** The catalog pieces a suit is cut from. */
export function suitOutfit(o: Outfit): Outfit {
  return {
    ...o,
    jacket: "race",
    pants: "insulated",
    helmet: "visor",
    gloves: "race",
    poles: "none",
  };
}

const byId = <T extends { id: string }>(list: readonly T[], id: string): T =>
  list.find((x) => x.id === id) ?? list[0];

/** Each catalog colour the suit's pieces carry and the suit colour it is
 * painted (sRGB). */
export function suitPalette(suit: number): [number, number][] {
  const c = colourwayOf(suit);
  const jacket = byId(JACKETS, "race");
  const pants = byId(PANTS, "insulated");
  const gloves = byId(GLOVES, "race");
  const helmet = byId(HELMETS, "visor");
  return [
    [jacket.main, c.base],
    [jacket.second, c.dark],
    [jacket.third, c.edge],
    [pants.main, c.base],
    [pants.second, c.dark],
    [pants.third, c.dark],
    [gloves.main, c.dark],
    [gloves.second, c.accent],
    [gloves.third, c.dark],
    [helmet.shell, c.accent],
    [helmet.trim, c.dark],
    [helmet.lens, 0x2c3138],
  ];
}

function recolour(part: DressPart, map: [number[], number[]][]): DressPart {
  const color = part.color.slice();
  for (let i = 0; i < color.length; i += 3) {
    for (const [from, to] of map) {
      if (
        Math.abs(color[i] - from[0]) < 1e-4 &&
        Math.abs(color[i + 1] - from[1]) < 1e-4 &&
        Math.abs(color[i + 2] - from[2]) < 1e-4
      ) {
        color[i] = to[0];
        color[i + 1] = to[1];
        color[i + 2] = to[2];
        break;
      }
    }
  }
  return { ...part, color };
}

const cut = new Map<string, DressMesh>();

/** THE SUIT'S BODY for outfit `o` (its body, build and skin) in colourway
 * `suit`: cut once and kept (the last few, `keptCut`). */
export function suitDress(o: Outfit, suit: number, tone?: number, bare = false): DressMesh {
  const key = `${suit}:${tone ?? ""}:${bare ? 1 : 0}:${o.body}:${o.weight}`;
  return keptCut(cut, key, () => {
    const mesh = dressOutfit(suitOutfit(o), tone, bare);
    const map = suitPalette(suit).map(([a, b]) => [linear(a), linear(b)] as [number[], number[]]);
    return { cloth: recolour(mesh.cloth, map), hard: recolour(mesh.hard, map) };
  });
}
