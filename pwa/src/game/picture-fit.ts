// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// FITTING THE PICTURE TO THE MACHINE — which stop of each OPTIONS ▸ PICTURE
// row a machine should draw at to hold SIXTY FRAMES A SECOND and lose as
// little of the look as it can. DOM-free and three-free: `video-probe.ts`
// times the machine and hands this the frame; `tests/video_test.ts` holds
// the whole rule on plain Node.
//
// EVERY STOP HAS A PRICE AND A WORTH. `cost` is what the stop adds to a
// frame over the row's cheapest stop, in ms on the REFERENCE machine
// (`FIT_REFERENCE`) — measured, not guessed: `make bench ARGS="--gpu
// --costs"` prices every stop against the top picture on the pinned race,
// the frame end to end (what the probe times), each row lowered alone, from
// the race's chase camera AND a vista across the whole basin, at whichever
// is dearer — a row's price moves with the view and with the machine (on a
// laptop GPU DISTANCE was nearly free in the woods and a fifth of the frame
// from a hilltop; on a bigger one the vista's frame is the lighter of the
// two). A stop that measured cheaper than the one under it is set
// level with it: that is the noise, not a stop that pays for itself. How to
// re-price, and how a benefit is argued: the `picture-pricing` skill.
// `benefit` is what it adds to the LOOK over the cheapest stop, on one scale
// for every row (0–100, the reasoning beside each row below) — a judgment,
// and written down so it can be argued with. Together they answer the
// question a preset cannot: a stop that costs a lot and shows little goes
// first, and one that barely shows is never kept at the price of one that
// does.
//
// ONE MACHINE IS ANOTHER SCALED. Nothing on a phone can be looked up — its
// GPU reports the same string as every other — so the table is the
// reference machine's, and a device is read as that machine made faster or
// slower: its own timed frame at the picture it was drawing, over what the
// table says that picture costs, scales every figure. That is wrong in the
// details (a phone is short of pixels where a desktop is short of
// processor), which is why the probe FITS, APPLIES, TIMES AGAIN AND FITS
// AGAIN: the second reading is of the picture the first fit chose, so the
// scale it gives is the right one for the neighbourhood the answer is in.
//
// THE FIT IS EXACT. Of every picture the ladders can make, it takes the one
// of most worth whose scaled cost fits — one stop a row, a knapsack with a
// choice in each row, solved over the costs in hundredths of a millisecond
// (the grain they are priced in): ten rows of a handful of stops over a
// budget of some fifteen hundred hundredths is a few hundred thousand sums,
// once a fit. Not greedy, stop by stop: a cheap step down that stands in
// front of the dear one that matters (SHADOWS' SKIERS, as dear as MEDIUM
// and worth half) would hide it, and a greedy fit can hand a slower machine
// MORE of the look than a faster one. An exact answer is monotone by
// construction — a smaller budget only chooses from fewer pictures. A stop
// that costs nothing is always kept.

import {
  PICTURE_LADDERS,
  PICTURE_ROWS,
  type PictureRow,
  type VideoSettings,
} from "./settings-video.ts";

/** One stop of a row: ms a frame over the row's cheapest stop on the
 * reference machine, and worth to the look over the cheapest stop. */
export type StopPrice = { cost: number; benefit: number };

export type PriceList = {
  readonly [R in PictureRow]: Readonly<Record<VideoSettings[R], StopPrice>>;
};

/** THE REFERENCE MACHINE the costs were measured on: a high-end laptop
 * with the GPU on the processor, drawing through the browser's Metal
 * backend on its charger, the benchmark's pinned race, at this buffer. */
export const FIT_REFERENCE = { width: 1920, height: 1080 } as const;

/** The frame with every row at its cheapest stop on the reference machine,
 * ms: the engine, the sky, the ground at its coarsest — what no row can
 * take off. */
export const FLOOR_MS = 3.79;

