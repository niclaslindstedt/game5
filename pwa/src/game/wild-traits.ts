// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHO EACH ANIMAL IS — the individual inside the species: which FORM it is
// drawn in (a bull or a calf, a cock or a hen, a first-winter eagle), how
// old it is, how big, the shade of its coat, and how far its antlers or
// horns have grown. Three-free and DOM-free, so `tests/wildlife_shapes_test.ts`
// holds it without a renderer; `birds.ts` and `beasts.ts` draw what it says,
// and `bird-shapes.ts` / `beast-shapes.ts` build one geometry a FORM.
//
// DEALT OFF THE PLAN, NEVER THE ENGINE. Every number here is a HASH of the
// group's own `scatter` (drawn once, by the plan's own generator off the
// map's seed — `bird-roost.ts`, `beast-plan.ts`) and the member's index, so
// an individual is the same animal every time the map is skied, a replay
// draws the herd it recorded, and no digest the suite holds can see a
// single calf. Nothing here is drawn from `state.rng`.
//
// A SPECIES IS ONE SILHOUETTE AND A HANDFUL OF FORMS, the way generated
// creatures are usually varied: one template a kind, with the parts SCALED
// per individual (its size, its rack) rather than a new mesh each, and only
// what cannot be scaled — a calf's round build and short muzzle, a hen's
// brown plumage, a young eagle's white wing patches — a form of its own.
// So the ANTLERS are in every adult's mesh and grown in the vertex shader:
// a cow's or a hind's rack is 0 and folds away, a yearling's is a spike (the
// tines are tagged by the age they first appear at, the way a stag's points
// come with the years), an old bull's is the whole crown — and a herd of
// eight costs the one mesh.
//
// THE FORMS ARE LISTED MOST TELLING FIRST, because a cheap picture draws
// fewer of them (`FOREST_LOOK[row].wild`): an individual whose form is not
// drawn is drawn in the first, still at its own size, shade and rack. Every
// species is drawn at every picture setting; only its forms thin.

import { hash2 } from "@engine";

import type { BeastId } from "./beast-defs.ts";
import type { BirdId } from "./bird-defs.ts";

/** The forms a bird is drawn in: the cock, the hen, a first-winter bird. */
export type BirdForm = "male" | "female" | "young";
/** The forms an animal is drawn in: grown, or a calf, kid or cub. */
export type BeastForm = "adult" | "young";

/** Every bird's forms, the most telling first. A species whose hen is the
 * cock's colour has no hen form (it is drawn smaller, off `BIRD_SEXES`); a
 * first-winter bird has a form only where it shows from below. */
export const BIRD_FORMS: Readonly<Record<BirdId, readonly BirdForm[]>> = {
  raven: ["male"],
  ptarmigan: ["male"],
  blackgrouse: ["male", "female"],
  capercaillie: ["male", "female"],
  crossbill: ["male", "female"],
  bunting: ["male", "female"],
  woodpecker: ["male", "female"],
  owl: ["male"],
  eagle: ["male", "young"],
  swan: ["male", "young"],
  goose: ["male"],
  chough: ["male"],
  nutcracker: ["male"],
  jay: ["male"],
};

/** Every animal's forms. A solitary animal is never met as a youngster. */
export const BEAST_FORMS: Readonly<Record<BeastId, readonly BeastForm[]>> = {
  hare: ["adult"],
  squirrel: ["adult"],
  fox: ["adult"],
  arcticfox: ["adult"],
  roedeer: ["adult", "young"],
  reindeer: ["adult", "young"],
  chamois: ["adult", "young"],
  moose: ["adult", "young"],
  wolverine: ["adult"],
  lynx: ["adult"],
  wolf: ["adult", "young"],
  ibex: ["adult", "young"],
  elk: ["adult", "young"],
  coyote: ["adult"],
  sika: ["adult", "young"],
};

/** How a bird's sexes differ in SIZE: the hen's length over the cock's. A
 * capercaillie hen is two thirds of the cock, an eagle's hen the bigger. */
const BIRD_SEXES: Partial<Record<BirdId, number>> = {
  capercaillie: 0.72,
  blackgrouse: 0.82,
  eagle: 1.1,
  owl: 1.06,
  swan: 0.92,
  goose: 0.94,
};

/** What a rack is, a species at a time: who carries one (`bulls`, or both
 * sexes), how big a cow's is beside a bull's, and how much of a bull's it
 * is at the youngest and oldest. Horns grow all the life long; antlers are
 * cast and grown again bigger each autumn, the tines coming with the years. */
type Rack = { readonly both: boolean; readonly female: number; readonly young: number };
const RACKS: Partial<Record<BeastId, Rack>> = {
  roedeer: { both: false, female: 0, young: 0 },
  sika: { both: false, female: 0, young: 0 },
  elk: { both: false, female: 0, young: 0 },
  moose: { both: false, female: 0, young: 0 },
  // A reindeer cow keeps her antlers all winter, and a calf has spikes.
  reindeer: { both: true, female: 0.62, young: 0.22 },
  // Horns: a nanny's are near a billy's on the chamois, a short pair on the
  // ibex; a kid's are buds.
  chamois: { both: true, female: 0.85, young: 0.3 },
  ibex: { both: true, female: 0.4, young: 0.18 },
};

/** How much bigger a grown male is than a grown female, as a share either
 * side of the species' row. */
