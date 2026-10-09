// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOGS ON THE VILLAGE'S SIDEWALKS — the numbers the people walking
// their dogs (`dog-walk.ts`) are dealt and the dogs themselves are built
// (`dog-shapes.ts`) and moved (`dog-pose.ts`) by: a handful of common
// kinds of dog by their measures and coats, the dog's gaits, and the walk
// — how long, how often a dog stops to sniff, lifts a leg, squats, how
// long a lead is and how many owners bag what their dog leaves. Every
// number is the research `docs/civilians.md` ("Dogs on the sidewalks")
// restates; three-free and DOM-free, so the suite reads it.

/** A kind of dog, by its type — never a registered breed. */
export type DogKind = "retriever" | "husky" | "shepherd" | "terrier" | "dachshund";

export const DOG_KINDS: readonly DogKind[] = [
  "retriever",
  "husky",
  "shepherd",
  "terrier",
  "dachshund",
];

/** How a dog's ears are carried: pricked up, or dropped down by its
 * cheeks (a retriever's, a long-eared dachshund's). */
export type Ears = "erect" | "drop";

/** A coat: the main colour, the under colour (belly, chest, the lower
 * legs), the back (a shepherd's saddle; the main colour where the dog has
 * none) and the muzzle's (a shepherd's black mask, a husky's white face,
 * the tan points of a black-and-tan). The nose and the eyes are black on
 * every dog. sRGB. */
export type Coat = {
  readonly main: number;
  readonly under: number;
  readonly back: number;
  readonly mask: number;
};

/** A KIND OF DOG: its measures (m, kg), how it is shaped past them and the
 * coats it comes in.
 *   * `height` the shoulder (withers) over the ground; `length` the body
 *     from the point of the chest to the buttock; `leg` the share of the
 *     height that is leg below the chest (a dachshund is a third, a husky
 *     over half); `chest` the chest's depth as a share of the height and
 *     `width` the body's width as a share of it;
 *   * `head` the head's length (occiput to the nose) and `muzzle` the
 *     share of it in front of the eyes; `neck` its length and `carriage`
 *     how high it holds the head (0 level, 1 straight up);
 *   * `ears` and their length as a share of the head; `tail` its length,
 *     `carried` its angle at rest (rad: 0 straight out behind, negative
 *     down, positive up — a husky's curls over its back), `bush` its
 *     thickness at the root as a share of the height;
 *   * `coat` the share the coats are dealt at, and `dressed` the share of
 *     them out in a dog coat in the cold. */
export type DogSpec = {
  readonly kind: DogKind;
  readonly height: number;
  readonly length: number;
  readonly mass: number;
  readonly leg: number;
  readonly chest: number;
  readonly width: number;
  readonly head: number;
  readonly muzzle: number;
  readonly neck: number;
  readonly carriage: number;
  readonly ears: Ears;
  readonly ear: number;
  readonly tail: number;
  readonly carried: number;
  readonly curl: number;
  readonly bush: number;
  readonly coats: readonly Coat[];
  readonly dressed: number;
};

/**
 * THE KINDS, off their measured standards (the middle of each band):
 *   * a RETRIEVER — 55–61 cm at the shoulder, 25–36 kg, the body a little
 *     longer than tall, a broad head with dropped ears, an otter tail
 *     carried level or a little down; golden, yellow, black or brown;
 *   * a HUSKY-TYPE SLED DOG — 51–60 cm, 16–27 kg, lighter built, pricked
 *     triangular ears, a bushy tail carried in a sickle over the back; grey,
 *     black or red over a white underside and a white face;
 *   * a SHEPHERD — 55–65 cm, 22–40 kg, longer than tall (about 10:8.5),
 *     big pricked ears, a bushy tail hanging low in a curve; tan with a
 *     black saddle, all black, or sable;
 *   * a SMALL TERRIER — 25–30 cm, 6–9 kg, square-built, small pricked ears,
 *     a short tail carried straight up; white, wheaten, black and tan;
 *   * a DACHSHUND-TYPE — 20–23 cm at the shoulder on legs a third of that,
 *     a body twice as long as tall, 9–12 kg, long dropped ears and a tail
 *     carried low; red, or black with tan points.
 * The small, short-coated ones are the ones most often out in a coat.
 */
