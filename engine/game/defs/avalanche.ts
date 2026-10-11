// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AVALANCHE's numbers (`avalanche.ts`): a dry SLAB breaking on a loaded
// lee slope off the free ride's groomed runs, running as a dense flow under
// Voellmy's friction, and the skier it takes buried in its debris. Every
// number carries its unit and the research it is drawn from
// (`docs/avalanche.md` restates the research with its sources); a number
// that is a dial for play rather than a measurement says so.

export const AVALANCHE = {
  /** THE STEEPNESS BAND a slab releases in, degrees of slope. Below about
   * 30° the weak layer's own friction holds a broken slab in place (the
   * crushed layer's friction angle is near 30°), most skier-triggered
   * slabs start between 35° and 45° (the commonest about 38°), and past
   * about 50° the snow sloughs off in small sluffs before a slab can build.
   * `rise` is where the chance starts, `full` where it is whole, `fade`
   * where it starts to thin and `gone` where it is none. */
  steep: { rise: 29, full: 35, fade: 46, gone: 55 },
  /** Where the slab's bottom edge (the STAUCHWALL) comes: the first point
   * down the fall line flatter than this, degrees — the compression zone
   * where the slope eases off — or `slabMost` m below the crown. */
  stauch: 26,
  slabMost: 220,
  /** GROOMED, CONTROLLED SNOW DOES NOT SLIDE: the map's packed share
   * (`Level.packedAt`) past which a point is a piste and holds, 0..1. A
   * groomed run is packed through to the ground and the patrol works it
   * with explosives before it opens; the danger lies off it. */
  packedHolds: 0.5,
  /** THE WOODS ANCHOR THE SNOWPACK: this many trunks within `anchorReach`
   * m of a point hold its slab in place (a dense forest prevents release;
   * a few trees in a glade do not). */
  anchorTrees: 4,
  anchorReach: 9,
  /** THE RUN'S LOAD, 0..1: how much slab is lying waiting on the snow the
   * day, the fall and the snow dial have left. `base` is a settled
   * snowpack on a fair day (a few slabs, hard to trigger); every metre of
   * NEW SNOW adds `perFresh` (a storm's 30 cm is the load the danger
   * scales are built round: the critical new-snow depth is 20–50 cm),
   * every step of the SNOW DIAL past the ordinary adds `perDial`, and a
   * sky that is snowing on the whole adds `perFall` of its fall. */
  load: { base: 0.12, perFresh: 2.5, perDial: 0.18, perFall: 0.35 },
  /** WIND LOADING: snow drifts when the air at 10 m blows past the
   * transport threshold — about 5 m/s for loose dry snow (cornices start
   * growing at the threshold and grow fastest about 40 % past it) — and
   * is laid on the LEE side of what it crossed. `from` is the threshold,
   * m/s, `full` the wind that loads a lee slope its most; `storm` is the
   * share of the load that lies on EVERY aspect (a storm slab), the rest
   * lying where the slope faces down the wind; `lee` how much more a
   * fully loaded lee slope carries than the storm slab alone (wind-drifted
   * deposits are commonly several times the snowfall). */
  wind: { from: 5, full: 13, storm: 0.35, lee: 1.6 },
  /** THE TRIGGER: the chance a skier crossing a slope of hazard 1 sets it
   * off, per metre crossed (a game's dial: a fully loaded 40° lee slope
   * goes within a couple of hundred metres of skiing; a settled one in a
   * fair week almost never). The hazard is probed every `probe` m of his
   * way. A LANDING adds `landing` times the hazard, by its impact over
   * `landRef` m/s (a skier's weight landing a jump loads the weak layer
   * several times over); a SNOWMOBILE's weight and churn `sled` times as
   * much per metre. */
  trigger: { perMetre: 0.006, probe: 2, landing: 0.25, landRef: 6, sled: 3 },
  /** No new slab within this long of the last one releasing, s (a dial: the
   * flow must be over and the debris settled before the mountain tries
   * again). */
  again: 25,
  /** How many released beds are remembered so the same slope does not
   * slide twice (each is a few numbers). */
  beds: 4,
  /** THE CROWN: the fracture breaks this far ABOVE the skier, m (a skier's
   * weight starts the crack in the weak layer under him and it runs
   * uphill to a crown a few metres to tens of metres over his head —
   * propagation is faster than any skier, so he is ON the slab when it
   * goes), dealt between the two. */
  crownAbove: [5, 30] as const,
  /** THE SLAB'S WIDTH across the slope, m, dealt between the two and
   * grown by the hazard (dry slabs are about as wide as they are long, and
   * skier-triggered ones are tens of metres to a hundred across), each
   * flank cut short where the slope is no longer steep, open and loaded. */
  width: [25, 90] as const,
  /** THE SLAB'S THICKNESS at the crown, m: dry slabs' depths are spread
   * log-normally, most of them 0.3–1 m, a median near half a metre;
   * dealt between the two (the median at `depthMid`) and deepened by the
   * load. */
  depth: [0.25, 1.4] as const,
  depthMid: 0.5,
  /** THE FLOW'S PARCELS: the slab is cut into cells about this far apart
   * across and along, m, at most `cellsAcross` × `cellsAlong` and
   * `cells` in all — a dense flow's few hundred, never more, so a phone
   * steps it for nothing. */
  cell: { across: 7, along: 9 },
  cellsAcross: 20,
  cellsAlong: 16,
  cells: 256,
  /** VOELLMY'S FRICTION: a Coulomb part `mu` against the snow's normal
   * load, which brings the flow to rest (it stops where the slope is
   * flatter than atan(mu)), and a turbulent drag g·v²/(xi·h) that holds
   * its speed down while it runs. The calibration tables for small
   * avalanches (well under 10,000 m³) take mu 0.2–0.3; xi runs
   * 1000–2500 m/s² for open slopes, 400 in forest. */
  mu: 0.24,
  xi: 2000,
  xiForest: 400,
  /** The FLOW HEIGHT, m: the slab's thickness times `bulk` as it breaks
   * into blocks and takes up the snow it runs over (dense flows run
   * 1–3 m deep), never past `heightMost`. */
  bulk: 3,
  heightMost: 3,
  /** A parcel is at rest below this speed on a slope flatter than its
   * friction, m/s; a flow is OVER when every parcel is, or after
   * `runMost` s whatever it is doing. */
  rest: 0.4,
  runMost: 60,
  /** THE FAN: the share of the fall-line speed a parcel at the slab's
   * flank is pushed out sideways with as the slab breaks up, so the
   * flow widens a little the way a slide spreads below its slab. */
  fan: 0.12,
  /** THE PILE-UP: a parcel running into debris already at rest (another
   * parcel stopped within `reach` m) ploughs into it at `decel` m/s² and
   * comes to rest on it once under `stop` m/s, so the deposit builds back
   * up the path from its toe the way debris does, rather than every
   * parcel running out alone. Found by a plan hash of `bucket` m. */
  pile: { reach: 5, decel: 10, stop: 2.5, bucket: 6 },
  /** THE DEBRIS: snow settles from the slab's 150–250 kg/m³ to a deposit
   * of 300–500 kg/m³, so a parcel's volume shrinks to `settle` of the
   * slab's, and lies over a disc `spread` m across round where it
   * stopped. */
  settle: 0.55,
  spread: 9,
  /** CAUGHT: a parcel within `reach` m of the skier coming on at him
   * faster than `catchSpeed` m/s — its speed less his own along its way —
   * takes him off his feet. A slab sliding slowly as a block can be skied
   * off (a skier on it rides it, and gets off it across the flank); once
   * it has broken into tumbling blocks and runs faster than he is going
   * its way, it takes him. Skied out ahead faster than it comes, or out
   * of its path, he is never taken. `reach` is a dial for the flow's
   * width round a parcel's point. */
  catchSpeed: 7,
  reach: 5.5,
  /** Within this far of a running parcel a skier not caught is INVOLVED,
   * m, and once he has been clear of every running parcel by it for
   * `escapeAfter` s (or the flow is over) he has ESCAPED. */
  near: 18,
  escapeAfter: 2,
  /** CARRIED: the share of the gap between the body's points' speed and the
   * flow's taken up each second (a dense flow drags a body along at
   * nearly its own speed), and the lift it holds him at, m/s up. */
  drag: 6,
  lift: 0.6,
  /** He rides in the parcel that took him, drawn back into it at `hold`
   * per second of the gap (m/s per m), and is put down under the debris
   * `settleFor` s after it comes to rest. */
  hold: 1.5,
  settleFor: 0.6,
  /** BURIED: the share of the debris' depth over him he lies at, dealt
   * between the two (a body rides low in a dense flow and is laid at the
   * bottom of its column more often than not); under `headFree` m he is
   * a partial burial, his head out, and gets up as any fall. The mean
   * depth of a complete burial in the case series is about a metre. */
  under: [0.45, 1] as const,
  headFree: 0.3,
  /** THE SURVIVAL CURVE of a complete burial, by minutes under the snow:
   * about 91 % alive at 18 minutes, a steep fall to about 34 % by 35
   * minutes as the airless die of asphyxia, a slow fall after (those with
   * an air pocket) to about a quarter at 90 and next to none past two
   * hours as the cold takes them. Pairs of (minute, share alive). */
  survival: [
    [0, 1],
    [18, 0.91],
    [35, 0.34],
    [90, 0.26],
    [130, 0.07],
    [180, 0.02],
  ] as const,
  /** Every metre buried past the mean (1 m) shortens his time by this
   * share (depth is the strongest single predictor of survival). */
  deeper: 0.3,
  /** COMPRESSED FOR PLAY: the real seconds one second of the run stands
   * for while he is buried (a dial: 30 makes the 18 minutes of good odds
   * 36 s, long enough for a search, short enough to matter). */
  timeScale: 30,
  /** How long a skier whose air has run out lies before the run takes him
   * back, s (a dial). */
  lostFor: 6,
} as const;
