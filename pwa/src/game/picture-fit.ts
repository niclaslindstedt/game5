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

/** THE REFERENCE MACHINE the costs were measured on: a high-end laptop
 * with the GPU on the processor, drawing through the browser's Metal
 * backend on its charger, the benchmark's pinned race, at this buffer. */
export const FIT_REFERENCE = { width: 1920, height: 1080 } as const;

/** The frame with every row at its cheapest stop on the reference machine,
 * ms: the engine, the sky, the ground at its coarsest — what no row can
 * take off. */
export const FLOOR_MS = 3.81;

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
 *   Its grains are flown on the GPU at every stop now (`SPRAY_GPU`): the
 *   CPU's spray time fell by a third to two thirds and its upload by seven
 *   eighths under the snow lab's software GPU, while the vertex stage flies
 *   a ring half as large again as the pool. The prices below were measured
 *   with the old counted spray on the CPU's flight, which drew some 70, 130
 *   and 200 grains at LOW, MEDIUM and HIGH through a hockey stop; the
 *   weighed spray draws some 3,150, 5,850 and 9,000 there (the snow lab's
 *   perf rows), each a cheap streak on the GPU. Kept as they were — the
 *   software renderer's frame times are too noisy to price a row by — and
 *   OWED A GPU RE-PRICE (`make bench ARGS="--gpu --costs"`).
 * The TRAILS prices stand for the snow kept under the skis too: the
 *   player's and the two nearest rivals' bases let the ground down in the
 *   vertex stage at every stop (`ski-clear.ts`, a few dozen vector ops a
 *   vertex, no texture read), and OFF and LOW draw the bases' own groove in
 *   the fragment stage — too small to price apart, and OWED A GPU RE-PRICE
 *   with the row.
 * The TRAILS prices leave out the TREE WELLS (`TRAIL_LOOK`'s `wells`,
 *   MEDIUM and HIGH only): the benchmark's race is skied on the ordinary
 *   snow, where no map has a well and the ground reads none, so they cost
 *   the reference nothing. In a metre of powder they cost a refill of the
 *   well map every 16 m the lens moves (about 6 ms of the processor's, a
 *   hitch rather than a rate) and a few texture reads a pixel near the lens.
 * LAMPS: only after dark, and only where beams cross — his own headlamp is
 * always drawn, the floods and the field's lamps past the nearest are what
 * the lower stops give up, and LOW the snow's glitter in the beams. The
 * benchmark's race is run by day, where the row costs nothing, so its
 * prices are an estimate off a night frame, not the re-pricing's.
 */