export const DOG_SPECS: Readonly<Record<DogKind, DogSpec>> = {
  retriever: {
    kind: "retriever",
    height: 0.57,
    length: 0.62,
    mass: 30,
    leg: 0.5,
    chest: 0.46,
    width: 0.42,
    head: 0.25,
    muzzle: 0.44,
    neck: 0.2,
    carriage: 0.45,
    ears: "drop",
    ear: 0.42,
    tail: 0.42,
    carried: -0.55,
    curl: 0.15,
    bush: 0.11,
    coats: [
      { main: 0xc8913f, under: 0xe0bd85, back: 0xb98234, mask: 0xd2a05a },
      { main: 0xe2c78f, under: 0xf0dfba, back: 0xd8bb80, mask: 0xe8d3a4 },
      { main: 0x1e1b1a, under: 0x262220, back: 0x181615, mask: 0x1e1b1a },
      { main: 0x5a3824, under: 0x6a4430, back: 0x4e301f, mask: 0x5a3824 },
    ],
    dressed: 0.12,
  },
  husky: {
    kind: "husky",
    height: 0.55,
    length: 0.6,
    mass: 22,
    leg: 0.56,
    chest: 0.42,
    width: 0.36,
    head: 0.23,
    muzzle: 0.42,
    neck: 0.19,
    carriage: 0.5,
    ears: "erect",
    ear: 0.4,
    tail: 0.36,
    carried: 0.95,
    curl: 1.0,
    bush: 0.13,
    coats: [
      { main: 0x77736f, under: 0xf1efea, back: 0x4f4b48, mask: 0xf1efea },
      { main: 0x2a2826, under: 0xf0eee8, back: 0x1d1b1a, mask: 0xf0eee8 },
      { main: 0x9a5a34, under: 0xf2ece2, back: 0x84492a, mask: 0xf2ece2 },
    ],
    dressed: 0.03,
  },
  shepherd: {
    kind: "shepherd",
    height: 0.62,
    length: 0.72,
    mass: 32,
    leg: 0.52,
    chest: 0.46,
    width: 0.38,
    head: 0.26,
    muzzle: 0.48,
    neck: 0.22,
    carriage: 0.55,
    ears: "erect",
    ear: 0.48,
    tail: 0.5,
    carried: -0.95,
    curl: 0.35,
    bush: 0.12,
    coats: [
      { main: 0xb07a3e, under: 0xc9965a, back: 0x1d1917, mask: 0x1d1917 },
      { main: 0x1f1c1a, under: 0x2a2522, back: 0x181513, mask: 0x121110 },
      { main: 0x8a6a48, under: 0xa88a62, back: 0x4a3a2c, mask: 0x2e241c },
    ],
    dressed: 0.05,
  },
  terrier: {
    kind: "terrier",
    height: 0.28,
    length: 0.3,
    mass: 8,
    leg: 0.52,
    chest: 0.46,
    width: 0.44,
    head: 0.15,
    muzzle: 0.4,
    neck: 0.1,
    carriage: 0.6,
    ears: "erect",
    ear: 0.34,
    tail: 0.12,
    carried: 1.25,
    curl: 0,
    bush: 0.1,
    coats: [
      { main: 0xece6da, under: 0xf4efe6, back: 0xe2dbcd, mask: 0xece6da },
      { main: 0xcfae78, under: 0xdcc296, back: 0xc29f68, mask: 0xcfae78 },
      { main: 0x24201e, under: 0xa8783e, back: 0x1c1917, mask: 0xa8783e },
    ],
    dressed: 0.5,
  },
  dachshund: {
    kind: "dachshund",
    height: 0.22,
    length: 0.46,
    mass: 10,
    leg: 0.36,
    chest: 0.62,
    width: 0.52,
    head: 0.2,
    muzzle: 0.5,
    neck: 0.11,
    carriage: 0.5,
    ears: "drop",
    ear: 0.55,
    tail: 0.24,
    carried: -0.35,
    curl: 0.1,
    bush: 0.11,
    coats: [
      { main: 0x8e4a24, under: 0x9c5630, back: 0x7e3f1c, mask: 0x8e4a24 },
      { main: 0x1e1814, under: 0xa66a38, back: 0x17120f, mask: 0xa66a38 },
      { main: 0x6a3f24, under: 0x7d4c2c, back: 0x5a331c, mask: 0x6a3f24 },
    ],
    dressed: 0.6,
  },
};

/** How often each kind is out on a walk (shares that need not sum to 1):
 * the big family dogs most, the small ones next. */
export const DOG_SHARE: Readonly<Record<DogKind, number>> = {
  retriever: 0.28,
  husky: 0.16,
  shepherd: 0.18,
  terrier: 0.22,
  dachshund: 0.16,
};

/** The colours a dog coat comes in, and a collar. sRGB. */
export const DOG_COATS: readonly number[] = [
  0xb3262a, 0x1f3a66, 0x2f6a3a, 0xd06a8e, 0xd9c021, 0x5d6168, 0xe0782a,
];
export const DOG_COLLARS: readonly number[] = [0xc0242a, 0x2a54b0, 0x141414, 0xe0702a, 0x2f8a46];