/**
 * THE PRICE LIST. Benefits, row by row:
 *
 * RESOLUTION is the sharpness of EVERYTHING — the one row whose loss is on
 * every pixel; 0.8 is soft, 0.6 is blurred under crisp type, 0.5 more so.
 * DISTANCE: LOW closes the mist a few seconds ahead, which is a real loss of
 * place; MEDIUM and HIGH push it out; MAX only clears the last haze off the
 * rim mountains.
 * The sky rides it too: every stop draws the far ranges, MEDIUM a cloud
 * with some depth to it over LOW's flat shell, HIGH and MAX the clouds as
 * lit volumes and the air's sun-lit share in a ridge's shadow — a few
 * points each (+2, +4, +4), since the light on the snow is the same at
 * every stop and only the far view's detail differs.
 * TERRAIN: the ground's grid under the skis; a coarser one is a blunter
 * furrow, hard to see at speed.
 * TRAILS: the furrows are the game — OFF leaves the snow untouched behind
 * every skier, which is the heaviest loss on the list; the stops over LOW
 * are sharper and reach further. MEDIUM and HIGH also draw the snow round
 * the player as a deformable volume (`deform-snow.ts`): real trenches, a
 * fall's crater, the berm a stop throws up, self-shadowed — the biggest
 * gain on the row after the furrows themselves (+8 and +10 over the
 * trail map's own).
 * FOREST: how far the full trees run before the sketch, and how thick the
 * far woods stand.
 * SHADOWS: the trees' shadows (MEDIUM) are the woods' depth, the skiers' own
 * (SKIERS) are what sets a skier on the snow; HIGH only sharpens the
 * skiers'.
 * SPRAY: a share of the roost and the cloud; the lowest still throws some.
 * LAMPS: only after dark, and only where beams cross — his own headlamp is
 * always drawn, the floods and the field's lamps past the nearest are what
 * the lower stops give up, and LOW the snow's glitter in the beams.
 *
 * The costs are the dearer view's of `make bench ARGS="--gpu --costs"` at
 * `FIT_REFERENCE` — the race's, for every row: its top picture is 13.7 ms a
 * frame against the vista's 9.0, and no row's share of the vista's frame
 * outweighs that. What the benchmark's race does not draw is not in them:
 * the TREE WELLS (`TRAIL_LOOK`'s `wells`, MEDIUM and HIGH only) are dug only
 * in a metre of powder, where they cost a refill of the well map every 16 m
 * the lens moves (about 6 ms of the processor's, a hitch rather than a
 * rate) and a few texture reads a pixel near the lens. And the race is run
 * by day, where LAMPS has nothing to light: it is priced from the NIGHT
 * scene alone (`make bench ARGS="--gpu --costs --views night --rows
 * lamps"`), a clear sky well after sunset with every headlamp and the floods
 * on (12.5 ms a frame at the top picture).
 */
export const PICTURE_PRICES: PriceList = {
  resolution: {
    "50": { cost: 0, benefit: 0 },
    "60": { cost: 0.55, benefit: 15 },
    "70": { cost: 1.07, benefit: 38 },
    "80": { cost: 1.73, benefit: 60 },
    "90": { cost: 2.41, benefit: 75 },
    "100": { cost: 3.34, benefit: 85 },
  },
  // Carries the SKY's tiers (`SKY_TIER`, `sky-gpu.ts`), the CLOUD
  // (`CLOUD_TIER`: LOW the shell, MEDIUM the slab, HIGH and MAX the
  // raymarched volume) and the FAR RANGES' rings (`FAR_TIER`) with the mist.
  distance: {
    low: { cost: 0, benefit: 0 },
    medium: { cost: 0.29, benefit: 27 },
    high: { cost: 0.91, benefit: 39 },
    max: { cost: 1.66, benefit: 42 },
  },
  terrain: {
    low: { cost: 0, benefit: 0 },
    medium: { cost: 0.15, benefit: 8 },
    high: { cost: 0.78, benefit: 12 },
  },
  // MEDIUM and HIGH are dear for the deformable snow: its patch (80k and
  // 115k triangles, one draw call) and its self-shadow march (7 and 14
  // steps). The field's own CPU (the presses, the settling, the upload) is
  // a few tenths of a millisecond riding, more under a fall (`make
  // snow-eval ARGS=--deform-perf`).
  trails: {
    off: { cost: 0, benefit: 0 },
    low: { cost: 0.15, benefit: 50 },
    medium: { cost: 2.76, benefit: 66 },
    high: { cost: 3.64, benefit: 72 },
  },
  // Measured on a winter race. A SUMMER free ride also draws the grass the
  // row reaches (`FOREST_LOOK[...].grass`): ESTIMATED, not measured, at about
  // 0.1, 0.2 and 0.35 ms for LOW, MEDIUM and HIGH (the tufts' triangles at
  // the patch's density against the trees' own) and left out of these
  // prices until a GPU bench times a summer frame.
  forest: {
    low: { cost: 0, benefit: 0 },
    medium: { cost: 0.12, benefit: 12 },
    high: { cost: 0.3, benefit: 18 },
  },
  shadows: {
    off: { cost: 0, benefit: 0 },
    skiers: { cost: 1.59, benefit: 22 },
    medium: { cost: 1.6, benefit: 40 },
    high: { cost: 2.28, benefit: 44 },
  },
  spray: {
    low: { cost: 0, benefit: 0 },
    medium: { cost: 0.32, benefit: 8 },
    high: { cost: 0.34, benefit: 12 },
  },
  // From the night scene; by day the row reads 0.07 ms at MEDIUM and HIGH.
  lamps: {
    low: { cost: 0, benefit: 0 },
    medium: { cost: 0.29, benefit: 6 },
    high: { cost: 0.47, benefit: 10 },
  },
  // FULL's worth is the cloud, the sun and the night sky over a picture
  // that has none. Dearer by day (0.26 ms) than under the night's stars
  // and moon (0.19).
  sky: {
    plain: { cost: 0, benefit: 0 },
    full: { cost: 0.26, benefit: 14 },
  },
  // 3D's worth is ridges that stand apart as the lens moves and meet the
  // map's own ground with no seam.
  horizon: {
    painted: { cost: 0, benefit: 0 },
    "3d": { cost: 0.06, benefit: 5 },
  },
};