export const PICTURE_PRICES: PriceList = {
  // Measured at 0.6, 0.8 and the whole (0.40 and 0.87 ms over 0.6); those
  // lie on one line in the share of pixels (0.36, 0.64, 1) — 1.36 ms a
  // screen's worth — and the tenths between and under them are laid on it,
  // until the next re-pricing times them. The floor is the half's frame.
  resolution: {
    "50": { cost: 0, benefit: 0 },
    "60": { cost: 0.15, benefit: 15 },
    "70": { cost: 0.33, benefit: 38 },
    "80": { cost: 0.55, benefit: 60 },
    "90": { cost: 0.78, benefit: 75 },
    "100": { cost: 1.02, benefit: 85 },
  },
  // The DISTANCE row also carries the SKY (`SKY_TIER`, `sky-gpu.ts`), the
  // CLOUD (`CLOUD_TIER`: LOW the shell, MEDIUM the slab, HIGH and MAX the
  // raymarched volume) and the FAR RANGES' rings (`FAR_TIER`), all added
  // after the costs below were measured on a GPU. What they add is
  // SOFTWARE-SCALED, AN ESTIMATE OWED A REAL GPU'S RE-PRICE (`make bench
  // ARGS="--gpu --costs"`): each pass timed alone in software GL at
  // 1280 × 720 (`make sky ARGS=--sheet=cloudmotion`, `--sheet=skytier`,
  // `--sheet=far`), scaled to the reference by RESOLUTION's own ratio —
  // the benchmark race in the same software GL at 1280 × 720, DISTANCE LOW,
  // the rest at the top, 4539 ms a frame at 100 and 2221 at 50, against
  // RESOLUTION 100's measured 1.02 ms: 0.00044 reference ms a software ms
  // of pixel work. The cloud's passes over LOW's shell (5.3 ms): MEDIUM
  // 110.9, HIGH 50.6 a steady frame (269 on a cut), MAX 99.8 (258) — so
  // +0.05, +0.02 and +0.04 ms on MEDIUM, HIGH and MAX; the GPU sky's tables
  // (0.2 ms on HIGH, and only as the sun moves) and the far rings (10–37k
  // triangles, inside the lab's noise) round to nothing. Scaled by the
  // whole frame's ratio instead (the race's 4539 ms against its 9.1 ms on
  // the reference) the same passes would be about five times dearer, which
  // still moves no stop by a quarter of a millisecond. Each estimate is
  // added to the GPU-measured cost under it, so a re-price replaces both.
  distance: {
    low: { cost: 0, benefit: 0 },
    medium: { cost: 0.57, benefit: 27 },
    high: { cost: 1.25, benefit: 39 },
    max: { cost: 1.5, benefit: 42 },
  },
  terrain: {
    low: { cost: 0, benefit: 0 },
    medium: { cost: 0, benefit: 8 },
    high: { cost: 0.21, benefit: 12 },
  },
  // MEDIUM and HIGH carry the deformable snow, added after the costs under
  // it were measured on a GPU: SOFTWARE-SCALED, AN ESTIMATE OWED A REAL
  // GPU'S RE-PRICE (`make bench ARGS="--gpu --costs"`). Its patch (80k and
  // 115k triangles, one draw call) and self-shadow march (7 and 14 steps)
  // added +42 % to +57 % to the snow lab's software frame at 960 × 540,
  // about 2,000 software ms; at RESOLUTION's 0.00044 reference ms a
  // software ms of pixel work at 1280 × 720 (DISTANCE's note), 1.78 times
  // that at 960 × 540, that is about 1.5 ms with the full march — taken as
  // +1.0 at MEDIUM's half march and +1.6 at HIGH's. The field's own CPU
  // (the presses, the settling, the upload) is a few tenths of a
  // millisecond riding, more under a fall (`make snow-eval
  // ARGS=--deform-perf`).
  trails: {
    off: { cost: 0, benefit: 0 },
    low: { cost: 0.06, benefit: 50 },
    medium: { cost: 1.16, benefit: 66 },
    high: { cost: 1.84, benefit: 72 },
  },
  // Measured on a winter race. A SUMMER free ride also draws the grass the
  // row reaches (`FOREST_LOOK[...].grass`): ESTIMATED, not measured, at about
  // 0.1, 0.2 and 0.35 ms for LOW, MEDIUM and HIGH (the tufts' triangles at
  // the patch's density against the trees' own) and left out of these
  // prices until a GPU bench times a summer frame.
  forest: {
    low: { cost: 0, benefit: 0 },
    medium: { cost: 0.65, benefit: 12 },
    high: { cost: 1.19, benefit: 18 },
  },
  shadows: {
    off: { cost: 0, benefit: 0 },
    skiers: { cost: 0.6, benefit: 22 },
    medium: { cost: 0.62, benefit: 40 },
    high: { cost: 1.89, benefit: 44 },
  },
  spray: {
    low: { cost: 0, benefit: 0 },
    medium: { cost: 0.08, benefit: 8 },
    high: { cost: 0.18, benefit: 12 },
  },
  lamps: {
    low: { cost: 0, benefit: 0 },
    medium: { cost: 0.3, benefit: 6 },
    high: { cost: 0.6, benefit: 10 },
  },
  // SOFTWARE-SCALED, AN ESTIMATE OWED A REAL GPU'S RE-PRICE: the pinned
  // race at 640 × 360 in software GL, frames timed with the row at each stop
  // — 1167 against 1017 ms on the LOW preset, 5150 against 4900 on HIGH.
  // LOW's 150 ms is 600 at 1280 × 720, at RESOLUTION's 0.00044 reference
  // ms a software ms about 0.26 ms; HIGH's larger saving is mostly the
  // cloud passes DISTANCE already prices. FULL's worth is the cloud, the
  // sun and the night sky over a picture that has none.
  sky: {
    plain: { cost: 0, benefit: 0 },
    full: { cost: 0.26, benefit: 14 },
  },
  // SOFTWARE-SCALED, AN ESTIMATE OWED A REAL GPU'S RE-PRICE: the pinned
  // race on the LOW preset at 640 × 360 in software GL, 1067 ms a frame
  // with the rings' mesh against 1033 with the skyline painted — 34 ms,
  // about 0.06 ms at 1280 × 720. 3D's worth is ridges that stand apart as
  // the lens moves and meet the map's own ground with no seam.
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
