// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RESORT'S RULE BOOK — R25 onward, the rules a generator from the
// resorts on (`versions.ts`) builds a whole ski area to, stated beside the
// rule book (`rules.ts`) and read with it: every map is still R1–R24's, and
// these say what a RESORT adds — one mountain shaped for a ski area, the
// lifts on it, a network of runs of every colour and the transport lanes
// between them, and the COURSE down that network a run is raced on.
//
// THE RESEARCH BEHIND THE NUMBERS — read off ski areas' piste maps and the
// planners' own figures, by class and never by name:
//
//   massif.vertical 900–1150 m   a mid-size area's lifted vertical, top
//                                station to village; the fell's half of it
//   piste maps                   a resort is a few SECTORS — a steep one
//                                under the peak (the blacks and the reds,
//                                the headwalls), a gentle shoulder (the
//                                long blues and greens), a bench part-way
//                                down where the first lift stage tops out
//                                and the runs meet, and the nursery slopes
//                                beside the village
//   network.gap 24 m             pistes cut through a forest stand 20–80 m
//                                apart; parallel runs keep a strip of
//                                trees between them
//   road.grade 0.12              a cat track (a transport lane) is graded
//                                at 6–12 %, gentle enough to schuss and
//                                never so flat a skier stops
//   road.width 6–10 m            a cat track is one or two piste machines
//                                wide
//   course.length 1200–4600 m    a resort run from a top station to the
//                                village: a kilometre and more off a short
//                                lift, a downhill course's 3–4.5 km off the
//                                top
//   network.colours              a resort's piste kilometres split roughly
//                                a fifth green, two fifths blue, a third red
//                                and a tenth black — the steep country more
//                                red and black, the fell more green and blue
//
// The rules, in prose (each realized by the resort's generator, re-checked
// by `analyzeResort`, asserted across seeds in tests/resort_test.ts, and
// carried VERBATIM by docs/level-generator.md):
//
//   R25 THE RESORT. A generator from the resorts on (`versions.ts`) builds
//       every map as one SKI AREA: a single mountain, its lifts and its
//       runs, and the map a run is raced on is that whole area with one
//       COURSE down it (R28) — every other run on the mountain groomed and
//       skiable beside it. The mountain is a MASSIF: its summit ridge rises
//       to a PEAK `massif.peak.across` metres one side of the map's middle
//       and falls to a lower SHOULDER `massif.shoulder.across` metres the
//       other side, standing `massif.shoulder.share` of the vertical
//       (`massif.vertical`, scaled by the region, R21); the face under the
//       peak falls on a STEEP profile and the face under the shoulder on a
//       GENTLE one, blended across a sector `massif.sector` metres
//       wide; part-way down — `massif.bench.at` of the descent — a BENCH
//       eases the fall by up to `massif.bench.depth`, strongest under the
//       mid-station; the headwalls (R3) stand on the steep sector; and the
//       VILLAGE stands on the valley floor `massif.village.across` metres
//       to the shoulder's side of the middle, with the face between side
//       ridges `massif.flank.inner` metres either side of the middle.
//   R26 THE LIFTS. The area's lifts are straight lines from a BOTTOM station
//       to a TOP station: a gondola from the village to the MID-STATION on
//       the bench, a chair from the mid-station to the PEAK's top station, a
//       chair from the valley floor to the SHOULDER's, a short drag from the
//       valley floor to the top of the NURSERY slopes, and, where the face
//       beyond the peak has room, a chair to an OUTER top on the steep sector
//       — the valley's bottom stations in the HUB (R29). Where R29 asks for
//       one, a DRAG LIFT (a T-bar or a platter, `lift.drag`; D2, D3 and on
//       after the nursery's D1) climbs from beside a piste's foot — its
//       finish, the stretch it merges in, or the lower part of it — to beside
//       a station or a lane that brings its skier back to its top:
//       `lift.drag.length` long, never steeper than `lift.drag.pitch` over
//       any `lift.drag.pitchWindow` of its line, `lift.drag.room` metres off
//       every piste's edge, its top on ground falling no more than
//       `lift.drag.padGrade` across its pad. Every top station stands
//       `lift.below` metres under the ridge's crest or on its bench, on a
//       PAD `lift.top.pad` metres across, cut into the slope more than
//       filled (`lift.padCut` of the fill a pad level with its middle would
//       need) and eased into the mountain over `lift.padBlend` metres,
//       groomed — its DECK `lift.top.deck` metres either side of the line
//       level and the pad LEANING off it to both sides at `lift.top.lean`
//       to its rim, the ground under the last `lift.top.approach.length`
//       metres of the line below the unload cut down under the rope's way
//       in so the mountain falls away beneath the chairs — a carrier
//       clears the snow all the way in to the unload —
//       and from its rim a RAMP `lift.top.ramp.width` metres
//       wide, groomed, comes down to every run off the top joined
//       `lift.top.ramp.drop` metres or more under the deck within
//       `lift.top.ramp.far` metres of it, at no more than
//       `lift.top.ramp.grade` where it can, eased off the pad and even down
//       to the run, where the run is a LIP onto its own pitch, and where it
//       cannot running out at `lift.top.ramp.gentle` to a LIP over a drop
//       at no more than `lift.top.ramp.lip` down to the run — and
//       a chair's pad carries its UNLOAD RAMP, a mound of
//       packed snow `lift.unload.height` metres high under the unload point
//       `lift.unload.at` metres short of the top, falling off over
//       `lift.unload.reach` metres. Every BOTTOM
//       station, and a drag's top, stands BESIDE the runs: its footprint
//       (`lift.footprint`: its house behind the wheel, its load line and
//       corral before it) on no run's surface, on ground level enough to
//       build on, and a drag lift's line crosses no piste. No tree stands
//       within `lift.clear` metres of a lift's line or a station.
//   R27 THE RUNS. Every run leaves a top station down the mountain — a PISTE
//       built to a colour (R23's rows: its steepest raw ground, its ceiling;
//       a region tilting the colours, R21), `piste.width` metres wide by its
//       colour, opening above the tree line and closing every
//       `piste.neck.every` metres down it to a NECK `piste.neck.width` wide
//       for `piste.neck.length` metres — or a TRANSPORT LANE (`road`:
//       `road.width` metres wide, never steeper than `road.grade` over any
//       `track.gradeWindow`, traversing as far off the fall line as
//       `road.swing` to hold it) — walked like R5's piste, never climbing,
//       never doubling back up the map, its bends R6's, with room past the
//       inside bench of every one. A run ENDS either on the valley floor,
//       with R5's finish straight into the hub (R29) beside the others'
//       (their benches may meet, their corridors never), or by MERGING into a
//       run laid before it, never in that one's first or last stretch: it
//       closes on the other's line until it runs inside it, along it, and the
//       two are one groomed surface there. LANES BETWEEN THE RUNS are laid
//       once every run off a top station is: a BRANCH LANE leaves a piste
//       part-way down, from its edge, and runs across the face to join a
//       piste off another lift — two sectors side by side across the face
//       linked one way or the other — and a LINK LANE runs from a piste's
//       lower part to a lift's BOTTOM station where R29 asks for one; the
//       area's lanes run to at most a few tenths of its kilometres. A lane
//       crosses a piste square, never runs beside one, and never meets
//       another lane. No piste crosses another, and anywhere but where one
//       merges into another, a lane leaves its piste, or two leave one top
//       station (and there off each other's width and bench), the corridors
//       of two runs keep `network.gap` metres of the mountain between their
//       benches. Each run's colour is MEASURED (R8's steepest
//       `track.colourWindow` on its own line, up to where it runs inside the
//       run it merges into), and a run is graded, its kickers and drops laid
//       (R9, R24, never within `network.junction` metres of a junction), its
//       drifts dealt (R17), pressed into the mountain (R8, R10, R18) — drawn
//       onto another's surface wherever it runs on it, at a junction, off a
//       shared top or where a lane leaves its piste — and its windrows opened
//       where another run joins or leaves it, in the order the runs were
//       laid. The area offers `network.colours` of each colour by region, and
//       at least `network.runs.min` pistes.
//   R28 THE COURSE. A course is the line a skier follows from a run's top
//       station down the network to the village: that run, then each run
//       it merges into from where it joins, eased across the junction over
//       `course.merge` metres, its length in `course.length`. Its colour is
//       the steepest colour on it. Every run that leaves a top station
//       starts a course; a map is raced on ONE of them — the one asked for
//       (`GenerateOptions.course`), or one of the colour asked for, or one
//       the seed deals — and R11–R13's gates, start gate and start line
//       stand on that course; its kickers and drops are the ones on the
//       piste (R9, R24) and every other run's are the mountain's. The day
//       (R15, R19) is the course's own, dealt off a stream of its own, its
//       hour turned to the face the resort was dealt.
//   R29 ACCESS AND THE HUB. The lifts, the lanes and the wind tunnels (R30)
//       reach the whole mountain, and every piste can be skied again without
//       a harder one. THE HUB is the foot of the mountain, where the runs end
//       and the valley's bottom stations stand: an open band across the
//       valley floor — not a clearing round the village — from `hub.reach`
//       metres past the outermost finish or bottom station on either side,
//       its lower edge `hub.below` metres out from the foot of the face (and
//       `hub.inside` past the outer tunnel, R30), its upper edge where the
//       ground has risen `hub.rise` metres over the floor there, but always
//       `hub.margin` metres above every finish and every valley bottom
//       station, and never less than `hub.depth.min` nor more than
//       `hub.depth.max` deep — following the ground, eased along it over
//       `hub.ease` metres, read every `hub.step` metres across; no tree,
//       kicker or cliff stands in it, the woods thinning into it over
//       `hub.fringe` metres, and it is groomed. Every piste P, as hard as the
//       colour it measures, holds two halves skied only on LIFTS (bottom to
//       top, the only way onto a top), LANES (green whatever their pitch),
//       WIND TUNNELS (entrance to exit) and PISTES no harder than P, always
//       downhill along a run from where he came onto it: THE WAY IN — from
//       some lift's top a skier comes onto P within `access.skate` metres of
//       its start — and THE WAY OUT AND BACK — down P, off it onto a lane
//       that leaves it, and on from where it ends (the run it merges into, at
//       the junction, a merge into a harder run being that run skied; its
//       finish in the hub; the station a link lane runs to), a lift's top
//       puts him back on P as near its start. He comes off a run at a lift's
//       BOTTOM station where the run's line passes within `access.skate`
//       metres of it, at a lane that leaves the run further down, or at the
//       run's end; off a lift's TOP onto any run whose line passes as near,
//       where it passes nearest, and to a bottom station as near; and the hub
//       is one place — every finish in it reaches every bottom station in it
//       or within `access.skate` of it, and every tunnel's entrance. A piste
//       is walked to merge only into a run no harder than itself; where one
//       still does — the mountain made it gentler than it was built — or
//       cannot otherwise be skied again, a DRAG LIFT from its foot back up
//       (R26), else a LINK LANE off it before it meets the harder run to a
//       station or a run no harder, brings its skier back; a piste neither
//       brings back is left out; and where a piste off a lift whose bottom
//       station stands up the mountain would leave its skier more than
//       `access.runout` metres of the runs below it to ski on the way back to
//       its start, a drag lift from its foot, or a link lane to its own
//       lift's station, brings him back where one fits. Every lift's bottom
//       station is reached on skis from the hub, so no lift is an island.
//   R30 WIND TUNNELS. Two horizontal lifts carry a skier along the hub
//       without his skiing — W1 one way across the floor and W2 back — each
//       from an entrance by the bottom station or the finish at one end of
//       the hub to an exit by the one at the other, both on the floor below
//       every finish: a line of stations every `tunnel.step` metres on a bed
//       graded into the floor, `tunnel.under` metres below the lowest finish
//       or bottom station and `tunnel.gap` metres apart, `tunnel.width`
//       metres wide, at least `tunnel.length` long, never falling or climbing
//       more than `tunnel.grade` over any `tunnel.window`, inside the hub,
//       crossing a run only square and groomed under, no tree within
//       `lift.clear` metres of its edge; its wind blows at `tunnel.speed`
//       m/s. A skier who stands into the wind inside one is carried along it
//       at its speed (TUNING.tunnel) and let go at its exit, his way kept.

