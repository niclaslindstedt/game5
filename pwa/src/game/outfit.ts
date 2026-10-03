// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER'S GEAR — what he (or she) wears down the mountain, as a
// catalog: two BODIES and a handful of JACKETS, PANTS, HELMETS, GLOVES and
// POLES, each a real kind of kit off the shop floor and the piste, and each
// SOLD IN ONE COLOURWAY — a piece's colours are its own, never picked, the
// way a pair of skis is sold in its own topsheet. An OUTFIT is one of each;
// the player's is picked on the DRESS card (`menu-dress.tsx`) and kept in
// `Settings.outfit`, and each rival on the start line wears one of
// `RIVAL_OUTFITS`, his jacket in his slot's colour (`skier-colours.ts`) so
// the minimap's dot is the jacket a player sees.
//
// What each kind IS, after what the shops sell and the slopes wear:
//
//   jackets  a RACE SHELL (fitted softshell to just under the seat, a
//            contrasting yoke and sleeve stripes, a stood collar); a DOWN
//            PUFFER (boxy, hip length, sewn through in horizontal baffles
//            9–12 cm apart, a tall collar); a FREERIDE SHELL (a loose
//            hardshell cut long, to the upper thigh, its hood stowed in the
//            collar, colour-blocked across the shoulders); an ANORAK (a
//            loose pullover with a half zip and a kangaroo pocket across the
//            chest, its hood at the back); a RETRO one (the late 80s:
//            bright geometric panels slashed across a white body)
//   pants    INSULATED (a regular cut, gaitered over the boot); RACE (a
//            close softshell, a stripe down the outside of the leg); BAGGY
//            (a park cut: wide, a dropped seat, stacked over the boot);
//            CARGO (a relaxed cut with a bellows pocket on each thigh)
//   weight   the skier's BUILD — LIGHT, MEDIUM, SOLID or HEAVY: not a piece
//            of kit but what is in it, and the one row that is not only a
//            look. The engine skis him at that weight (`defs/riders.ts`:
//            faster downhill, slower to skate up to speed, harder landings,
//            a harder shoulder), and the dress cuts him to its shape
//            (`dress-body.ts`' `builtTo`: broader, a solid one through the
//            chest, a heavy one with a stomach)
//   helmets  RACE (the hard-eared shell, gloss, goggles strapped over it);
//            FREERIDE (matt, soft ear pads, a short peak over the goggles);
//            VISOR (a tinted visor dropped over the face instead of
//            goggles); SLALOM (the race shell with a chin guard)
//   gloves   GAUNTLET (the cuff over the sleeve); MITTENS; UNDERCUFF (a
//            short cuff tucked under the sleeve); RACE (hard plates over
//            the knuckles and the backs of the fingers)
//   poles    ALLOY (a straight 18 mm shaft, a small basket); CARBON (a
//            slim black shaft); SPEED (a downhill racer's, bent round the
//            body so it lies along him in the tuck); POWDER (a big basket
//            that floats in deep snow); and NONE — the hard mode: out with
//            nothing in his hands (`carriesPoles`, the engine's
//            `SkierState.poles`), slower, a weaker climb, less balance
//
// Three-free and DOM-free: the dress (`dress-garments.ts`) cuts each
// piece, the card shows the names, `settings.ts` keeps the pick and
// `tests/outfit_test.ts` holds the catalog.

import { MEDIUM_RIDER, RIDERS, type RiderId } from "@engine";

import type { BuildShape } from "./dress-body.ts";

export type BodyId = "man" | "woman";
export type JacketId = "race" | "puffer" | "shell" | "anorak" | "retro";
export type PantsId = "insulated" | "race" | "baggy" | "cargo";
export type HelmetId = "race" | "freeride" | "visor" | "slalom";
export type GloveId = "gauntlet" | "mitten" | "undercuff" | "race";
export type PoleId = "alloy" | "carbon" | "speed" | "powder" | "none";

export type Outfit = {
  body: BodyId;
  weight: RiderId;
  jacket: JacketId;
  pants: PantsId;
  helmet: HelmetId;
  gloves: GloveId;
  poles: PoleId;
};
export type GearSlot = keyof Outfit;

/** A BUILD: its name and its shape (`dress-body.ts`' `builtTo`) — the
 * GIRTH, the body's breadth and depth as a share of the medium build's at
 * the same height (as the root of the weight, the area the engine's drag
 * reads too), the BELLY a heavy skier carries ahead of it, and the CHEST a
 * solid one carries instead. */
export type WeightDef = BuildShape & { id: RiderId; name: string };

export type BodyDef = {
  id: BodyId;
  name: string;
  /** A woman's measure (`dress-body.ts`) and her braid under the helmet. */
  female: boolean;
  skin: number;
  hair: number;
};