/**
 * HOW A DOG GOES:
 *   * the WALK is a four-beat gait in lateral sequence (a hind foot, then
 *     the fore on the same side, then the other hind, the other fore), up
 *     to three feet on the ground; the TROT a two-beat diagonal gait, a
 *     fore and the opposite hind together. A dog changes from one to the
 *     other at about the same Froude number whatever its size (v² over g
 *     times its height, `trotAt`) — so a big dog walks at its owner's
 *     pace and a small one trots beside him;
 *   * a stride (one cycle of all four feet) is about 1.4 times the height
 *     at a walk (a 29 kg dog: 0.79 m at 1.3–1.5 m/s) and 1.6 times it at a
 *     trot (0.9–1.0 m at 1.2–2.3 m/s, a 30 kg dog);
 *   * catching its owner up after a stop it trots at `catchUp` m/s more
 *     than he walks.
 */
export const DOG_GAIT = {
  trotAt: 0.5,
  walkStride: 1.4,
  trotStride: 1.65,
  catchUp: 0.9,
  /** A tail wagged: beats a second, and how far each way at a walk, rad. */
  wag: { rate: 2.6, swing: 0.32 },
} as const;

/**
 * THE WALK, s and m unless said:
 *   * `households` how many homes in the village have a dog on a walk
 *     list; `pair` the share out with two dogs, `family` with a child
 *     alongside;
 *   * a walk is `length` m of the village's sidewalks at the owner's
 *     `pace` (a dog walker's 1.0–1.35 m/s, a family's slower), home for
 *     `home` s between walks;
 *   * the LEAD is `lead` m (1.2–1.8: a standard lead), the dog `ahead` of
 *     the hand along the walk, the two dogs of a pair either side;
 *   * a dog STOPS to SNIFF every `sniffEvery` m for `sniff` s; LIFTS A LEG
 *     (a male, most grown males) or squats (a female) to mark `marks`
 *     times a walk, at a lamp post or the snowbank, `mark` s; SQUATS TO
 *     POOP once a walk (`poop` the chance; `twice` the chance of another
 *     later), `squat` s — the hind legs bent and spread, the back hunched
 *     and the tail up — circling and sniffing first (`circle` s);
 *   * at a CROSSING the owner stops at the kerb a while (`kerb` s) and
 *     till no car is on it or coming at it within `headway` s, the dog
 *     sat beside him (`sit` the chance);
 *   * a CHAT now and then, stood (`chat` the chance a walk, `chatFor` s);
 *   * `pickUp` the share of piles bagged by day — observed rates run from
 *     a half to two in three, fewer in the dark (`pickUpNight`); set well
 *     under them on purpose, so most piles stay on the sidewalk to be seen;
 *     the bend and the bag `stoop` s;
 *   * what is left lies on the sidewalk: the `kept` latest piles are drawn
 *     (and as many yellow patches where a dog marked), each pile steaming
 *     in the cold its first `steam` s.
 */
export const DOG_WALK = {
  households: 26,
  pair: 0.22,
  family: 0.16,
  length: [320, 720] as const,
  pace: [1.0, 1.35] as const,
  familyPace: [0.9, 1.05] as const,
  home: [60, 260] as const,
  lead: [1.2, 1.8] as const,
  ahead: [0.5, 1.1] as const,
  sniffEvery: [18, 55] as const,
  sniff: [2.5, 8] as const,
  marks: [1, 4] as const,
  mark: [3.5, 7] as const,
  poop: 0.88,
  twice: 0.12,
  circle: [2, 5] as const,
  squat: [8, 18] as const,
  kerb: [1.5, 4] as const,
  headway: 2.5,
  sit: 0.65,
  chat: 0.3,
  chatFor: [12, 35] as const,
  pickUp: 0.3,
  pickUpNight: 0.12,
  stoop: 4.5,
  kept: 160,
  steam: 60,
} as const;

/** The share of the dog walkers out at each hour (the civilians' `Hours`):
 * the morning walk before work and the evening one the busiest, a midday
 * round, the late walk before bed and next to nobody in the small hours. */
export const DOG_HOURS: readonly (readonly [number, number])[] = [
  [0, 0.04],
  [5.5, 0.08],
  [6.5, 0.5],
  [7.5, 0.95],
  [9, 0.6],
  [11, 0.4],
  [12.5, 0.65],
  [14, 0.4],
  [16, 0.5],
  [17.5, 0.95],
  [19.5, 0.8],
  [21, 0.6],
  [22.5, 0.45],
  [23.5, 0.12],
  [24, 0.04],
];