import type { Band } from "./rules.ts";
import type { PisteGrade } from "./grades.ts";

export const RESORT_RULES = {
  /** R25 — the massif. */
  massif: {
    /** The vertical from the valley floor to the peak, m (the region's
     * multiple on top). */
    vertical: { min: 900, max: 1150 } as Band,
    /** The peak: how far from the map's middle along the ridge, m, and its
     * spread (a bell's sigma), m. */
    peak: { across: { min: 260, max: 520 } as Band, spread: { min: 360, max: 560 } as Band },
    /** The shoulder: how far from the middle on the far side, m, and the
     * share of the vertical the ridge stands there. */
    shoulder: {
      across: { min: 480, max: 820 } as Band,
      share: { min: 0.56, max: 0.72 } as Band,
    },
    /** The ridge's share where neither the peak nor the shoulder lifts it,
     * and how far a slow noise wanders it (share), over this wavelength, m. */
    ridgeFloor: 0.48,
    ridgeWander: 0.06,
    ridgeScale: 420,
    /** The steep sector round the peak: a bell's sigma, m. */
    sector: { min: 420, max: 620 } as Band,
    /** The two profiles (`terrain.ts`'s shape: the share of the peak grade
     * under the ridge, how far down it steepens to the peak, how the grade
     * eases toward the floor, and the least share it eases to): the steep
     * sector's falls hardest just under the ridge, the gentle one's is
     * rounded over the top and runs out long. */
    steepProfile: { shoulder: 0.55, shoulderRun: 0.07, ease: 1.35, runout: 0.12 },
    gentleProfile: { shoulder: 0.35, shoulderRun: 0.32, ease: 0.55, runout: 0.32 },
    bench: {
      /** How far down the descent (u) the bench's middle lies. */
      at: { min: 0.44, max: 0.56 } as Band,
      /** Its half-width, in u. */
      width: { min: 0.06, max: 0.09 } as Band,
      /** How much of the grade it takes out at its middle. */
      depth: { min: 0.6, max: 0.8 } as Band,
      /** The mid-station's x as a share of the way from the village to the
       * peak, and how far across the bench reaches (sigma, m). */
      toward: { min: 0.35, max: 0.6 } as Band,
      spread: { min: 520, max: 800 } as Band,
      /** The bench's share where it is weakest. */
      floor: 0.25,
    },
    /** The village's x, from the middle toward the shoulder, m. */
    village: { across: { min: 0, max: 220 } as Band },
    /** A multiple on R3's spurs and gullies, and the share of them the
     * gentle sector keeps. */
    ridges: 1.15,
    gentleFolds: 0.55,
    /** The share of R3's floor relief the village's floor keeps. */
    floorRelief: 0.6,
    /** Where the headwalls stand (u). */
    headwalls: {
      at: { min: 0.12, max: 0.42 } as Band,
      /** How far either side of the peak a headwall's middle stands, m,
       * and how far across the face it reaches (sigma), m. */
      across: 420,
      spread: { min: 160, max: 320 } as Band,
    },
    /** The side ridges, m across from the middle. */
    flank: { inner: 1180, outer: 1420 },
  },
  /** R26 — the lifts. */
  lift: {
    /** How far under the ridge's crest line a top station stands, m down
     * the map. */
    below: 60,
    /** No tree within this of a lift's line or a station, m. */
    clear: 14,
    /** The level pad a top station stands on, m across; the share of the
     * fill a pad level with its middle would need that it is filled by
     * (the rest is cut); and how far it is eased into the mountain, m. */
    pad: 30,
    padCut: 0.25,
    padBlend: 22,
    /** THE TOP a gondola's or a chair's station stands on (generator v5):
     * `pad` m across, its DECK `deck` m either side of the line level (the
     * wheel, the ramp and the way off), LEANING off it to both sides at
     * `lean` m per m to its rim — a rider stood off slides away to his run
     * gathering speed (a green's pitch is up to 16 %). */
    top: {
      pad: 48,
      deck: 7,
      lean: 0.11,
      /** THE RAMPS off it: one to every run off the top, joined at its
       * nearest point `drop` m or more under the deck within `far` m of the
       * top (and more than `least` m past the pad's rim) that it reaches at
       * no more than `grade` m per m — a blue's — or the gentlest where
       * none; `width` m wide and eased into the mountain over `blend` m
       * beside and past its foot, eased off the pad over its first `ease`
       * share of its length; never onto a run's first `head` m. One that
       * must fall more than `grade` runs out at `gentle` and rolls over a
       * LIP, rounded over `knee` m, into a drop at `lip` down to the run. */
      /** THE APPROACH under its line (by kind): from `from` m back down
       * the line from the top (just past the unload; eased in over `ease`)
       * to `length` m, the ground cut `hang` + `clear` m under the rope's
       * way in — straight from the bullwheel `wheel` m over the deck to a
       * tower `tower` m over the ground at `length` — `half` m either side
       * of the line, eased out over `blend` (`LIFT_LOOK`'s measures). */
      approach: {
        length: 90,
        from: { chair: 11, gondola: 4 },
        ease: 3,
        wheel: { chair: 3.8, gondola: 6 },
        tower: { chair: 11, gondola: 16 },
        hang: { chair: 2.9, gondola: 4.3 },
        clear: 0.8,
        half: { chair: 7, gondola: 9 },
        blend: 10,
      },
      ramp: {
        width: 26,
        blend: 12,
        drop: 4,
        far: 180,
        least: 6,
        grade: 0.2,
        ease: 0.3,
        gentle: 0.12,
        lip: 0.65,
        knee: 3,
        head: 30,
      },
    },
    /** A chair's UNLOAD RAMP: the unload point, m short of the top down
     * the line (a rider stands up 5–8 m before the bullwheel); the mound
     * under it, m high (1–1.5 m of ramp); and how far it falls off, m —
     * 12–25 % of pitch. */
    unload: { at: 7, height: 1.2, reach: 7 },
    /** A STATION'S FOOTPRINT, by kind, m: a rectangle `back` behind its
     * wheel (the house, a gondola's door and corral), `ahead` in front of
     * it (the load line or the unload, a chair's corral), `half` either
     * side of the line — kept off every run's surface at a bottom station
     * and a drag's top. */
    footprint: {
      gondola: { back: 26, ahead: 6, half: 8 },
      chair: { back: 13, ahead: 11, half: 11 },
      drag: { back: 6, ahead: 9, half: 6 },
    },
    /** The nursery's top: how far down the descent (u), and how far from
     * the village toward the shoulder, m. */
    nursery: { at: { min: 0.74, max: 0.8 } as Band, across: { min: 380, max: 560 } as Band },
    /** A DRAG LIFT laid for R29 (a T-bar or a platter, `kind: "drag"`):
     * its length, m (a surface lift is a few hundred metres to a kilometre
     * and a bit); the steepest it climbs over `pitchWindow` metres, m per m
     * (a rope pulls a skier on his skis up to about forty per cent); how
     * square to a piste it crosses one, rad off square, and how far off a
     * piste's edge it otherwise keeps, m; how far beside the station it
     * serves its top stands, m; and the most the ground falls across its
     * top's pad, m per m — he steps off onto the level. */
    drag: {
      length: { min: 300, max: 1200 } as Band,
      pitch: 0.42,
      pitchWindow: 20,
      square: 0.6,
      room: 8,
      beside: 30,
      padGrade: 0.12,
    },
    /** The outer top beyond the peak: how far past the peak, m, and how far
     * down the descent (u). */
    outer: { across: { min: 380, max: 520 } as Band, at: { min: 0.18, max: 0.3 } as Band },
  },
  /** R27 — the network. */
  network: {
    /** The least strip of the mountain between two runs' benches, m. */
    gap: 24,
    /** How far down from a shared top station two runs may stand nearer
     * than the gap, m. */
    shared: 200,
    /** How far up from the village two runs come in side by side rather
     * than one merging into the other's finish, m. */
    finish: 260,
    /** The share of its colour's ceiling a run's walk holds its traverses
     * to (R23's band's top): the grading's room for its turns. */
    traverse: 0.7,
    /** How far down a run must be before it may merge into one that left
     * its top station with it, m. */
    sibling: 300,
    /** The most a run's centre is turned off the fall line toward its
     * target, rad. */
    centre: 0.9,
    /** The reach the sweeps of a run are dealt over, m. */
    sweepReach: 2400,
    /** The longest and the shortest a run may be, m. */
    longest: 6000,
    shortest: 300,
    /** No kicker or drop within this of a junction, m along either run. */
    junction: 120,
    /** How many times a run is walked again before the resort gives up on
     * it. */
    tries: 6,
    /** The least number of pistes an area offers (its lanes aside). */
    runs: { min: 6 },
  },
  /** R27 — a piste's width by its colour, m: wider than a race course's
   * (R7) — a resort's runs are 25–60 m through the woods and wider on the
   * open snow, a beginner's widest — opening by `open` of itself above the
   * tree line, never past `most`. */
  piste: {
    width: {
      green: { min: 40, max: 70 } as Band,
      blue: { min: 35, max: 65 } as Band,
      red: { min: 30, max: 60 } as Band,
      black: { min: 25, max: 50 } as Band,
    },
    open: 0.3,
    most: 90,
    /** THE NECKS: where a piste tightens — between the trees, down a
     * gully, past a rock — and opens out again. One is dealt every `every`
     * metres down a piste (not off its top or into its finish), closing it
     * to `width` by its colour over `length` metres of the arc, eased in
     * and out over `ease`. A black's is a couloir. */
    neck: {
      every: { min: 450, max: 900 } as Band,
      length: { min: 140, max: 260 } as Band,
      ease: 80,
      width: { green: 24, blue: 20, red: 18, black: 14 } as Record<PisteGrade, number>,
    },
  },
  /** R27 — a transport lane. */
  road: {
    /** Width, m. */
    width: { min: 6, max: 10 } as Band,
    /** The steepest it falls over any grade window, m per m. */
    grade: 0.12,
    /** The share of that the walk reads the raw ground at, so the grading
     * has room. */
    steer: 0.85,
    /** The most it turns off the fall line, rad (83°). */
    swing: 1.45,
    /** The pitch a lane is laid to fall at on the whole, start to join —
     * under its ceiling, so the walk has room to wind — and how far it may
     * run to a join, m. */
    aim: { min: 0.06, max: 0.11 } as Band,
    reach: { min: 250, max: 1700 } as Band,
    /** The shortest a lane may be, m: a link between two runs side by
     * side is shorter than a run. */
    shortest: 200,
    /** How many times a lane is walked again before it is given up: its
     * route is found once, and a walk of it differs only in its widths. */
    tries: 2,
  },
  /** R29 — access, and the hub. */
  access: {
    /** How near a run's line, or a lift's top, a station stands for a
     * skier to skate across to it, m. */
    skate: 70,
    /** The most a skier off a piste that merges skis on the runs below it
     * before a lift or the hub takes him back to its top, m, where a drag
     * lift from its foot fits. */
    runout: 800,
  },
  hub: {
    /** How far past the outermost finish or valley bottom station either
     * way the band runs, m. */
    reach: 140,
    /** Its lower edge, m out over the floor from the foot of the face
     * (`mountain.base`), and how far past the outer tunnel's edge at
     * least, m. */
    below: 150,
    inside: 15,
    /** Its upper edge: where the ground stands this much over the floor at
     * the lower edge, m; never nearer than `margin` m above a finish or a
     * valley bottom station; the band `depth` deep, m. */
    rise: 4,
    margin: 40,
    depth: { min: 100, max: 240 } as Band,
    /** How far its lower edge wanders along the floor either way, m, over
     * `ease`; at its two ends it closes to `depth.min` over `reach`. */
    wander: 20,
    /** The window its upper edge is eased along over, m; the columns it is
     * read and published at, m apart; and how far out its woods thin, m. */
    ease: 200,
    step: 20,
    fringe: 40,
    /** How far past its edge its grooming fades out, m. */
    fade: 12,
  },
  /** R30 — the wind tunnels. */
  tunnel: {
    /** The stations along one, m apart. */
    step: 4,
    /** How far below the lowest finish or valley bottom station the first
     * one runs, m — clear of the finish's pressed run-out — and the second
     * below it, m centre to centre. */
    under: 55,
    gap: 28,
    /** Width, m; the wind's speed, m/s. */
    width: 9,
    speed: 28,
    /** The least length, m; the most it falls or climbs over `window` m. */
    length: 300,
    grade: 0.06,
    window: 20,
    /** How near its entrance and its exit stand to a bottom station or a
     * finish, m. */
    reach: 160,
  },
  /** R28 — the course. */
  course: {
    /** Its length, m. */
    length: { min: 800, max: 4800 } as Band,
    /** The ease across a junction, m. */
    merge: 60,
    /** THE SLALOM GATES: their spacing down the course, m; their width by
     * the course's colour, m (a giant slalom's gates stand a few metres
     * wide, a beginner's wider); how far inside the piste's edge a gate
     * keeps, m; how much of the room either side of the line a gate is set
     * across, as a share; and the least radius of the weave they ask, m. */
    gates: {
      spacing: { min: 70, max: 115, target: 90 },
      width: { green: 22, blue: 18, red: 15, black: 13 } as Record<PisteGrade, number>,
      margin: 4,
      share: { min: 0.55, max: 0.9 } as Band,
      radius: 45,
    },
  },
} as const;

export type ResortRules = typeof RESORT_RULES;
export type { PisteGrade };