/** The frame the fit aims a drained frame at, ms: sixty a second, with a
 * tenth held back — the probe times a quiet stretch under a card, and a
 * race has heavier moments than the one it was timed on. */
export const FIT_BUDGET_MS = (1000 / 60) * 0.9;

const price = <R extends PictureRow>(
  prices: PriceList,
  row: R,
  stop: VideoSettings[R],
): StopPrice => (prices[row] as Record<string, StopPrice>)[stop as string];

/** What a picture costs on the reference machine, ms a frame. */
export function pictureCost(video: VideoSettings, prices: PriceList = PICTURE_PRICES): number {
  let ms = FLOOR_MS;
  for (const row of PICTURE_ROWS) ms += price(prices, row, video[row]).cost;
  return ms;
}

/** What a picture is worth to the look, 0 at every cheapest stop. */
export function pictureWorth(video: VideoSettings, prices: PriceList = PICTURE_PRICES): number {
  let worth = 0;
  for (const row of PICTURE_ROWS) worth += price(prices, row, video[row]).benefit;
  return worth;
}

/** Costs on the fit's grain, hundredths of a millisecond, rounded UP so a
 * picture the fit calls inside the budget is inside it. */
const grain = (ms: number): number => Math.max(0, Math.ceil(ms * 100 - 1e-6));

/**
 * THE FIT: the picture this machine should draw, given that it drew `at`
 * in `measuredMs` (a drained frame). The machine is read as the reference
 * scaled by `measuredMs / pictureCost(at)`; the answer is the picture of
 * most worth whose scaled cost fits `budgetMs` — and where none does, the
 * cheapest there is, every stop that costs nothing kept. A tie in worth
 * goes to the cheaper picture. `at`'s ANTIALIAS is kept: the canvas owns it.
 */
export function fitPicture(
  at: VideoSettings,
  measuredMs: number,
  budgetMs: number = FIT_BUDGET_MS,
  prices: PriceList = PICTURE_PRICES,
): VideoSettings {
  if (!(measuredMs > 0)) return at;
  const scale = measuredMs / pictureCost(at, prices);
  const rows = PICTURE_ROWS.map((row) => {
    const ladder = PICTURE_LADDERS[row] as readonly string[];
    const stops = prices[row] as Record<string, StopPrice>;
    return {
      row,
      ladder,
      cost: ladder.map((stop) => grain(stops[stop].cost)),
      worth: ladder.map((stop) => stops[stop].benefit),
    };
  });
  const most = rows.reduce((sum, r) => sum + Math.max(...r.cost), 0);
  // The budget past the floor, rounded DOWN onto the grain as the costs are
  // rounded up; under the floor, nothing but the stops that cost nothing.
  const room = Math.min(most, Math.max(0, Math.floor((budgetMs / scale - FLOOR_MS) * 100 + 1e-6)));
  // best[c]: the most worth the rows so far can buy for at most c; pick[r][c]
  // the stop row r took for it.
  let best = new Array<number>(room + 1).fill(0);
  const pick: Uint8Array[] = [];
  for (const r of rows) {
    const next = new Array<number>(room + 1).fill(-Infinity);
    const took = new Uint8Array(room + 1);
    for (let c = 0; c <= room; c++) {
      for (let s = 0; s < r.ladder.length; s++) {
        if (r.cost[s] > c) continue;
        const w = best[c - r.cost[s]] + r.worth[s];
        if (w > next[c]) {
          next[c] = w;
          took[c] = s;
        }
      }
    }
    best = next;
    pick.push(took);
  }
  // The cheapest budget that buys the most worth, so a tie keeps headroom.
  let c = room;
  while (c > 0 && best[c - 1] === best[room]) c--;
  const video = { ...at } as Record<string, unknown>;
  for (let i = rows.length - 1; i >= 0; i--) {
    const s = pick[i][c];
    video[rows[i].row] = rows[i].ladder[s];
    c -= rows[i].cost[s];
  }
  return video as VideoSettings;
}

/** Whether two pictures draw alike: every fitted row at the same stop. */
export function samePicture(a: VideoSettings, b: VideoSettings): boolean {
  return PICTURE_ROWS.every((row) => a[row] === b[row]);
}