/** A garment's colours: the MAIN body of it, its SECOND colour (a yoke, a
 * panel, a stripe), and a THIRD where it has one (a trim, a panel). */
export type Colours = { main: number; second: number; third: number };

export type JacketDef = Colours & { id: JacketId; name: string };
export type PantsDef = Colours & { id: PantsId; name: string };
export type HelmetDef = {
  id: HelmetId;
  name: string;
  /** The shell; the stripe, peak or guard; the goggles' or visor's lens. */
  shell: number;
  trim: number;
  lens: number;
};
export type GloveDef = Colours & { id: GloveId; name: string };
export type PoleDef = {
  id: PoleId;
  name: string;
  shaft: number;
  grip: number;
  basket: number;
  /** The shaft's radius at the grip and at the tip, m, and the basket's
   * radius, m. */
  radius: [number, number];
  basketRadius: number;
};

export const BODIES: readonly BodyDef[] = [
  { id: "man", name: "Man", female: false, skin: 0xc68863, hair: 0x3a2a1e },
  { id: "woman", name: "Woman", female: true, skin: 0xe0aa86, hair: 0x9a6232 },
];

const WEIGHT_LOOK: Record<RiderId, { name: string; belly: number; chest: number }> = {
  light: { name: "Light", belly: 0, chest: 0 },
  medium: { name: "Medium", belly: 0, chest: 0 },
  solid: { name: "Solid", belly: 0.05, chest: 0.08 },
  heavy: { name: "Heavy", belly: 0.8, chest: 0 },
};

/** The four builds, lightest first, off the engine's own riders. */
export const WEIGHTS: readonly WeightDef[] = RIDERS.map((r) => ({
  id: r.id,
  girth: Math.sqrt(r.mass / MEDIUM_RIDER.mass),
  ...WEIGHT_LOOK[r.id],
}));

export const JACKETS: readonly JacketDef[] = [
  // The gate red, and a racer's black yoke over it.
  { id: "race", name: "Race shell", main: 0xc92a1c, second: 0x15171b, third: 0xf2f2f2 },
  { id: "puffer", name: "Down puffer", main: 0x2a6fd6, second: 0x1a2a44, third: 0xe9eef4 },
  { id: "shell", name: "Freeride shell", main: 0xf2bf22, second: 0x2b2e33, third: 0x1d7f86 },
  { id: "anorak", name: "Anorak", main: 0x22a06a, second: 0xd8c9a3, third: 0x183a2c },
  { id: "retro", name: "Retro", main: 0xf1efe9, second: 0xd6337f, third: 0x4a3aa8 },
];

export const PANTS: readonly PantsDef[] = [
  { id: "insulated", name: "Insulated", main: 0x1b1d22, second: 0x2c3036, third: 0x0e0f12 },
  { id: "race", name: "Race softshell", main: 0x15171b, second: 0xc92a1c, third: 0x2a2d33 },
  { id: "baggy", name: "Baggy", main: 0x8f9499, second: 0x5d6268, third: 0x2a2d31 },
  { id: "cargo", name: "Cargo", main: 0x4d5236, second: 0x3a3e28, third: 0x23251a },
];

export const HELMETS: readonly HelmetDef[] = [
  { id: "race", name: "Race", shell: 0x1b1d21, trim: 0xe8412c, lens: 0xd9a21a },
  { id: "freeride", name: "Freeride", shell: 0xe9ebe8, trim: 0x2b2e33, lens: 0x6fb4e8 },
  { id: "visor", name: "Visor", shell: 0x55595f, trim: 0x1b1d21, lens: 0xc9a02a },
  { id: "slalom", name: "Slalom", shell: 0x2a5fc4, trim: 0xf2f2f2, lens: 0xd96a2b },
];

export const GLOVES: readonly GloveDef[] = [
  { id: "gauntlet", name: "Gauntlet", main: 0x17191d, second: 0x2c2f35, third: 0x0d0e10 },
  { id: "mitten", name: "Mittens", main: 0xb3261b, second: 0x17191d, third: 0xe9e4da },
  { id: "undercuff", name: "Undercuff", main: 0x7a4a2a, second: 0x4a2c18, third: 0x1d1a17 },
  { id: "race", name: "Race", main: 0x17191d, second: 0xd8e021, third: 0x3a3d43 },
];

