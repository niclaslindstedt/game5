// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AFTERSKI AND THE BUZZ — the numbers `afterski.ts` (the lodge a free
// ride's skier skis up to and goes into), `cabins.ts`'s `placeLodges`
// (where a lodge stands) and `buzz.ts` (what the beer does to his skiing,
// and getting up and fetching his skis after a fall) read. Nothing here is
// a measurement of anything but the lodge's place: the buzz is an ARCADE
// DIAL, argued against the feel — a skier who has had a few skis worse,
// falls sooner and takes longer to come right — never against a blood
// alcohol curve.

export const AFTERSKI = {
  /** WHERE A LODGE STANDS (`placeLodges`), m and shares.
   *   * `bottom`, `tail`, `every`: the valley's lodge tries every run's last
   *     `bottom` m, a station every `every` m to `tail` m short of its end.
   *   * `band`: the mountain's lodge stands where the run is between these
   *     shares of the map's vertical over its base — part way down, never
   *     at the top — and below the tree line; `midChance` the share of
   *     maps that have one.
   *   * `setbacks`: how far back past the run's edge its terrace is tried,
   *     m, nearest first — near enough to ski up to.
   *   * `downhill`: the most it is turned from facing its run toward facing
   *     down the fall line, rad.
   *   * `apart`: the least gap between the two lodges, m.
   *   * `tries`: the most stations a band tries, best first. */
  lodge: {
    bottom: 320,
    tail: 25,
    every: 15,
    band: [0.25, 0.68] as const,
    midChance: 0.75,
    setbacks: [4, 9, 15, 23, 33, 45] as const,
    downhill: 0.5,
    apart: 300,
    tries: 500,
  },
  /** THE DOOR (`afterskiWithin`): the spot on the snow before the racks a
   * skier stops at, `door` m out past the terrace's edge in the middle of
   * the front; within `reach` m of it, going no faster than `slowest` m/s,
   * the machine press takes him in. */
  door: 2.2,
  reach: 7,
  slowest: 2.5,
  /** INSIDE (`stepAfterski`), s: the first beer is in his hand `first` s
   * after the door, and one is finished every `every` s after it — the
   * jump press orders the next at once, no sooner than `least` s after the
   * last — each raising the buzz by `beer`, to 1 at the most. The shot of a
   * beer being drunk lasts `sip` s of it. */
  beers: { first: 3, every: 14, least: 3.5, beer: 0.14, sip: 2.2 },
} as const;

/** THE BUZZ — `SkierState.buzz`, 0 sober to 1 as drunk as the game lets
 * him get, and what it does to him (`buzz.ts`). At 0 nothing below is
 * read: a sober run is the run it always was, bit for bit. */
export const BUZZ = {
  /** SOBERING UP: the buzz falls this much a second, 1/s — ten minutes
   * from 1 to nothing, outside the lodge. */
  decay: 1 / 600,
  /** THE LATE HANDS: the edge and the lean the skier asks for reach his
   * skis after a lag of `lagSober + lag × buzz` s (a first-order lag). */
  lagSober: 0.02,
  lag: 0.42,
  /** OVER AND UNDER: how much harder or softer than asked the edge goes
   * on at full buzz, as a share, swinging between the two over `swing` s. */
  gain: 0.55,
  swing: 6.7,
  /** THE DRIFT: a pull to one side and then the other a sober skier would
   * never feel — two slow swells of edge, at full buzz `drift` of the
   * edge's range each, over `driftAt` s — so he does not ride straight. */
  drift: [0.3, 0.16] as const,
  driftAt: [4.3, 1.7] as const,
  /** THE LEAN wandering fore and aft, a share of its range at full buzz,
   * over `leanAt` s. */
  lean: 0.32,
  leanAt: 3.1,
  /** THE TUCK he cannot hold: at full buzz the tuck asked for comes and
   * goes by this share, over `tuckAt` s. */
  tuck: 0.35,
  tuckAt: 2.3,
  /** THE THRESHOLDS HE FALLS AT, at full buzz (`crash.ts`'s `crashLimit`,
   * blended toward these by the buzz from whatever his resilience gives):
   * well below the club skier's — a trunk on the tips at 13 km/h, the legs
   * folding at 7 g, a crooked landing at half what a sober professional
   * rides away, the body down off a drop of a few centimetres, an edge
   * caught at 31° with the snow sliding 14 km/h across it, a hand put down
   * held for a twentieth of a second. */
  crash: {
    treeSpeed: 3.5,
    treeShoulder: 4.5,
    noseAngle: 0.42,
    noseDig: 0.34,
    bodySlam: 0.7,
    legsFold: 7,
    crooked: 0.55,
    rollHold: 0.06,
    catchEdge: 0.55,
    catchSlip: 4,
    stakeSpeed: 6,
    netSpeed: 1,
  },
  /** NO RESET WHEN HE FALLS (`buzz.ts`'s `getUp`): from this buzz up a
   * player thrown on a free ride is not stood back up on the piste — he
   * gets up where he lies and fetches his skis. */
  fetchFrom: 0.1,
  /** GETTING UP AND FETCHING HIS SKIS (`stepFetch`), s and m/s.
   *   * `rise`: up off the snow onto his feet.
   *   * `walk`: his pace in his boots on the flat, m/s; `climb` how much a
   *     rising pitch (rise over run) slows it, to `slowest` of it at most,
   *     and `descend` how much a falling one hurries it, to `fastest`;
   *     `loose` how much loose snow under him slows it (postholing); `jog`
   *     the most the player's own tuck hurries it.
   *   * `turn`: how fast he turns toward the way he walks, rad/s; he sets
   *     off once the ski is within `facing` rad of straight ahead.
   *   * `stagger`: the weave in his heading at full buzz, rad, over
   *     `staggerAt` s.
   *   * `reach`: how near a ski's binding he bends for it, m; `pick` how
   *     long the picking up takes; `clip` stepping back into the bindings.
   *   * `hands`: how long the player's own walking holds after his last
   *     touch before the walk goes on by itself. */
  fetch: {
    rise: 1.6,
    walk: 1.7,
    climb: 1.5,
    slowest: 0.4,
    descend: 1,
    fastest: 1.3,
    loose: 0.45,
    jog: 1.5,
    turn: 2.6,
    facing: 1.0,
    stagger: 0.3,
    staggerAt: 2.1,
    reach: 0.9,
    pick: 0.9,
    clip: 1.4,
    hands: 1.2,
  },
} as const;
