// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LOW CLOUD DECK — a sea of cloud lying part way down the mountain,
// three-free and engine-free, so the suite holds it
// (`tests/low_deck_test.ts`); the field deals it (`cloud-field.ts`) and
// the look reads the eye's height against it (`sky.ts`).
//
// Winter air over snow cools from the ground up: on a still day the cold
// pools in the valleys under warmer air, and a stratus deck forms against
// the lid of that INVERSION — its top flat and sharp where the warm air
// begins, a few hundred metres of grey cloud under it, often only the
// valley's. Over it the air is dry and clear and the sun out; from a summit
// the deck is a white sea with the high ground standing out of it as
// islands. Skiing down through it the view closes to tens of metres
// inside (a cloud's droplets are dense: a few tens of metres of them hide
// a tree), the light goes flat and dim, and under the base the valley lies
// under a grey ceiling. A valley fog is the same deck lying on the floor.
//
// WHICH DAYS: the valley fog always (its top `seaTopOf`, its base the
// floor); an overcast about half the days — its stratocumulus deck brought
// down under the summit, the grey altostratus over it gone with the dry
// air; a fair day now and then, a deck under its heaps. Its top stands
// between a third and three quarters of the way up the mountain, its depth
// a stratus deck's few hundred metres, its base dropped to the floor when
// it would leave less than the least air under it.

/** The numbers. */
export const LOW_DECK = {
  /** The share of days of each weather that deal a deck. */
  odds: { overcast: 0.5, fair: 0.3 } as Record<string, number>,
  /** Its top, shares of the mountain's vertical over the floor. */
  top: [0.32, 0.75] as [number, number],
  /** Its depth, m. */
  depth: [220, 420] as [number, number],
  /** Under this much air under its base the deck lies on the floor, m. */
  least: 60,
  /** How thick it is inside, the fog's own 0..1 (R19's scale). */
  fog: 0.85,
  /** Its cover: a sea with a hole here and there. */
  cover: 0.97,
  /** How many metres the eye's passage across its top or its base is
   * eased over, either side. */
  ease: 40,
} as const;

/** A deck over one map: its base and top, m over the valley floor; the
 * fog inside it. */
export type LowDeck = { base: number; top: number; fog: number };

/** THE DECK a weather of `kind` deals over a mountain of `vertical` m —
 * `u(k)` the field's hash of the map's seed and a salt, 0..1 — or null.
 * A valley fog's is `fogTop` m deep, from the floor. */
export function dealLowDeck(
  kind: string,
  u: (k: number) => number,
  vertical: number,
  fogTop: number,
): LowDeck | null {
  if (kind === "fog") return { base: 0, top: fogTop, fog: 0 };
  const odds = LOW_DECK.odds[kind] ?? 0;
  if (!(u(0) < odds) || vertical <= 0) return null;
  const top = vertical * (LOW_DECK.top[0] + (LOW_DECK.top[1] - LOW_DECK.top[0]) * u(1));
  const depth = LOW_DECK.depth[0] + (LOW_DECK.depth[1] - LOW_DECK.depth[0]) * u(2);
  const base = top - depth < LOW_DECK.least ? 0 : top - depth;
  return { base, top, fog: LOW_DECK.fog };
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Where an eye `h` m over the floor stands against `deck`: how far over
 * its base (0 under it, 1 inside, eased across the base) and how far over
 * its top (0 inside or under, 1 over it). A deck on the floor has no
 * under. */
export function deckZone(deck: LowDeck, h: number): { inside: number; over: number } {
  const e = LOW_DECK.ease;
  const inside = deck.base <= 0 ? 1 : smooth(deck.base - e, deck.base + e, h);
  return { inside, over: smooth(deck.top - e, deck.top + e, h) };
}