export const POLES: readonly PoleDef[] = [
  {
    id: "alloy",
    name: "Alloy",
    shaft: 0x9aa1a9,
    grip: 0x17191d,
    basket: 0x17191d,
    radius: [0.009, 0.007],
    basketRadius: 0.045,
  },
  {
    id: "carbon",
    name: "Carbon",
    shaft: 0x202226,
    grip: 0x17191d,
    basket: 0xc92a1c,
    radius: [0.0075, 0.0055],
    basketRadius: 0.032,
  },
  {
    id: "speed",
    name: "Speed",
    shaft: 0xe9eaec,
    grip: 0x17191d,
    basket: 0x17191d,
    radius: [0.009, 0.0065],
    basketRadius: 0.02,
  },
  {
    id: "powder",
    name: "Powder",
    shaft: 0x2a6fd6,
    grip: 0x17191d,
    basket: 0x15171b,
    radius: [0.0095, 0.0075],
    basketRadius: 0.06,
  },
  // NO POLES: the hard mode. Nothing of it is drawn (the pose hands the
  // figure no poles, `skier-pose.ts`); its colours are the alloy pair's,
  // for anything that asks.
  {
    id: "none",
    name: "None",
    shaft: 0x9aa1a9,
    grip: 0x17191d,
    basket: 0x17191d,
    radius: [0.009, 0.007],
    basketRadius: 0.045,
  },
];

/** WHETHER AN OUTFIT CARRIES POLES — every pair but NONE, which sends the
 * skier out without them (the hard mode, `SkierState.poles`). */
export function carriesPoles(o: Outfit): boolean {
  return o.poles !== "none";
}

/** Every slot's catalog, in the order the DRESS card lists them. */
export const GEAR = {
  body: BODIES,
  weight: WEIGHTS,
  jacket: JACKETS,
  pants: PANTS,
  helmet: HELMETS,
  gloves: GLOVES,
  poles: POLES,
} as const;
export const GEAR_SLOTS: readonly GearSlot[] = [
  "body",
  "weight",
  "jacket",
  "pants",
  "helmet",
  "gloves",
  "poles",
];

/** The player's kit before they have dressed: a racer in the gate red. */
export const DEFAULT_OUTFIT: Outfit = {
  body: "man",
  weight: "medium",
  jacket: "race",
  pants: "insulated",
  helmet: "race",
  gloves: "gauntlet",
  poles: "alloy",
};

/** WHAT THE FIELD WEARS: the start line's slots 1–3, each jacket in the
 * slot's own colour, each skier his or her own. The player's slot (0) is
 * the player's outfit. A rival's skin is his own (`tone`), and every one is
 * of the medium build — the field is skied at the reference weight. */
export const RIVAL_OUTFITS: readonly (Outfit & { tone: number })[] = [
  {
    body: "woman",
    weight: "medium",
    jacket: "puffer",
    pants: "race",
    helmet: "freeride",
    gloves: "mitten",
    poles: "carbon",
    tone: 0xe8b896,
  },
  {
    body: "man",
    weight: "medium",
    jacket: "shell",
    pants: "baggy",
    helmet: "visor",
    gloves: "undercuff",
    poles: "powder",
    tone: 0x8a5a3c,
  },
  {
    body: "woman",
    weight: "medium",
    jacket: "anorak",
    pants: "cargo",
    helmet: "slalom",
    gloves: "race",
    poles: "speed",
    tone: 0xb07650,
  },
];

/** One slot's catalog entry for an id — its first when the id is unknown. */
export function gearOf<S extends GearSlot>(slot: S, id: string): (typeof GEAR)[S][number] {
  const list = GEAR[slot] as readonly { id: string }[];
  return (list.find((g) => g.id === id) ?? list[0]) as (typeof GEAR)[S][number];
}

/** An outfit read off anything stored: every slot a known id, the default
 * kit's where it is not. */
export function outfitOf(blob: unknown): Outfit {
  const o = (blob && typeof blob === "object" ? blob : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_OUTFIT };
  for (const slot of GEAR_SLOTS) {
    const id = o[slot];
    const list = GEAR[slot] as readonly { id: string }[];
    if (typeof id === "string" && list.some((g) => g.id === id)) {
      (out as Record<GearSlot, string>)[slot] = id;
    }
  }
  return out;
}

/** The outfit with one slot stepped `by` along its catalog, wrapping. */
export function stepGear(o: Outfit, slot: GearSlot, by: number): Outfit {
  const list = GEAR[slot] as readonly { id: string }[];
  const at = Math.max(
    0,
    list.findIndex((g) => g.id === o[slot]),
  );
  return { ...o, [slot]: list[(at + by + list.length * 8) % list.length].id };
}

/** THE KIT'S COLOURS as the Blender skier's materials are named — what a
 * modelled skier is dressed in when a lab sets one beside the dressed
 * figure (`skier-models.ts`' `dressOf`). */
export function coloursOf(o: Outfit, tone?: number) {
  const j = gearOf("jacket", o.jacket);
  const h = gearOf("helmet", o.helmet);
  return {
    jacket: j.main,
    accent: j.second,
    pants: gearOf("pants", o.pants).main,
    helmet: h.shell,
    visor: h.lens,
    peak: h.trim,
    skin: tone ?? gearOf("body", o.body).skin,
    pole: gearOf("poles", o.poles).shaft,
  };
}
