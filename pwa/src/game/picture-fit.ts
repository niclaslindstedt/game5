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
// is dearer — DISTANCE is nearly free in the woods and a fifth of the frame
// from a hilltop. A stop that measured cheaper than the one under it is set
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
// THE FIT IS GREEDY, BOTH WAYS. Over budget, it takes the step down that
// loses the least worth for each millisecond it saves, and again, until the
// estimate fits. With room to spare, it takes the step up that buys the most
// worth for each millisecond it costs, as long as the estimate still fits.
// A step that costs nothing measurable is always taken up and never down.

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

/** THE REFERENCE MACHINE the costs were measured on: an integrated
 * laptop-class GPU, the benchmark's pinned race, at this buffer. */
export const FIT_REFERENCE = { width: 1920, height: 1080 } as const;

/** The frame with every row at its cheapest stop on the reference machine,
 * ms: the engine, the sky, the ground at its coarsest — what no row can
 * take off. */
export const FLOOR_MS = 1.92;

/**
 * THE PRICE LIST. Benefits, row by row:
 *
 * RESOLUTION is the sharpness of EVERYTHING — the one row whose loss is on
 * every pixel; 0.8 is soft, 0.6 is blurred under crisp type.
 * DISTANCE: LOW closes the mist a few seconds ahead, which is a real loss of
 * place; MEDIUM and HIGH push it out; MAX only clears the last haze off the
 * rim mountains.
 * TERRAIN: the ground's grid under the skis; a coarser one is a blunter
 * furrow, hard to see at speed.
 * TRAILS: the furrows are the game — OFF leaves the snow untouched behind
 * every skier, which is the heaviest loss on the list; the stops over LOW
 * are sharper and reach further.
 * FOREST: how far the full trees run before the sketch, and how thick the
 * far woods stand.
 * SHADOWS: the trees' shadows (MEDIUM) are the woods' depth, the skiers' own
 * (SKIERS) are what sets a skier on the snow; HIGH only sharpens the
 * skiers'.
 * SPRAY: a share of the roost and the cloud; the lowest still throws some.
 */
export const PICTURE_PRICES: PriceList = {
  resolution: {
    low: { cost: 0, benefit: 0 },
    medium: { cost: 0.63, benefit: 45 },
    high: { cost: 1.43, benefit: 70 },
  },
  distance: {
    low: { cost: 0, benefit: 0 },
    medium: { cost: 0.38, benefit: 25 },
    high: { cost: 0.76, benefit: 35 },
    max: { cost: 1.0, benefit: 38 },
  },
  terrain: {
    low: { cost: 0, benefit: 0 },
    medium: { cost: 0.56, benefit: 8 },
    high: { cost: 0.76, benefit: 12 },
  },
  trails: {
    off: { cost: 0, benefit: 0 },
    low: { cost: 0.36, benefit: 50 },
    medium: { cost: 0.36, benefit: 58 },
    high: { cost: 0.36, benefit: 62 },
  },
  forest: {
    low: { cost: 0, benefit: 0 },
    medium: { cost: 0.15, benefit: 12 },
    high: { cost: 0.32, benefit: 18 },
  },
  shadows: {
    off: { cost: 0, benefit: 0 },
    skiers: { cost: 0.55, benefit: 22 },
    medium: { cost: 0.74, benefit: 40 },
    high: { cost: 1.98, benefit: 44 },
  },
  spray: {
    low: { cost: 0, benefit: 0 },
    medium: { cost: 0.06, benefit: 8 },
    high: { cost: 0.15, benefit: 12 },
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

/** One stop along a row from where the picture stands: its cost and worth
 * over the stop it leaves (both negative going down). */
type Step = { row: PictureRow; stop: string; cost: number; worth: number };

function steps(video: VideoSettings, dir: 1 | -1, prices: PriceList): Step[] {
  const out: Step[] = [];
  for (const row of PICTURE_ROWS) {
    const ladder = PICTURE_LADDERS[row] as readonly string[];
    const at = ladder.indexOf(video[row] as string);
    const stops = prices[row] as Record<string, StopPrice>;
    const from = price(prices, row, video[row]);
    let to = at + dir;
    // Down, past any stop that costs no less: a step that saves nothing is
    // never taken, and must not stand between the fit and one that does.
    while (dir < 0 && to > 0 && stops[ladder[to]].cost >= from.cost) to--;
    if (at < 0 || to < 0 || to >= ladder.length) continue;
    const next = stops[ladder[to]];
    out.push({
      row,
      stop: ladder[to],
      cost: next.cost - from.cost,
      worth: next.benefit - from.benefit,
    });
  }
  return out;
}

const take = (video: VideoSettings, step: Step): VideoSettings => ({
  ...video,
  [step.row]: step.stop,
});

/**
 * THE FIT: the picture this machine should draw, given that it drew `at`
 * in `measuredMs` (a drained frame). The machine is read as the reference
 * scaled by `measuredMs / pictureCost(at)`; the answer is the picture of
 * most worth whose scaled cost fits `budgetMs`, found greedily — down by the
 * least worth lost a millisecond saved, then up by the most worth gained a
 * millisecond spent. `at`'s ANTIALIAS is kept: the canvas owns it.
 */
export function fitPicture(
  at: VideoSettings,
  measuredMs: number,
  budgetMs: number = FIT_BUDGET_MS,
  prices: PriceList = PICTURE_PRICES,
): VideoSettings {
  if (!(measuredMs > 0)) return at;
  const scale = measuredMs / pictureCost(at, prices);
  const fits = (v: VideoSettings): boolean => pictureCost(v, prices) * scale <= budgetMs;
  let video = at;
  while (!fits(video)) {
    const down = steps(video, -1, prices).filter((s) => s.cost < 0);
    if (down.length === 0) break;
    // Least worth lost per ms saved (both negative, so the ratio is positive).
    down.sort((a, b) => a.worth / a.cost - b.worth / b.cost);
    video = take(video, down[0]);
  }
  for (;;) {
    const up = steps(video, 1, prices).filter((s) => s.worth > 0 && fits(take(video, s)));
    if (up.length === 0) break;
    const value = (s: Step): number => (s.cost > 0 ? s.worth / s.cost : Infinity);
    up.sort((a, b) => value(b) - value(a));
    video = take(video, up[0]);
  }
  return video;
}

/** Whether two pictures draw alike: every fitted row at the same stop. */
export function samePicture(a: VideoSettings, b: VideoSettings): boolean {
  return PICTURE_ROWS.every((row) => a[row] === b[row]);
}
