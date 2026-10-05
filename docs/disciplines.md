# The race disciplines

What each race discipline IS, as this game models it: the shape of its
course, its format, and what a racer's body and skis do in it — the
RESEARCH every number in the game's discipline code stands on. The rules
themselves (the numbers a course is set to) live in
`engine/mapgen/discipline-rules.ts` (R31 onward, mirrored in
`docs/level-generator.md`); the modes in `engine/game/defs/modes.ts`. This
page is where the reasons are kept, so a session building the next
discipline starts from research instead of a guess.

How a discipline's research is recorded here:

- **Numbers, not names.** The sport's competition rules are restated in
  our own words and numbers — never copied, never quoted — and no real
  race, venue, governing body, product or person is named (the repo is
  public; the rule is in `AGENTS.md`).
- **Every number carries its source.** A measurement cites the study it
  came from (a DOI or a PubMed/PMC id at the section's foot); a figure that
  is our own estimate is marked *(est.)*.
- **Written once, here.** A spec in `docs/specs/` may quote this page; it
  does not keep its own copy, because a spec is deleted when its feature is
  done and this page is not.

| Discipline | Mode | Course rule | State |
| --- | --- | --- | --- |
| Slalom | `slalom` | R31 | built — see below |
| Giant slalom | — | — | researched (technique, skis, course); to build — `docs/specs/GIANT_SLALOM.md` |
| Super-G | `superG` | R33 | built — see below |
| Downhill | `downhill` | R32 | built — see below |
| Ski cross | `skiCross` | R35 | built — see below |
| Speed skiing | `speedSki` | R34 | built — see below |

## Slalom

**The course** (R31): a steep stretch of 140–220 m of vertical (33–45 %),
under about 800 m long; gates every ~10–12 m down the hill, 6–13 m turning
pole to turning pole; open gates across the hill and closed gates (poles one
above the other) in hairpins (two) and verticals (three or four); direction
changes about 30–35 % of the vertical in metres; bare flex poles, no panels.

**The format**: two runs on two courses set on the same hill, the second
run in reverse order of the first's best thirty, the combined time ranked;
an interval start — one racer on the course at a time — out of a start
house, the clock started by the racer's shins opening the WAND, the racer
away within about 10 s of GO; both feet through every gate, a miss or a
straddle a disqualification, a fall that ends the run a DNF.

**The wand**: one bar hinged on one post, at shin height (35–50 cm),
swinging open forward and downhill; the clock trips at a fixed angle
10–30° open.

**The start** (the game's slalom start clip, `pwa/src/game/slalom-start.ts`):

1. *Held*: boots just behind the wand, skis parallel about hip-width, both
   pole tips planted beyond the wand a little outside its posts, the shafts
   leaning forward; crouched, weight back, the arms loaded on the poles.
2. *Rise and fall*: up out of the crouch with no hop, the feet still behind
   the wand; the chest goes out past it (some racers rock back first).
3. *Kick*: the body past the wand, both heels kicked back and up, then both
   skis fired forward together through the wand — a two-footed jump, the
   feet barely off the snow, the shins opening the wand; the feet are the
   last of him out of the house.
4. *Push*: the arms finish a hard double-pole push past the hips.
5. Racers then take 1–3 skating steps with double poles; the game skips
   them by design (he leaves at ~15–25 km/h *(est.)*, turning at the first
   gate within ~2 s *(est.)*).

On a near-flat start four skating pushes were best; on a steep one the
strategy made no significant difference [1].

**Through the gates**:

- A turn takes ~0.8–1.0 s (0.88 ± 0.19 s per gate over ~13.6 m of skiing
  per gate [2]; ~0.89–0.92 s, against ~1.46–1.48 s in giant slalom [3];
  0.83–0.96 s, the outside leg's cycle ~76 ms shorter than the inside's [4]).
- The edge angle rises from ~5° at the transition to a peak of ~66° on
  10 m spacing and 70–71° on 13 m, at or just after the gate, then falls
  fast; the tightest radius ~4.0 m at 10 m spacing and ~4.9 m at 13 m [5].
  The skis carve: their angle to the path peaks at 12–15° early in the turn
  and is 0.5–3° at the transition [5].
- Edge angle = inclination + hip angulation + knee angulation; at a 65–70°
  edge the mass leans ~45–55° in with ~10–20° of hip angulation *(est.)*.
- Outside knee flexed ~40–95°, outside hip ~50–75°; inside knee ~75–110°,
  inside hip ~65–80°; in the steering phase outside knee ~47–52°, inside
  ~81–86° [4]. Knee flexion rates ~60–90°/s; the outside leg still for only
  ~11 % of the cycle [4].
- Transition: a cross-under — both legs retract (knee, hip and trunk toward
  ~90°), the skis cross under a level body and extend onto the new edge
  above the fall line.
- Load ~80:20 outside to inside ski, ~60:40 late in the turn *(est.)*; skis
  parallel, tips level, the inside ski tipped on its edge, drawn up, not
  lifted clear.
- Upper body quiet and square to the fall line, countered 15–25° (to ~45°
  late in a turn); in a simulated countered stance trunk ~54°, pelvis ~27°
  [6]. Hands up, forward, wider than the hips.
- Pole plant: short and firm, down the hill by the boot as the old turn
  releases; the arm kept forward after.
- Cross-block: the OUTSIDE hand punches forward and down at chest height at
  the gate and knocks the hinged pole over with the guard on the grip, the
  feet passing outside it, the shin brushing it; an upright skier clears
  with the inside hand.
- Hairpins and verticals: the feet flick side to side under level, square
  shoulders.
- The finish: a short tuck, then a LUNGE at the line (one boot shot forward,
  the arms thrown forward), then up and a hockey stop.

**Speed**: ~40 km/h average, ~54–60 km/h peak; a run ~45–60 s *(est.)*; a
32-gate training course over 89 m of vertical on a 23 % slope took
28.4 ± 0.3 s [2]. Slalom skis are at least ~157–165 cm by category, on a
sidecut of ~11–13 m.

**In the game**: the course is `engine/mapgen/slalom.ts` (`setSlalom`; the
hill prepared under it — kickers levelled, groomed hard, its relief combed
smooth), the line a racer skis round its poles `engine/game/race-line.ts`
(rounded out on a steep pitch), the gate verdicts `engine/game/strict.ts`,
the board `engine/game/field.ts` and `par.ts`, the flex poles `gate-poles.ts`, the start `start-push.ts`; the
house, the shots and the clip `pwa/src/game/start-house*.ts`,
`camera-start.ts`, `slalom-start.ts`; how each technique is STOOD — the
counter-rotation, the hands and the poles, the cross-block at the turning
pole, the legs, the retraction, the tuck — `pwa/src/game/technique-pose.ts`
(a row a discipline, off the numbers on this page). The racer CROSSES
UNDER (`engine/game/defs/technique.ts`'s `Crossing`): his legs stand the
skis on the new edge — up to 57° — before his body has come over, and draw
them up under him as they swing across (`incline.ts`), so a 0.9 s rhythm
makes every turn. The bot skis the campaign's slaloms and seeds 1–16 at
~33 km/h on the mean (~36 on seed 38) and ~50 at the most, its runs 43–79 s,
a turn every ~1.0 s, ~48° of edge at a turn's peak on the mean (70° at the
most), a tenth of its turns tighter than ~7.8 m, ~3.5 BW at the peak and the
skis up to ~40° off the way at the end of a turn: slower, rounder and
skiddier than the research, the line round the poles bending no tighter than
8 m (R31's `slalom.bend`). The finish lunge is not drawn yet.

Sources: [1] PMID 30317917 · [2] PMC7739813 · [3] doi:10.3390/app14041427 ·
[4] PMC7739787 · [5] PMC12575998 · [6] KoreaScience JAKO201721242144242.

## Giant slalom, super-G and downhill

Researched together, against the slalom, for the technique rows and the
courses (`docs/specs/GIANT_SLALOM.md`; the downhill and the super-G are
built, below). Numbers are measured unless marked *(est.)*; an inclination
marked *(est.)* is derived as tan θ = v²/(gR) off a measured speed and
radius, and a carve radius as R ≈ R_sidecut · cos(edge).

**The courses.**

- *Giant slalom*: 250–450 m of vertical (men; 250–400 women); direction
  changes 11–15 % of the vertical in metres (top races ~51); gates
  ~26–27 m apart down the hill, offset ~6.8 ± 2.4 m across, the offset
  growing with the pitch (5.8 m flat, 7.4 m steep) [7, 8]; runs ~77 s;
  turn speed 18 ± 2 m/s, average ~61–70 km/h, peak ~80 km/h [9, 10].
  Two runs, as the slalom.
- *Super-G*: 350–650 m of vertical (men); direction changes at least ~7 %
  of the vertical (races ~41); turning poles at least 25 m apart, measured
  47.8 ± 9.1 m down the hill and 13.3 ± 7.5 m across; runs ~93 s; turn
  entry 24.2 ± 2.6 m/s, average ~80 km/h, peak ~102 km/h; one run [9, 11].
- *Downhill*: 800–1100 m of vertical (men; 450–800 women), the course
  about 30 m wide; runs 1.5–2.5 min (~121 s measured), no minimum of turns;
  turn speed 26 ± 4 m/s, average ~86–95 km/h, peaks 120–130 km/h on most
  courses and ~150 km/h on the fastest [9, 12].

**The skis** (the competition equipment rules, top level):

| | Slalom | Giant slalom | Super-G | Downhill |
| --- | --- | --- | --- | --- |
| Least length, men / women | 165 / 155 cm | 193 / 188 cm | 210 / 205 cm | 218 / 210 cm |
| Least sidecut radius | none (~13 m used *(est.)*) | 30 m | 45 m men, 40 m women | 50 m |
| Waist | ≥ 63 mm | ≤ 65 mm | ≤ 65 mm | ≤ 65 mm |

The binding's stack under the boot is at most 50 mm in all four. A fully
bent ski carves R ≈ R_sidecut · cos(edge): at 65° a 30 m ski carves ~12.7 m
and a 13 m slalom ski ~5.5 m, which matches the slalom's measured 4–5 m.
Giant slalom skis of 30, 35 and 40 m skied over the same gates took longer
turns at a larger radius and less force after the gate, the edge angle,
skid and fore-aft unchanged, the skier checking speed by skidding more
[13].

**Turns.**

- Turn time: slalom 0.89–0.92 s, giant slalom 1.46–1.48 s (elite
  1.41 ± 0.13 s), super-G ~2.0–2.3 s, downhill 2.4–2.6 s [3, 4, 10].
- Radius: slalom least 3.96 ± 0.23 m (10 m course) and 4.94 ± 0.59 m
  (13 m) [5]; giant slalom ~20 m typical, ~12–15 m least *(est.)*; super-G
  least 35 ± 16 m, ~45 m typical; downhill ~52 m typical [9, 12]. In slalom
  most energy is lost in turns tighter than ~15 m.
- Peak edge angle: slalom 65.7 ± 1.7° (10 m) and 71.0 ± 1.9° (13 m), at
  about the gate [5]; giant slalom 65–72° *(est.)*, its force peaking 0.86 s
  into a 1.47 s cycle (~58 %), just past the gate [10]; super-G 55–65°
  *(est.)*; downhill 45–60° *(est.)*.
- Skid: slalom 12–15° early, under 4° by the gate, the tail carving below
  ~8°, the tighter course skidded more [5]; giant slalom ~5–10° early on an
  offset gate, 2–4° steering *(est.)*; super-G and downhill mostly carved,
  under 5°, a skid only to check speed *(est.)*.
- Transition: slalom one motion, both legs flexing and extending together,
  a retraction and cross-under; giant slalom cross-under on the flatter
  ground (the trunk still, the legs tipping the skis) and cross-over on a
  steep complete turn, the flexed transition a "virtual bump"; super-G and
  downhill cross-over with little unweighting *(est.)* [3, 14]. In elite
  giant slalom the glide is ~20 % of a turn and the completion ~38 %; the
  edge set ~0.3–0.5 s above the gate *(est.)*.

**The body.**

| (knee angle, 180° straight) | Slalom | Giant slalom | Super-G | Downhill |
| --- | --- | --- | --- | --- |
| Inside leg, most folded | 67 ± 12° | 64 ± 9° | 60 ± 8° | 58 ± 9° |
| Outside leg, most extended | 129 ± 11° | 132 ± 9° | 127 ± 8° | 128 ± 17° |
| Outside / inside leg held still, share of a turn | 11 / 19 % | 34 / 20 % | 42 / 28 % | 38 / 38 % |
| Outside leg's yielding rate under load | 89°/s | 54°/s | 45°/s | 46°/s |

(Source [4].) Slalom loads both legs together and dynamically; in giant
slalom the outside leg is long and holds a high load almost still while the
inside one is short and lightly loaded. Giant slalom trunk: forward bend
27 ± 8°, side bend 11 ± 4° [15]. Pressure travels from the forefoot to the
heel through every carved turn [16]. Load outside / inside: ~50/50 at
initiation; giant slalom 75–80 / 20–25 between 50 % and 70 % of the turn;
slalom mean 114–126 % / 67–76 % of body weight, ~62/38 [17, 18].
Inclination at the apex *(est.)*: giant slalom ~59°, super-G ~52°, downhill
~53°, slalom ~60–65°, angulation adding ~5–15° to make the edge. Stance:
slalom about hip-width, the speed events a little wider (~25–35 cm between
the boots *(est.)*). Counter-rotation most in slalom (~15–30°), least in
downhill (~5–10° *(est.)*). Hands: slalom forward with a pole touch every
turn; giant slalom forward and wide, poles rarely planted, the gate blocked
with hands and arms *(est.)*; super-G and downhill bent poles carried under
the arms, hands forward and together.

**The tuck.** Drag area: standing 0.63–0.66 m² (0.65 ± 0.05 upright against
0.27 ± 0.03 half-squatting), middle 0.51–0.55 m², tuck 0.23–0.24 m², an
elite low tuck 0.17–0.18 m² in a wind tunnel [19, 20]. It rises ~0.8 % a
degree of torso angle and ~1.2 % a degree of thigh angle; in a low tuck the
lower legs make 40–50 % of the drag; in a high tuck splitting the hands
costs 5–8 % and opening up 17–21 % [19, 21]. A low tuck holds the torso
0–15° off level, the knee ~60–80° *(est.)*; a high tuck 25–35°, the knee
~100–110° *(est.)*. Racers tuck ~16 % of a super-G and ~37 % of a downhill,
standing into a high tuck in sharper turns and rough snow [9]. Air
drag takes ~23 % of the energy lost in a giant slalom, ~35 % in a super-G
and ~51 % in a downhill, 80–90 % of all resistance at 35–40 m/s [9].

**Jumps.** ~2.3 a super-G and ~4.2 a downhill, a super-G's ~21 % shorter
and ~6 % less airtime [11, 12]; typically 20–60 m and 1–2.5 s in the air
*(est.)*; a pre-jump (the legs drawn up before the lip) and an absorbing
landing *(est.)*; in the air arms down against arms along the torso changes
the drag by up to 64 % [21].

**Peak force** (body weights): slalom ~4, up to 5; giant slalom 3.16 a
turn (median 1.46); super-G 2.38–2.79 (median 1.42); downhill ~2–2.5
*(est.)* (median 1.21) [9, 11].

**The start**: poles planted beyond the wand, the body falling forward, a
pole push and the legs kicked back to open it; then slalom ~2–3 skating
steps into the rhythm, giant slalom ~2–4 skating steps and 1–2 double
poles, super-G and downhill ~2–4 double poles and 3–5 skating steps, then
straight into a low tuck *(est.; no measured step counts found)*.

**For a technique row** (one a discipline; the game's rows in
`engine/game/defs/`):

| | Slalom | Giant slalom | Super-G | Downhill |
| --- | --- | --- | --- | --- |
| Preferred radius | ~5 m | ~20 m | ~45 m | ~52 m |
| Most edge used | ~70° | ~68° *(est.)* | ~60° *(est.)* | ~55° *(est.)* |
| Turn time | ~0.9 s | ~1.45 s | ~2.1 s | ~2.5 s |
| Edge roll rate ≈ 2 × edge ÷ turn time | ~150°/s *(est.)* | ~90°/s *(est.)* | ~55°/s *(est.)* | ~45°/s *(est.)* |
| Skid allowed | 15° early, < 4° by the gate | ~8° | ~5° | ~5° |
| Transition | retraction, cross-under | cross-under / cross-over | cross-over | cross-over |
| Share tucked | 0 | ~0 | ~16 % | ~37 % |
| Peak force check | 4–5 BW | ~3.2 BW | ~2.6 BW | ~2.2 BW |

Too much force for the speed means the radius is too tight: raise it or add
skid. Speed events should be the hardest to knock off line, the slalom the
most responsive. `make technique` skis every row down a real course with
the bot and prints what it measures beside these targets (stated as bands
in `scripts/lib/technique-measure.mjs`, off this page), with the run
photographed from above, from behind through a turn and from the side at
its apex. **Gaps**: no measured edge angles, inclination or
angulation for the speed events or giant slalom, no start step counts, no
stance widths and no downhill airtimes were found — those are *(est.)*.

Sources (continued): [7] PMID 32341022 · [8] PMID 22983120 ·
[9] doi:10.3389/fphys.2018.00145 · [10] doi:10.3389/fspor.2020.00107 ·
[11] PMC7878813 · [12] PMID 24489379 · [13] PMC4717412 ·
[14] PMC6391578 · [15] PMC4772347 · [16] doi:10.1371/journal.pone.0176975 ·
[17] PMC8042208 · [18] doi:10.3389/fspor.2022.829195 ·
[19] doi:10.3390/app12020902 · [20] J. Biomech. 2021, pii
S002192902100107X · [21] doi:10.1007/s12283-022-00385-2.

## Downhill

Restated from the international competition rules for alpine skiing (the
downhill's own articles and the general ones on starting, gates and
timing), result sheets of top-level races, the timing and net makers'
published specifications, and broadcast production write-ups. The speeds,
the technique and the skis are under *Giant slalom, super-G and downhill*
above.

**The course.** A men's top-level downhill drops 800–1100 m (750 m by
exception), a lower race 450–1100 m, a women's 450–800 m, an under-21 race
up to 700 m; a two-run downhill 350–450 m. No length is set: the length
is measured and printed. Measured top-level courses run a median 3499 m
over 859 m of vertical with 41.5 gates, 79 m between gates along the
course and 29 m across [22]; one top-level course measured 3312 m over
860 m with 33 gates, another 3442 m over 1023 m. The course is about
30 m wide (narrower where the course before and after allows), its fall
zones on the outside of the curves, its obstacles behind high safety nets,
its speed controlled on the approach to every lip, drop and jump by how the
gates are set; not every section need be skiable flat out.

**The gates.** Four poles and two panels — a pair of poles at each end,
each pair holding a panel about 0.75 m wide by 0.5 m high, wind-permeable,
holding a brush and releasing a racer caught in it. At least 8 m between
the inner poles. Red, blue only for the extra gates of a second course on
the same hill (orange may stand in for red against nets of the same
colour). Rigid poles unless the jury asks for flex ones. No least spacing:
the gates MARK the line.

**Passing a gate**: both tips and both feet across the gate line, the line
between the turning pole and the outside pole at the snow. A racer who
misses a gate may not go on through the gates (disqualified); one who comes
to a complete stop may not either (did not finish); a fall without a stop
and without a gate missed goes on. The finish line is at least 15 m wide,
crossed on two skis, one ski, or after a fall between the last gate and
the line (the clock stopped on any part of the body), and the run-out past
it wide, gentle and fenced.

**The format.** ONE race run, preceded by official TRAINING: three days of
inspection and training scheduled, at least one training run held (times
taken on at least one of the last two days), every entered racer drawn in
it and none allowed to start the race without having started a timed
training run. Training times are posted and count for nothing; a racer who
falls, stops or is overtaken in training leaves the line and goes down the
edge. Training starts in bib order, its first group drawn again each day.

**The start.** An interval start, normally 60 s apart (never under 40 s);
the starter calls "ten seconds", counts five to one and gives GO, an
audible start clock mandatory at the top level; a start is valid from 5 s
before to 5 s after the racer's time, a DSQ outside it. The racer plants
his poles ahead of the line and may push off with his poles only; the
clock starts as his lower leg crosses the line. The ramp is built to let
him reach full speed quickly (no gradient is set) — on one top course a
racer reaches 100 km/h about 8.5 s out of the house *(est. from a course
description)*.

**Safety.** A-NETS: permanent, 4–6 m tall *(est.)*, on cables between steel
posts, slip sheets along their foot, placed on the course's homologation
plan. B-NETS: mobile, about 2 m tall on poles every 2 m, in 20 m sections,
one to three rows by the danger — a row rated for an 80 kg skier at
60 km/h at up to 60°, two rows 2–4 m apart for 100 km/h; at least 4 m from
the hazard, 60 m of net a hazard (40 m of it uphill), and 6 m from a
turning gate to the first row. No jump length or speed limit is set; a
landing's harm is driven by the take-off angle and speed and the
steepness of the landing [23]. Downhill injures 17.2 racers a thousand
runs against 4.9 in slalom [24].

**The speed trap and the timing.** A top-level result sheet carries seven
intermediate times and FIVE speed traps — a pair of photocells a known
distance apart (or a radar), the speed between them — at fast and slow
points alike: 96–109, 96–113, 90–98, 76–88 (a slow turn) and 130–143 km/h
on the last schuss before the finish, the course average 97–103 km/h. The
broadcast's headline trap is the fastest schuss, usually the last.

**The field.** Top-level fields start ~50–65 racers. In one race of 58
starters all finished, the winner in 1:56.16, second +0.23 s (6.5 m),
tenth +0.74 s, thirtieth +1.54 s, fiftieth +2.60 s, last +6.24 s; in two
championships thirtieth was +1.91 s and +2.40 s on 1:39–1:41, the last
+10.4 s, 5–9 % out. So ~1.5–2.5 s from first to thirtieth on a two-minute
run (~1.5–2 %), 0–10 % out, almost always by a fall.

**Jumps.** ~4.2 a downhill [12]; a well-built one 40–50 m into flat
ground *(est.)*, the biggest on a steep (~85 %) pitch carrying racers some
80 m off ~120 km/h; air ~1.2–1.6 s for 40–50 m at 30–33 m/s and ~2.5 s for
80 m *(est., ballistics)*.

**Television and the crowd.** A top downhill's production runs some fifty
cameras — a dozen high-speed slow-motion cameras, cranes, pole cameras and
drones — long lenses on towers built over the A-nets, handheld operators
behind barriers on the slope, microphones at gates and landings; small
racing drones chase racers down the steep sections and traverses (never
over the finish), and a crane gives the big jump's ride. The order a
broadcast cuts *(est.)*: the start house, a long lens down the first
schuss, the big jump from the side and in slow motion, a tower over the
traverse, the last schuss with the trap's speed, the finish. Spectators
pack the finish arena's stands, the big jumps and the steepest pitch, and
line the nets of the last schuss *(est.)*.

**In the game** (R32, `engine/mapgen/downhill.ts`): the WHOLE piste of the
ski area's course with the most vertical — the black from under the
summit, ~2.7–3.2 km over 900–1100 m — prepared as a slalom's hill is
(`course-prep.ts`: kickers levelled, groomed hard, combed) and its crests
shaved round so a racer flown off one lands on its downslope; a RACING LINE
that bends the least inside the piste, its speed gates (10 m, red) centred
on it about every 80 m; A-NETS along both edges that catch a racer and put
him out (`nets.ts`); ONE SPEED TRAP on the course's late fast straight
(`speed-trap.ts`) and four intermediate timing points; the board dealt
about par (`par.ts`'s `downhillPar`) to a downhill's tight spread
(`field.ts`'s `DOWNHILL_FIELD`), a TRAINING run's board slower and
counting for nothing; the start clock's five beeps and GO, a 5 s window;
the downhill technique row (`defs/technique.ts`) and the bot's line-follower
(`sim/downhill-steer.ts`).

**Not built yet**: one training run where the sport holds up to three (and
no ghost of it); one speed trap where a top-level sheet carries five; the
B-nets in front of a hazard (the A-nets stand the length of both edges);
a broadcast cut of the downhill's own (the replay's broadcast camera is
every mode's: the jump from the side in slow motion, the finish); a
women's and an under-21 course band.

Sources (continued): [22] doi:10.1371/journal.pone.0118119 ·
[23] doi:10.1111/sms.12300 · [24] PMID 19945979.

## Super-G

Restated from the international competition rules for alpine skiing (the
super-G's own articles and the general ones on starting, gates, timing and
the jury), the competition equipment rules, measured courses and result
sheets of top-level races. The speeds, the technique and the skis are under
*Giant slalom, super-G and downhill* above.

**The course.** A super-G drops 400–650 m at the men's top level, 400–600 m
at the women's, 350–650 m (350–600 m women) at any other international race,
250–450 m for the youth and 300–500 m in an entry league. The direction
changes are at least 7 % of the vertical in metres (6 % at some levels, 8–12
% for the youth): 42 on 600 m. Turning poles of two successive gates stand
at least 25 m apart (15 m inside a combination, allowed only in small
numbers). The terrain should be undulating and hilly; the course is normally
about 30 m wide, prepared as a downhill's with its turning sections prepared
as a slalom's; the gates are set to use the terrain, varying long and medium
turns, never only down the fall line, and leave the racer free to choose his
line; jumps may be set where the terrain allows. Measured top-level men's
courses [22]: 44.3 ± 3.3 gates (7.4 % of the vertical), 2293 ± 204 m over
598 ± 38 m, 49.5 ± 5.7 m between gates along the course, 12.4 ± 10.1 m
across, a mean slope of 16.6 ± 6.9°, 23.8 m/s on the mean; speed rose with
the slope and the gate distance and not with the offset. 192 measured turns
[25]: 50.3 ± 8.5 m between gates along the line (32–148), 13.3 ± 7.5 m of
offset, 47.8 ± 9.1 m down the fall line, 19.0 ± 5.5° of slope, 24.2 ± 2.6 m/s
into the turn, a least radius of 35.2 ± 15.7 m and 2.38 ± 0.57 body weights
at the peak; cutting 0.5 m/s by a 51 % wider offset tightened the turn 19 %
and raised its impulse 27 %, where a 13 % shorter fall-line distance did
the same with almost no load — the safer lever. Two lower-level sheets:
1822 m over 570 m with 42 gates (7.4 %), 1290 m over 380 m with 33.

**The gates.** Four flex poles in two pairs, a panel between each pair (about
0.75 m wide by 0.5 m high, its lower edge about 1 m above the snow, tearing
away from a pole that catches a racer): the turning pair and the outside
pair. Open gates 6–8 m between the inner poles, gates set down the fall line
8–12 m. Red and blue in turn (the jury may change a colour that does not
show against its background). Pine needles or dye lines mark the line and
warn of the jumps.

**Passing a gate**: both tips and both feet across the gate line — the
shortest line at the snow between the turning pole and the outside pole,
its original line still counting where a pole was knocked out first; with a
ski lost, the remaining tip and both feet. A gate missed disqualifies, and
the racer may not go on through the gates; a racer whose skis come to a
complete stop may not either (did not finish). The finish line is at least
15 m wide.

**The format.** ONE run — there are no official training runs. The racers
INSPECT the course after the jury, top to bottom, slipping down beside it or
side-slipping through the gates, never skiing through them or making
practice turns beside them, bibs on, off the course when the inspection
ends; free skiing the closed hill before the setting is recommended where
it can be done. (A super-G run is also a speed event's leg of a combined; a
two-run super-G is a youth format only.) At the top level one coach sets
the course with the race director, the jury approving it.

**The start.** An interval start, normally 60 s apart, never under 40 s
(longer gaps and television breaks at the top level); the start clock's
countdown, the poles planted ahead of the line and the push off them only,
the clock started by the leg below the knee crossing the line, a start valid
5 s either side of the racer's time; the start ramp built so he can stand
relaxed and reach speed quickly. At the top level the ten best-ranked are
drawn into bibs 6–15, the next ten into 1–5 and 16–20.

**Safety.** The homologation inspector places the A-nets, the B-nets and the
air mattresses on a speed course; no number is set (the downhill's figures
above). No limit is set on a jump's take-off or length; a landing's load is
driven by the take-off angle, the speed and the landing's steepness, and
the remedy is the take-off or the approach speed [23]. Super-G injures 11.0
racers a thousand runs, against 17.2 in downhill, 9.2 in giant slalom and
4.9 in slalom [24].

**Jumps.** ~2.3 a run against the downhill's 4.2, only ~21 % shorter and ~6 %
less airtime [12].

**The field.** Top-level sheets: winners in 1:20–1:38 (a youth race's 1:04),
second +0.01 to +0.6 s, tenth +0.5 to +1.7 s, thirtieth +2.5 to +5 s (+8.2
on a hard women's course); 5–37 % of the starters out of it, 10–30 % the
common case — a run skied blind loses racers to the line as often as to a
fall. A run as skied [9]: 93 ± 10 s, 41 turns of 2.28 s, 79 % of it turning,
~16 % tucked, ~20 % straight; ~86 km/h on the mean, ~110 at the top, 2.6–2.8
body weights at the peak.

**Timing and television.** No number of intermediates is set; top-level
sheets carry three or four, and championship sheets a speed through a trap;
lower-level sheets neither. A top production runs some thirty cameras on
scaffolds along the slope, each following its own stretch, slow-motion and
ultra-slow-motion cameras, wireless cameras at the start and the finish,
and at championships cable cameras, cranes, a helicopter and drones chasing
the racer; the cut runs from the start house down the course camera by
camera to a camera facing up the slope at the finish and the leader's area.
Spectators fill the finish arena and gather at the jumps and the key turns
where they can be reached; the rest of the course is closed *(press
reports)*.

**The skis.** Men at least 2.10 m (2.05 at a lower level) and 45 m of
sidecut, women 2.05 m (2.00) and 40 m; the current edition also caps the
length, at 2.18 m for men and 2.15 for women; youth 1.83 m and 30 m;
masters may ski a giant slalom ski. Waist at most 65 mm, shoulder 95 mm (a
giant slalom ski's may be 103), the tip raised at least 30 mm (50 on a
giant slalom ski), the tail at most 10; the stand from the base to the
boot's sole at most 50 mm; a ski with its plate and binding at most 5.1 kg
for a man (5.3 a downhill ski) [26]. Race stock as the makers publish it:
men's 2.10–2.13 m (a lower level's 2.05–2.08, women's 2.05–2.07) on 45–45.5
m (women's and youth 40), widths 93.5–95 / 65 / 78–81 mm, a wood core
under three sheets of metal with full sidewalls, full camber or a slight
early rise in the shovel only, the metal stopped short of the shovel so
the tip and tail flex softer than the middle; the ski ~2.3 kg alone, a
plate 0.6–0.8 kg and a binding 1.2–1.6 kg, ~4.3–4.9 kg a ski in all
*(makers' specifications)*. Between its neighbours it is quicker edge to
edge and easier to tip than a downhill ski and steadier in a tuck and on
the straights than a giant slalom ski *(trade press)*; top racers keep a
quiver of each. Poles are bent round the body in a tuck and longer than a
slalom pole. The game's super-G pair is the **Falcon** (`defs/skis.ts`):
2.10 m, 45 m, 94 / 65 / 79 mm, stiff, no rocker, on a plate, the speed
events' bent poles — built to the men's least, as the giant slalom and
downhill pairs are, and the pair its field races (`SUPER_G.skis`).

**In the game** (R33, `engine/mapgen/super-g.ts`): the ski area's course
with the most vertical — the downhill's hill — its START LOWERED down the
piste until the drop to the finish is 600 m at the most, prepared as a
downhill's (`course-prep.ts`: kickers levelled, groomed hard, combed, its
crests shaved to 65 m of radius for a super-G's 25–28 m/s); its jumps its
drops and the crests a racer leaves the snow on; ~42 gates on 600 m (at
least 7 % of the vertical, ~49 m apart, strayed off the even spacing by a
rhythm dealt off the seed), none within 25 m before a jump nor 45 m after
it; a RACING LINE that bends the least inside the piste, held within 5 m of
its middle, SWUNG 2.5–5.5 m to each gate's side in turn — never tighter
than a 50 m bend, a third at the first gate, less on a gentle stretch, a
third before a jump — each gate 8 m between its inner poles, red and blue,
its turning pole 3.5 m inside the line's apex; A-nets along both edges; a
speed trap and three intermediates; ONE run under the strict gates, the
field dealt about par to a super-G's spread and outs (`field.ts`'s
`SUPER_G_FIELD`), the super-G technique row and the downhill's
line-follower read closer (`sim/downhill-steer.ts`'s `SUPER_G_STEER`). The
bot finishes ~95 % of generated seeds (38 of 1–40); its misses are gates
where it runs 3 m inside the line at 100+ km/h.

**Where the game is narrower than the sport**: the line is a swing of half
cosines between gate apexes, so its turning poles stand closer across (some
8–10 m between two) than the measured 13 m, and it passes 3.5 m outside the
turning pole where a racer brushes it; the swing eases on a gentle stretch
for the downhill ski, which carves no super-G turn at 40 km/h; no gate is
set down the fall line, no combination, and no B-net; no inspection is
skied; the course takes the downhill's hill rather than one of its own
where the area has a run in the band.

Sources (continued): [25] doi:10.1038/s41598-021-83133-z ·
[26] the international equipment rules for alpine competition, 2024/25
and 2026/27 editions.

## The jury's weather (every discipline)

A race is only run in the weather its jury allows. In the sport's rules the
jury may hold a race for the course crew, interrupt it while the weather or
the snow is unfair or inconsistent (restarting it only once a fair race can
be assured, and calling it off when the same reason stops it twice, or when
a run would last past four hours), lower the start, shorten the course, or
call the race off beforehand when the snow is unfit. The alpine rules set
**no wind speed**: strong wind sits beside heavy snowfall, high humidity and
heat in the list of weather that lets the jury postpone or cancel, and heavy
snowfall and storm are named among what makes a homologated downhill course
unfit on the day. What juries do in practice is on the record: top-level
downhills have had their start lowered, been held and then called off at
gusts of some **65–72 km/h at the top** of the course *(press reports)*.
**Speed skiing is the one discipline with a number**: an anemometer at the
course's edge level with the top of the timing zone, windsocks visible from
the start, and a run stopped at **15 km/h** of wind — **10 km/h** where the
expected speed is 200 km/h and more, **20 km/h** for a steady wind straight
down the track — restarted only once it drops back under. The ski cross's
rules let the officials interrupt or cancel for wind without a number.

The game's jury (`JURY` in `engine/game/defs/modes.ts`, applied by
`engine/game/jury.ts`'s `juryDay`) reads the strongest GUST at 10 m over the
course's START gate — where the anemometer stands, high on the mountain where
the flow is fastest (`exposureAt`), every swell of the gusts at its crest
(`GUST_PEAK`) — and a day whose gusts would pass its row is a race held for a
calmer hour: the same sky, its wind eased to the row, its bearing kept.

| Discipline | Strongest gust at the start | Heaviest fall | Why |
| --- | --- | --- | --- |
| Slalom, giant slalom | 60 km/h *(est.)* | any | slower, barely off the snow; raced in falling snow — the course crew packs or clears what falls during the race |
| Super-G, downhill | 50 km/h *(est.)* | a steady fall (0.75) | below the gusts that held real speed races; flown off crests at over 100 km/h; not run in a storm |
| Ski cross | 50 km/h *(est.)* | a steady fall (0.75) | its jumps, taken four abreast; as a speed race |
| Speed skiing | 10 km/h | flurries (0.3) | its own rule's strictest reading (200 km/h and more); its racers must see the track to its end |

A storm whose fall is eased is the steady fall it has become. On a race the
SNOW is the jury's too: the course is groomed hard from the house to the end
of the run-out whatever drift lay across it (`course-prep.ts`), side-slipped
clean before every racer (`GameState.fresh` is 0 when each run — a training
run, a slalom's first and second — is stood up), and the snow that falls
during the racer's own run is all that lies on it: at a storm's full fall,
8 cm an hour, under 3 mm over a two-minute run (`tests/jury_test.ts`).

## Ski cross

Restated from the ski-cross chapter of the international snowboard,
freestyle, freeski and ski-cross competition rules (the spring 2025 edition:
the field of play, the start device, the gates, the heat, the interference
articles, the formats, the start commands), the same federation's
equipment specifications for those sports, its 2024–25 article on how a
ski-cross course is designed, and the general literature on the sport. The
one discipline whose racers are on the course TOGETHER: four (on some
formats six) start side by side out of one gate and race head to head down
a built course of turns, jumps and rollers; the first two over the line go
through.

**The course** [31, 32] (the top level's recommendations):

| | Top level | Lower levels |
| --- | --- | --- |
| Length | 800–1300 m | at least 600 m, 450 m |
| Mean angle | 7–11° (about 12–20 %) | 5–11° |
| Vertical drop | 100–250 m | at least 60 m, 45 m |
| Track width (mean) | 20 m | |
| Course width | 6–16 m, by format and level | |
| Start to the first direction change | 100 m | 80 m, 60 m |
| Start platform | at least 6 m long, 12 m (±4) wide | |
| Finish line | 15 m (±5) wide | |
| Finish area | 60 m (±10) long, at least 30 m wide | |

The course "must allow competitors to complete a course with features as
speedily as possible", with overtaking chances from start to finish: BERMS
(banked turns), ROLLERS, JUMPS and other freestyle terrain, the natural
relief (gullies, changes of pitch) worked in. It is entirely FENCED, its
lateral edges marked in blue paint, the jumps' take-offs and landings painted
at the jury's word, the finish line a straight red line between two posts. A
flatter layout gives the setter more room for features; one course can run
six seconds faster or slower on the day's snow and weather [32]. *Feature
sizes (est., the rules set none):* berms banked some 30–45° on a radius of
15–30 m; rollers 0.6–1.5 m high, 8–16 m crest to crest, in series of three to
six; jumps (tables and kickers) with a lip 1.5–2.5 m over the landing's line —
"big air" features up to 5–7 m high on the biggest courses — flown 15–35 m;
STEP-DOWNS, a take-off onto a landing a few metres lower; a FINISH JUMP on the
last straight.

**The gates** [31]. A ski-cross gate is one short flex STUBBY pole (the
turning pole, under 45 cm over its hinge) and one long rigid OUTSIDE pole
joined by a TRIANGULAR FLAG (a base of 1.0–1.3 m, its long side 0.8–1.1 m
high, its short side 45 cm), in two colours. Gates stand at right angles to
the line, on BOTH SIDES of every feature — the rollers, a jump's take-off —
and of the finish; in a turn, banked or not, a single turning gate on its
inside and no outside gate; never in a blind spot such as a landing.
Numbered top to bottom; the start and the finish are not gates. A gate is
passed when both ski tips and both feet cross its line — between two
turning poles where two gates stand. A gate missed, a ski lost, the course's
boundary left or a complete stop is a DID NOT FINISH; a racer who missed a
gate may no longer go through the gates after it, nor climb back.

**The start** [31]. A START DEVICE in the middle of the course: one door per
racer, all opening together, none a racer can open or hold shut; the
platform built so a racer stands relaxed in the gate and reaches race speed
quickly — the racers hold HANDLES and catapult themselves out, pulling and
then skating. The commands of a heat: "proceed to the start gate", "enter the
start gate" (about 30 s before), "skiers ready", "attention" — and the doors
drop at a RANDOM moment 1–4 s later, with no word (an electronic release is
mandatory at the top level). A FALSE START is no longer a jump of the gun: the
closed doors hold every racer, and a racer is sanctioned only for
manipulating the device or for his skis crossing the start line before the
doors open; a gate that sticks or opens unevenly is a re-run. A TIMED run
(the qualification) is started like an alpine racer's: "10 seconds", 5 to 1,
GO, at intervals of 20–60 s, and timed from the leg breaking the beam or the
door opening. Lanes in a heat are CHOSEN in qualification order — the best
seed first; four jerseys mark the seeds (red, green, blue, yellow, by the
heat's seeding).

**The format** [31]. A QUALIFICATION, then a knock-out. The qualification is
usually one TIMED run alone (by time; a tie goes to the racer who started
later), or heats of its own on bigger formats; the best 32 — 16 where fewer
start — are seeded into a BRACKET of heats of four (rounds of 128, 64, 32,
16, 8 and 4; or of six). In each heat the FIRST TWO GO THROUGH. The semi-
finals' third and fourth race the SMALL FINAL (fifth to eighth), its first
two the BIG FINAL (first to fourth). The rank in a heat is decided by the
first part of the body over the line (a finish camera is mandatory); a tie
before the finals goes to the better qualifier, and in a final stays a tie. A
racer who DID NOT FINISH is ranked by how far down the course his correct
passage went — the more gates taken, the better — and one who is in the first
two still goes through; RANKED AS LAST (a yellow card) is last of his heat
and out; a tie among these goes to the better qualifier. At least one
training run on the day, after an inspection slipped through the course.
Intermediate times every 20–30 s at the top level, for information.
*Run times (est.):* a heat on a top-level course runs some 40–80 s; speeds
reach 60–80 km/h and, on the fastest courses, 100 km/h [32].

**Contact** [31]. "Contact in ski cross is common", and every action in it a
deliberate race decision; the jury judges INTERFERENCE — a hand or an arm
pulling, pushing or blocking; contact from the side or from BEHIND; a line
deviated into a rival — as intentional or involuntary, and by whether it
gained the offender something and changed another racer's result: an official
WARNING (involuntary, no result changed; a second one is a yellow card), a
YELLOW CARD, ranked as last (involuntary but a result changed, or intentional
with none changed), a RED CARD, disqualified (intentional, and another's
result changed). Every card is decided before the next heat starts and is
not open to protest. A racer stopped by interference stops at once and
reports; a re-run is never granted on interference alone.

**The skis** [31]. The rules set NO length, width or radius for a ski-cross
ski — only a working release binding, ski stoppers, and a binding plate at
most 50 mm high. In practice *(est.)* the class is a GIANT-SLALOM-TYPE race
ski, a little shorter and more forgiving: some 1.80–1.95 m, a 21–27 m arc of
sidecut, a damp, stiff-tailed ski with a softer shovel for the landings and
the rollers, on a high plate.

**The technique** *(est., from coaching material)*: the START — a pull on the
handles, then three or four skating strides and a double pole, decisive
because passing is hard; the ROLLERS pumped — the legs absorbing each crest
and pushing down its back — or the crests taken in one jump from one back to
the next; the JUMPS absorbed low, kept short, the skis back on the snow as
soon as the landing allows (time in the air is time not accelerating); the
BERMS carved high or low, the inside line short and the outside fast; a
GLIDER'S TUCK on every straight; DRAFTING in a rival's slipstream and a pass
set up a feature or a berm ahead.

**Broadcast and the crowd** *(est.)*: cameras along the whole fenced course
— the start from the side and from behind, the first jump and its landing
side-on, a camera high over each big berm, a cable camera or a drone
(jury-approved) running above the pack, the finish jump head-on — the
picture follows the PACK, not one racer. Spectators stand along the lower
course and crowd the FINISH ZONE (its stands, the tower, the mixed zone) and
the last jumps, where the passes are made.

**The weather.** The rules let the officials stop the start for wind or fog
(the "start stop" and its yellow flags) without a number; the game's jury
takes a speed race's row (the jury's section above).

### What the game models

- **The course (R35)** is BUILT over a built map, its own line rather than
  the piste's — the map's `track` from then on. The stretch is the piste's
  600–1000 m (plan) whose course comes nearest an 18 % mean grade, the
  fewest drops across it and then the lowest; a seed of its own is built on
  the ski area's course at least 900 m long whose mean grade is nearest 25 %
  (`skiCrossCourseOf`). Down it: a 6 m level PLATFORM under four DOORS 2.2 m
  apart (12 m wide), a START RAMP cut to 55 % below them, a 100 m START
  STRAIGHT, then LEGS swung 16–26 m either side of the piste's line and
  80–120 m apart, every corner rounded to 22–32 m and a BERM wherever it
  turns past 20°, banked to 28° at the apex (half that on a sweeping one) —
  the research's 30–45°, eased for a racer who also turns on his edges. On
  the straights as many features as fit, dealt off the seed: ROLLERS (three
  to five crests 10–14 m apart, 0.6–1.0 m high), JUMPS (a 1.3–1.6 m kicker
  up an 8 m ramp, a short level table and a 28–32 m landing dug 1.5 m under
  the line) and STEP-DOWNS (the line raised 1.6–2.4 m over a 40 m approach
  to a short lip); a jump on the start straight and a FINISH JUMP on the
  last. The course is 14 m wide, graded to its profile, groomed, FENCED
  1.5 m outside its edges (a racer driven into it is out of the course, as
  into a downhill's A-nets), its trees cleared for 12 m. Its courses come
  out 800–990 m over 130–200 m at 15–22 % *(measured on the race maps)*.
- **The jumps are shorter than a real course's.** The race's flight gravity
  (1.5 g, the arcade's) and its 45–60 km/h throw a racer 9–15 m off a jump
  shaped to land him on its slope; a real one flies 15–35 m at its speed in
  real air. Every jump lands the bot clean on every race map. The rollers
  sit 14–16 m crest to crest, the long end of the measured band, so a racer
  carried onto a series at 65 km/h and more is not thrown from one crest
  onto the next one's face; it still happens now and then (once on the nine
  race maps, a set of rollers at the end of a long straight).
- **The gates** are triangular flags: a TURNING GATE on every berm's
  inside, a CORRIDOR GATE across the course before every feature, none in a
  landing. Passing is the rule's — both feet through — and a gate missed is
  a DID NOT FINISH.
- **The format** is the rule's knock-out folded to sixteen: a timed
  QUALIFICATION alone against a board of twenty-nine dealt about par (the
  bot's own clean run; the field some 4–5 % deep, a fall now and then),
  the best SIXTEEN seeded into four QUARTER-FINALS (1-8-9-16, 4-5-12-13,
  3-6-11-14, 2-7-10-15), two SEMI-FINALS, the SMALL FINAL and the BIG
  FINAL, the first two of each heat through. The player SKIS his heats; a
  heat he is not in is dealt off the race's seed — each racer's skill on
  the start list, the day's noise, a fall or a card now and then — so a
  bracket is the same every time it is raced to the same results. The
  final ranking: the finals' places, the quarter-finals' thirds 9–12 and
  fourths 13–16 by qualification, the rest by qualification.
- **A heat**: "skiers ready", "attention" 1.6 s later, and the doors drop at
  a moment dealt 1–4 s after it with no word — a racer cannot anticipate
  it, so there is no false start to judge, as with the rule's closed
  device; the tuck held pulls him out over the ramp. His three rivals are
  the start list's own, their paces their skills, their reactions 0.12–0.3
  s, each in his door's lane, closing onto the course's line over the start
  straight and pulling out to pass a slower racer close ahead. Ranked by
  the order over the line; a racer who did not finish by the gates he took,
  and through if that is in the first two.
- **The draft**: a racer tucked in behind a rival — within 6 m of him down
  the course and 1.2 m across — has up to 30 % of his frontal drag taken
  off, the most a metre behind *(est.: a body in another's slipstream; the
  share is the cycling and speed-skating literature's order, not a
  measurement on skis)* — so the racer behind pulls up on a straight and
  sets up his pass. At a ski cross's speed the air is a third or more of
  what holds a racer back, which is why the pack bunches on the glides.
- **Contact**: every shoulder pushes the two apart, shared by their weights.
  One past 0.38 of what a trunk on the shoulder takes puts the racer it
  lands on DOWN (the racer behind braced for it, 1.6 times as much); a
  knock-down from BEHIND is the RED CARD for the racer behind,
  disqualified — the rule's intentional interference that changed another's
  result. The yellow card and the warning are not modelled.
- **The pair** is the Wolverine: a giant-slalom-type ski cut down, 1.88 m
  on a 68 mm waist and a 24 m sidecut, a softer shovel, on a race plate.
- **The technique**: a giant slalom racer's carve through berms (the edge
  at the shared rate, up to 64°, held to 70 km/h), crossing under on the
  flat. Pumping the rollers and absorbing the jumps low are the player's;
  the bot rides them.

Sources (continued): [31] the international snowboard, freestyle, freeski
and ski-cross competition rules, spring 2025 edition (the ski-cross
chapter), and the federation's equipment specifications for those sports,
2022–23 edition · [32] the federation's 2024–25 article on the science of
ski-cross course design.

## Speed skiing

Restated from the international speed-skiing competition rules (the autumn
2025 edition: the categories, the track, the timing, the equipment, the
programme and the jury), the 2025 top-level tour's result sheets, a 2024
CFD and wind-tunnel study made with a national speed-ski team, and the
snow-friction and aerodynamics literature listed at the foot. Straight down
the fall line as fast as a body can go: no gates, no turns, and the result a
SPEED.

**The categories.** The top class (S1) races on speed-skiing equipment of its
own — the only class that scores the tour's points and the world titles; a
second class (S2, once the "production" class) races on downhill equipment
and feeds the first; a junior class races as the second. All race on the same
days on the same track, in groups by class and sex. A racer comes to the top
class from the second, or with points in an alpine or ski-cross ranking.

**The track** has three zones, top to bottom:

- **The launching area** — at least three fenced START POINTS with waiting
  areas, a neighbouring pair no more than 15 km/h apart in the top speed
  they give. Typically 300–400 m long (the start "300–400 m above the first
  timing light"); top speed comes in under 400 m. On the two fastest tracks
  the launch runs some 800–900 m.
- **The timing zone** — the last 100 m of the competition track.
- **The run-out** — "long enough for the speeds reached", its slope
  DECREASING PROGRESSIVELY. No braking and no turning before the line that
  ends it.

Real tracks *(measured profiles)*: the record track 1400 m long over 435 m
of vertical, its steepest 98 % (45°) and its mean 52.5 %, the launch some 900
m and the braking 500 m; a second track past 250 km/h 1740 m over 565 m, its
steepest 76 %, a launch of 800 m and a braking zone of 840 m; a slower track
215 m of vertical at a 55 % mean with a braking slope of 13.9 % over 325 m;
the smallest 80 m of vertical, a 110 m launch and a 100 m run-out. A typical
track is about a kilometre: 300–400 m of launch, the 100 m trap, ~500 m of
run-out. The racer sees 20–35° in the first ~15 s, then the slope flattens
steadily: **the trap itself lies on only 5–15°** — the speed is carried into
it from the steep, and at 255 km/h with a speed tuck the drag holds on about
11° *(est., arithmetic below)*. About thirty tracks exist; two are cleared
past 250 km/h, and a tour track must give at least 170 km/h.

**Width and margins.** The track is at least 30 m wide from 100 m above the
trap to the end of the run-out, narrower toward the top. A SAFETY MARGIN runs
along both sides, closed and clear of every obstacle: 25 m wide at the trap
and for 100 m either side of it on a course past 180 km/h (20 m below), never
under 3 m higher up. The jury, the coaches and television stand outside it.
It runs straight down the fall line and is prepared as smooth as it can be;
racers pick the smoothest line to the trap. It is groomed hard *(est.: no
rule on injection was found)*.

**The markings.** The launch area's sides marked in INTERMITTENT BLUE — broken
on purpose, to heighten the sense of speed; the timing zone's in red pennants
every 15 m, its end a RED LINE across the full width at least 50 cm wide with
red marks either side; the run-out's end a green (or blue, or red) line across
the full width, then marks every 15 m.

**The timing.** Photocells at the top and the bottom of the 100 m zone, a
second set just above each, the lower the reference, mounted low so a LEG
breaks the beam rather than a hand; two clocks reading to a thousandth of a
second. The cells stand at least 10 m outside the track behind a snow berm
no more than 80 cm high and 3 m long, on supports weakened to break away.
THE SPEED is 100 m over the time between the cells, shown to 0.01 km/h:
1.80 s at 200 km/h, 1.44 s at 250. Stretching the arms out leaving the trap
disqualifies.

**The format.** An optional training day, then the runs, each from a START
HIGHER than the last (about 10 km/h a round; one racer's training climbed
160 → 180 → 200 → 220 → 240 km/h before the top start): on an event below 200
km/h two runs on the first day and a SEMI-FINAL and a FINAL on the second; on
an event past 200 km/h two more qualifying runs. The first race run starts
low enough that the top class cannot pass 180 km/h (the second class 150; no
limit at a world championship). Run 1 goes in the last season's ranking order,
the best fifteen drawn among themselves; every later run in INCREASING ORDER
OF THE LAST RUN'S SPEED — the slowest first, the fastest last. After each run
the jury cuts the racers who showed too little: no fixed number — on a 2025
tour event past 200 km/h 32 men were classified, 20 skied all four runs, 4
stopped after three, 7 after two and 1 after one. A racer has 60 s after GO to
start. **The result is the FINAL'S speed alone**; the racers who did not reach
it rank below by their best speed. The tour's points go to 30 places.
*Measured fields (2025):* an event past 200 km/h, 32 men from 229.13 km/h to
the 20th's 215.53 and the last's ~187–195, 9 women 225.73 to 204.02; a slower
event on the same track, 27 men from 180.88 (the 10th 177.43, the 20th 169.73)
— the first four within 1.3 km/h; another round 32 men from 189.95 to 173.34;
a slow northern track 19 men topped by 159.82. Records: the top class 255.5
km/h (men), 248.27 (women), the second class 211.02 and 202.58.

**The equipment** (the top class; the second class races downhill skis of
210–225 cm, the downhill suit with its air-permeability test, no fairings):

- **Skis** 2.20–2.40 m long, at most 15 kg a pair with the bindings, no
  aerodynamic add-on, at most 10 cm wide; stiff and heavily damped to keep the
  tips down, run flat on the base, with almost no sidecut — "essentially
  impossible to turn". Bindings with working brakes, raised at most 2.5 cm,
  nothing faired over them.
- **Poles** at least 1 m long, at most 2 kg a pair, baskets compulsory, no
  straps, no aero parts; bent round the body to brace under the arms.
- **Boots** a standard model, at most 6 kg a pair, their cuffs worked for a
  sharp forward lean.
- **The suit** plastic-coated and essentially AIRTIGHT, so slippery it must
  be covered until the waiting area; underwear over the body and three
  quarters of the limbs, a back protector (or a ski airbag), nothing thicker
  than 4.5 cm, gloves.
- **The helmet** a full-face inner helmet under an optional aero shell that
  BREAKS OFF in a fall, the whole through a 40 cm circle, at most 2 kg;
  some carry a fin on top for stability.
- **Fairings** behind the calves under the suit, at most 1 kg each and 30 cm
  deep, pliable.

**The physics.** *Drag:* a top-class racer in the open is CdA ≈ 0.08 m² (the
study's baseline 0.0818; good to poor racers 0.06–0.09 on a frontal area of
~0.30 m², Cd 0.20–0.27; one racer back-calculated at 0.074), against an alpine
downhill tuck's 0.17–0.23 and 0.65 stood up [27, 28]; the lower legs are 40–50
% of a low tuck's drag, which is what the fairings are for; a tunnel rig in
place of the skis nearly doubles the number. Rules of thumb from the study:
−0.010 m² of CdA ≈ +7 km/h, −10 kg ≈ −4 km/h. The air is over 80 % of the
resistance at the trap [29]. *Friction:* measured μ 0.023–0.139 (mean ~0.054)
at 5–15 m/s, the fastest snow 0.026–0.037, rising on new snow with speed [30];
the study took 0.0005·v (≈0.035 at 70 m/s). *Air:* ρ ≈ 1.0 at the 2000 m and
more the fastest tracks stand at. *Mass:* the study's racer 90 kg with 15 kg of
skis, 6 of boots, 2 of helmet, 2 of poles and 2 of fairings — ~117 kg in all;
heavier is faster. *Time:* "under 15 s to 225+ km/h, the whole run about 20
s"; the claims of 0–200 in 6–7 s are optimistic (g·sin 45° alone needs 8 s).
*The trap's slope (est.):* at 255 km/h with CdA 0.08, ρ 1.01 and μ 0.02 the
drag is ~203 N and the friction ~23 N, held by gravity on ~11°.
*The run-out (est.):* stopping from 200 km/h in 500 m is ~0.3 g on the mean;
stood straight up at 216 km/h a racer would take ~1 g on his chest, so he
opens up GRADUALLY.

**Safety and the fall.** Braking and turning are banned until the run-out's
line; a racer stands up into the wind as his brake (below ~160 km/h at once;
at ~225 km/h he must untuck slowly "to dirty the aerodynamics"), then carves
very wide turns, and skids or snowploughs into the finish enclosure — the most
dangerous part of the run, racers say. A fall slides on the near-frictionless
suit: friction burns first, then concussion and broken limbs; one racer down
at over 200 km/h rolled onto his back protector and slid to rest near the
finish. The outer helmet and the timing posts break away. Four falls in 450
runs at a demonstration event.

**The technique.** Across the fall line in the start, then a jump round to
face down it and a push on the poles — no skating on a steep start *(est.)*.
The tuck: head low, SEAT HIGH to press the skis down, skis absolutely FLAT,
the hands in front of the helmet and, as the speed builds, some 20 cm ahead
of it as the leading edge and a rudder; forearms ~20–25°; the poles bent and
braced under the arms. Straight down the fall line, small corrections of
balance, the head and the hands steering; a crosswind managed. "The skis flop
wildly", the cells pass with a jet-engine roar. After the trap: arms in,
untuck progressively, brake past the run-out's line.

**Broadcast and the crowd.** Speeds and times on a BOARD at the bottom of the
track as each run ends — racers glance up at it while braking; the LEADER'S
BOARD (at least 2 × 2.4 m) behind the exit gate, the leader in front of it on
camera; television and the press in the finish area, outside the margins.
Spectators gather at the BOTTOM, where the racers have used about half the
run-out to slow before reaching them. Cameras *(est.)*: side-on and low at
the trap from behind the margin, a long lens from the run-out up the fall
line, one at the start, and onboard cameras where announced.

**The weather** (the jury's section above): windsocks visible from the start
and an anemometer at the track's edge level with the TOP OF THE TIMING ZONE; a
run stopped at 15 km/h of wind, 10 km/h where the speed expected is 200 km/h
and more, 20 km/h for a steady wind straight down the track. Good conditions
last about an hour and a half of a day, February to April; records are some
60 % track and weather.

### What the game models

- **The track (R34)** is cut STRAIGHT down the fall line of a built
  mountain, its own line rather than the map's piste: every column of the
  face and nine bearings within 20° of the fall line are read down the
  face, the ground across the track's 30 m taken to its mean along it,
  never rising, every crest cut round to 600 m of radius (a racer at 65
  m/s leaves the snow over anything tighter than v²/(g cos θ), some 480 m)
  and every knee filled to 350 m (some 0.9 g on the legs at 55 m/s), and
  held within 9 m of the ground. Down each line every start is skied by a
  point mass of the speed pair (its tuck to the trap, then stood up into
  the wind and skidding past the braking line, the skid the physics' own
  measured 0.13–0.28 g): the track is the line and launch (300–900 m along
  the snow) whose final comes nearest the speed that map's track is BUILT
  FOR — dealt off its seed between 185 and 235 km/h, so one track is a slow
  one and another a fast — its trap on a gentle stretch, its run-out no
  longer than 800 m where it can be, then the least graded. A 25 m margin
  is cleared of trees either side, and the finish enclosure at the
  run-out's foot. Real tracks put the trap on 5–15°; the game's faces are
  concave, so its traps lie on 14–31 % — a little steeper *(est.)*.
- **The format** is the programme folded to TWO runs: a QUALIFICATION from
  a start lowered down the track until it gives 12 km/h less (inside the
  15 km/h a neighbouring pair of start points may differ by), and the
  FINAL from the top for the best twenty, in increasing order of the
  qualification's speed; the final's speed is the result. The game's board
  of the final carries the finalists alone.
- **The pair** is a speed ski of its own (the Peregrine): 2.40 m, under 10
  cm wide, a ~285 m arc of sidecut, 27 kg of kit, the airtight suit and
  fairings' 0.08 m² of tuck and 0.6 m² stood up; its racer the catalog's
  80 kg skier, the heavy build the class's heavy men. Its documented top
  speed is the terminal one (316 km/h on the 20° pitch), which no track
  is long enough to reach.
- **The technique**: the skis held flat, 20° of edge at the most and
  rolled at a fifth of the shared rate — the small corrections a speed
  skier makes; a full edge at 200 km/h is a wide arc, never a turn.
- **The clock** runs from the timing zone's top line to its bottom line,
  each crossing read to the fraction of the step it fell in (a step is
  half a km/h at 200); the board, the plate and the record book keep that
  time, and every one is shown as the speed it is.
- **Par** is the clean run SKIED: the engine itself takes the racer out of
  the house in a full tuck, straight, in the race's own weather, its wind
  and its new snow, to the zone's bottom line — a profile walked by a
  point mass missed the compressions and the wind by up to 3 %, where the
  race is decided by tenths of a km/h. The field's best come through a
  hair under it; the bot runs within 0.2 % of it on every map.
- **The run-out**: past the zone a racer home UNTUCKS over 120 m (stood
  straight up at 200 km/h the air takes 0.9 g off him, the ride lab's
  `speed-stand`), rides the wind stood up and skids only past the BRAKING
  LINE 150 m on, under 144 km/h; the run-out stops him some 450–550 m past
  the zone on the race maps.

Sources (continued): [27] the international speed-skiing competition rules,
autumn 2025 edition, and the 2025 tour's result sheets · [28] a 2024 CFD and
wind-tunnel study of the speed-skiing tuck made with a national team;
doi:10.3390/proceedings2060310 (the alpine tuck's drag) · [29]
doi:10.1046/j.1460-2687.2001.00072.x · [30] doi:10.3389/fmech.2021.728722.