const BEAST_SEXES: Partial<Record<BeastId, number>> = {
  moose: 0.09,
  elk: 0.09,
  ibex: 0.1,
  reindeer: 0.06,
  roedeer: 0.03,
  sika: 0.05,
  chamois: 0.03,
  wolf: 0.05,
};

/** A youngster's share of a group (never its leader, member 0), by
 * species; a species left out has none. */
const YOUNG_SHARE: Partial<Record<BeastId, number>> = {
  roedeer: 0.3,
  reindeer: 0.28,
  chamois: 0.3,
  moose: 0.45,
  wolf: 0.2,
  ibex: 0.25,
  elk: 0.3,
  sika: 0.3,
};

/** Coats lighter than the snow keep to a narrow band of shades — a white
 * hare is never a grey one. */
const WHITE_COATS = new Set<string>(["hare", "arcticfox", "ptarmigan", "swan"]);

/** One individual, written into the caller's object: its form (an index
 * into the species' forms), its size over the row's, its shade (a
 * multiplier a colour channel), how old it is (0 the youngest grown, 1 an
 * old one) and its rack (0 none — 1 a full-grown old bull's). */
export type Individual = {
  form: number;
  male: boolean;
  scale: number;
  age: number;
  rack: number;
  shade: [number, number, number];
};

export function freshIndividual(): Individual {
  return { form: 0, male: true, scale: 1, age: 0.5, rack: 0, shade: [1, 1, 1] };
}

/** The hash channels the traits are read off; clear of every channel the
 * plans' own poses read (`bird-plan.ts`, `beast-plan.ts`). */
const CH = { sex: 101, age: 102, young: 103, size: 104, light: 105, warm: 106 };

function shadeOf(id: string, scatter: number, i: number, out: [number, number, number]): void {
  const white = WHITE_COATS.has(id);
  const light = (white ? 0.97 : 0.88) + hash2(i, CH.light, scatter) * (white ? 0.05 : 0.22);
  const warm = (hash2(i, CH.warm, scatter) - 0.5) * (white ? 0.01 : 0.08);
  out[0] = light * (1 + warm);
  out[1] = light;
  out[2] = light * (1 - warm);
}

/** WHO BIRD `i` OF A FLOCK (or a crossing) IS, off its `scatter`. */
export function birdIndividual(
  id: BirdId,
  scatter: number,
  i: number,
  out: Individual,
): Individual {
  const forms = BIRD_FORMS[id];
  const male = hash2(i, CH.sex, scatter) < 0.5;
  const young = forms.includes("young") && i > 0 && hash2(i, CH.young, scatter) < 0.3;
  out.male = male;
  out.age = young ? 0 : hash2(i, CH.age, scatter);
  out.form = young
    ? forms.indexOf("young")
    : !male && forms.includes("female")
      ? forms.indexOf("female")
      : 0;
  const sex = male ? 1 : (BIRD_SEXES[id] ?? 0.96);
  out.scale = sex * (0.94 + hash2(i, CH.size, scatter) * 0.12) * (young ? 0.95 : 1);
  out.rack = 0;
  shadeOf(id, scatter, i, out.shade);
  return out;
}

/** WHO ANIMAL `i` OF A GROUP IS, off its `scatter` and the group's size: a
 * lone animal and a group's leader are grown, and a share of the rest are
 * the year's young. */
export function beastIndividual(
  id: BeastId,
  scatter: number,
  i: number,
  count: number,
  out: Individual,
): Individual {
  const forms = BEAST_FORMS[id];
  const young =
    count > 1 &&
    i > 0 &&
    forms.includes("young") &&
    hash2(i, CH.young, scatter) < (YOUNG_SHARE[id] ?? 0);
  const male = hash2(i, CH.sex, scatter) < 0.5;
  const age = young ? 0 : hash2(i, CH.age, scatter);
  out.male = male;
  out.age = age;
  out.form = young ? forms.indexOf("young") : 0;
  const dimorph = BEAST_SEXES[id] ?? 0.02;
  const grown = (male ? 1 + dimorph : 1 - dimorph) * (0.93 + 0.1 * age);
  out.scale = young
    ? 0.56 + hash2(i, CH.size, scatter) * 0.14
    : grown * (0.97 + hash2(i, CH.size, scatter) * 0.06);
  out.rack = rackOf(id, male, young, age);
  shadeOf(id, scatter, i, out.shade);
  return out;
}

/** HOW FAR AN ANIMAL'S RACK HAS GROWN, 0..1 of an old male's: a yearling
 * male's a spike, an old bull's the whole crown, a cow's what her species
 * gives her, a youngster's buds. */
export function rackOf(id: BeastId, male: boolean, young: boolean, age: number): number {
  const rack = RACKS[id];
  if (!rack) return 0;
  if (young) return rack.young;
  if (male) return 0.36 + 0.64 * age;
  return rack.both ? rack.female * (0.6 + 0.4 * age) : 0;
}

/** WHICH FORM AN INDIVIDUAL IS DRAWN IN when only the first `drawn` of its
 * species' forms are: its own if drawn, else the most telling. */
export function drawnForm(form: number, drawn: number): number {
  return form < drawn ? form : 0;
}

/** The ages at which an antler's tines come, as a share of a full rack: a
 * yearling carries the beam alone, the brow tine comes next, and an old
 * bull carries the crown. `beast-shapes.ts` tags each tine with its rung. */
export const TINE_AT = [0, 0.42, 0.58, 0.72, 0.86] as const;
