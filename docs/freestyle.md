# The trick disciplines

What each JUDGED freestyle format IS, as the sport runs it: the field of
play, the format, the judging and what a skier's body does in it — the
RESEARCH the trick modes will be built on, the way `docs/disciplines.md` is
the research the race disciplines stand on. Nothing here is built yet: the
working specs are `docs/specs/TRICK_MODES.md` (what every format shares)
and one spec per format beside it. This page outlives them.

How the research is recorded here is `docs/disciplines.md`'s rule, restated:

- **Numbers, not names.** The competition rules are restated in our own
  words and numbers — never copied, never quoted — and no real contest,
  venue, governing body, product or person is named (the repo is public;
  the rule is in `AGENTS.md`). A trick is named by the generic words the
  sport uses for it (a cork 1080, a back full, a 270 on), never by the
  rider who first threw it.
- **Every number carries its source,** a bracketed number resolved at the
  foot of the page; a figure that is our own estimate is marked *(est.)*.
- **Written once, here.** A spec quotes this page; it does not keep a copy.

| Format | Kind | Built on | State |
| --- | --- | --- | --- |
| Ski jumping | distance + style ± wind and gate, two rounds | a jumping hill of its own | BUILT (R43) — spec `SKI_JUMPING.md`; first and lit on the tricks card |
| Halfpipe | judged runs, best run counts | a pipe of its own | BUILT in part (R39) — spec `HALFPIPE.md` |
| Slopestyle | judged runs, best run counts | a course of jumps and rails | BUILT in part (R38) — spec `SLOPESTYLE.md` |
| Big air | judged jumps, best two different | one jump | RETIRED for ski jumping; its straight venue (R37) stays under slopestyle, the halfpipe, moguls and aerials |
| Aerials | scored jumps × degree of difficulty | a jump site of its own | researched — spec `AERIALS.md` |
| Moguls | turns + air + speed, one run | a mogul course | BUILT in part (R40) — spec `MOGULS.md` |

## Ski jumping

A skier rides a steep IN-RUN in two cut tracks, springs off a short
downward-sloping TABLE at about 90 km/h and FLIES the slope below — a
hundred metres and more, three or four metres over the snow, for four to
five seconds — on the lift his body and his skis make spread in a V, and
lands in a TELEMARK. Scored on the DISTANCE he flew, measured to the half
metre, and the STYLE five judges see, with points given or taken for the
wind he flew in and the gate he started from. Not a park format and not
an impression: a formula over a measured hill.

**The hills** [70, 71]. A hill is named by its HILL SIZE, HS — the distance
from the edge of the take-off to the end of the landing area, the point L —
and built round its CONSTRUCTION POINT K, at a distance w down the slope:

| Class | HS | w (to K) |
| --- | --- | --- |
| Small | up to 49 m | up to 44 m |
| Medium | 50–84 m | 45–74 m |
| Normal | 85–109 m | 75–99 m |
| Large | 110–149 m (the norm's band ends at 145) | 99–130 m |
| Giant (new) | 150–184 m | — |
| Flying | 185 m and over | 166 m and over |

A large hill may drop no more than 88 m from the take-off to the lowest
point of its out-run; that and the 1.8 g the transition may load a jumper
with cap a large hill near w ≈ 130 m, HS ≈ 145 m [71]. A normal and a large
hill built side by side differ by at least 25 m of HS [70]. The top series
and the championships jump a normal hill of ~HS 106 (K 95) and a large hill
of ~HS 140 (K 125); flying hills reach HS 240 and more.

**The profile** [71, 72] — every element, and how the norm derives it (all
lengths in m, speeds in m/s, angles in degrees). The two free choices are w
and the hill's STEEPNESS, the ratio h/n of the height h and the horizontal
distance n from the take-off to K; the TABLE ANGLE α then fixes the speed
v₀ a good jumper needs to reach K in calm air, and the slope at K, β,
follows from the landing impact allowed there.

| Element | Rule or approximation |
| --- | --- |
| HS against w | HS = w / 0.9 (2018); HS = w + l₂, w ≈ 0.885·HS + 1.5 (2012) |
| In-run angle γ | at most 37°, 35° recommended; at least 30° for w ≥ 90, 25° below; a straight part, a cubic-parabola transition, the table |
| Table angle α | w/30 + 6.9 ≤ α ≤ w/30 + 7.9 (the design value w/30 + 7.4); a flatter table flies higher — ±0.5° moves an HS 145 flight's height between 3.3 and 3.7 m |
| Transition radius at the table, r₁ | 0.14·(v₀ + 0.95)²; the load there at most 0.7 g over the weight |
| Table length t | 0.25·(v₀ + 0.95) |
| Table height over the knoll, s | 0.025·w, at least 0.70 m, never past w/40 |
| In-run length, top gate A to the edge, e₁ | ≈ 92.3 − 1.517·γ + 0.426·HS — enough to reach K in a 3 m/s tail wind on a fast ice track |
| Lowest gate B to the edge, e₂ | ≈ 67.3 − 0.944·γ + 0.331·HS — short enough that a good jumper stays short of L in a 4 m/s head wind |
| The gates | numbered from 1 at the bottom, equally spaced, no more than 0.40 m of height apart |
| Steepness h/n | w/800 + 0.400 ≤ h/n ≤ w/1000 + 0.480 |
| h, n | h = w·sin(atan(h/n))/1.005, n = w·cos(atan(h/n))/1.005 (a distance is 1.005 × the chord) |
| Speed landing at K, v_K | ≈ 0.68·v₀ + 12.44 |
| Landing radius r_L (P to L, an arc open upward) | v_K²·w/380, at least v_K²/8, to ten metres |
| Slope at P (the steepest point), β_P | β + 0.5·α − 2.5, never past 37° |
| Slope at the knoll's foot, β₀ | β_P / 6 |
| Slope at L, β_L | β − (1.4/v_K)·(180/π); typically 32° on a normal hill, 31° on a large one, 28° on a flying hill at HS [84] |
| Length P–K, l₁; K–L, l₂ | l₁ = r_L·(β_P − β)·π/180; l₂ = 1.4·r_L/v_K |
| The knoll, the take-off's foot to P | a cubic parabola, so the flight to K peaks about half way |
| The transition L to U | a parabola, its radius r₂L at L and r₂ at U free between r_L and v∥²/(18 − 10·cos β_L); the load at most 1.8 g |
| Out-run length a (level) | ≈ 18.9 + 1.113·w − 0.00482·w², at least 45 m (a second's run, 4.8 m/s² down to 18 m/s, a 20 m stop) |
| Widths | in-run 2.5 m between its rails (w > 100); at the knoll's foot 0.06·w, at K 0.20·w, at U 0.22·w |
| Judges' tower | 0.6–0.8·w along the axis from the edge, 0.25–0.5·w out from it |
| The tracks' friction | an angle of 1° on ice or ceramic tracks, 3° on snow |

The worked normal hill the 2012 standards give [72]: HS 100, w = 90,
h/n = 0.55, α = 10.5°, γ = 35°: v₀ = 24.25 m/s, β = 33.0°, β_P = 35.5°,
β_L = 30.2°, r₁ = 89 m, t = 6.3 m, r_L = 200 m, h = 43.2 m, n = 78.5 m,
v_K = 29.0 m/s, l₁ = 8.7 m, l₂ = 9.7 m, e₁ = 84 m, e₂ = 71 m, a = 79 m, the
landing 18 m wide at K. Two hills of the classes the top series jumps, off
their published certificates [75]:

| | Normal, HS 106 / K 95 | Large, HS 142 / K 125 |
| --- | --- | --- |
| In-run (longest) | 87.3 m at 35° | 96 m at 35° |
| Table | 6.1 m at 11°, 2.38 m high | 6.9 m at 11°, 3.2 m high |
| Slope at K | 34° | 34.7° |
| Speed at the take-off | 88.6 km/h | 94.3 km/h |

**What a ski jumping hill IS on the ground** [70, 72, 84]. A START TOWER
(often a steel or concrete tower over the top of the in-run, with a lift
or stairs) holds the START GATES: a numbered row of crossbars over the
track — the jumper sits on the bar (the STARTING BAR), feet in the tracks,
and pushes off when the light goes green. The IN-RUN is a narrow ramp with
50 cm guard rails, its two TRACKS cut in ice or laid in ceramic (porcelain)
profiles, refrigerated on the big hills; the in-run speed is measured by two
photocells 8 m apart, the second 10 m before the edge, 0.2 m over the
snow. The TABLE ends at the EDGE; beneath it the KNOLL falls away. The
LANDING HILL is groomed snow (on mats in summer) between guard rails at
least 70 cm high from 0.1·w down to U, the DISTANCE MARKINGS on both sides
every metre from 0.5·w to 5 m past HS, the P POINT marked by a BLUE line
down each side and the K POINT by a RED one, the HS point marked again;
coloured lines and spruce branches laid across the slope give the
jumpers and the measurers a scale *(the colours of the cross lines vary by
hill)*. The broadcast lays a virtual line across the slope at the leader's
distance [81]. Wind instruments stand beside the slope at flight height at
the take-off, at about half of K and at about K, and at least EIGHT WIND
FLAGS or socks down each side [70]. The JUDGES' TOWER stands beside the
landing hill, its five cabins stepped to follow the flight. Two COACHES'
PLATFORMS stand at least 12 m off the axis, one over the take-off and one
over the landing (twenty coaches each, forty at the top events) — the
coach there waves the jumper off with a flag. The OUT-RUN levels into an
ARENA closed by 1 m boards, with the leader's box, the stands and the
crowd round it; a chairlift takes the jumpers back up; floodlights for an
evening contest.

**The jump** [76, 77, 85, 86]: about 25 m/s (90 km/h) at the take-off of a
normal hill, 26–26.5 m/s (94–95 km/h) on a large one and ~28.5 m/s
(100–105 km/h) on a flying hill. The in-run is ridden in a deep crouch;
the TAKE-OFF is an explosive extension of the legs on the last metres of
the table lasting about 0.25–0.3 s, with a peak ground force near 1,200 N,
which adds 2–3 m/s at right angles to the table (2.5 m/s representative)
and sets the forward rotation the body needs to lean out over the skis —
too early and the push is spent on the table, too late and it is lost off
the edge. The skis are drawn up into the V within about half a second and
the flight settles: the skis at 20–45° to the air (about 30° most of the
flight, ~40° at the landing), the body 0–20° above the skis, the hips near
160°, the V opened 25–35° *(est. 30°)*, arms back along the body. The
lift-to-drag ratio rises from about 0.7 at the take-off to about 1.2 from
one second on [77]; a simulated 134 m large-hill jump carried ~80 N of lift
and of drag off the table and ~430 N of lift and ~360 N of drag at the
landing, at 32 m/s [77] — at sea-level air, LIFT AREAS of ~0.7 m² and DRAG
AREAS of ~0.6 m² late in the flight *(our arithmetic from those figures)*,
~0.2 m² of drag area in the in-run crouch. Of the aerodynamic force about
60 % acts on the body and 40 % on the skis; an isolated ski's best V is
about 30°, a full model's best lift-to-drag (1.55) at 22.5° of V with the
ankles at 20° [80]. The flight peaks ~3–4 m over the slope about half way
to K [71]; a K-point jump on a large hill takes about 4.5–5 s, a normal
hill's about 4 s, a flying hill's 7–8 s *(est.)*. He lands at ~29–32 m/s
with a normal velocity of 3–4 m/s (7 m/s at most [86]) — an EQUIVALENT
FALL HEIGHT under a metre at K [85], growing to the limit the norm sets at
L; the landing loads him 1.5–3 times his weight [77].

**The landing** [70]: from a stable flight he raises the head and trunk,
brings the arms forward and the skis parallel, and just before the tails
touch SPLITS THE LEGS AND BENDS THE KNEES — the TELEMARK: one foot about a
foot's length ahead of the other, the back knee bent deeper, the skis
parallel no more than two ski widths apart with equal pressure on both,
the arms out forward; held for 10–15 m before he rises and runs out
through the transition past the FALL LINE. The distance is measured from
the edge to the point between his feet when both are fully on the snow, to
the HALF METRE (by measurers along the slope, or a video system); in a fall
to where his body first touches.

**The score** [70, 74]: DISTANCE POINTS — 60 at K (120 on a flying hill),
plus or less the METRE VALUE for every metre past or short of it:

| K | Metre value |
| --- | --- |
| 80–99 m | 2.0 points |
| 100–134 m | 1.8 points |
| 135–164 m | 1.6 points (the newest edition's band) |
| 170 m and over (flying) | 1.2 points |

STYLE POINTS — five judges each mark 20 in half points, taking off for
three groups of faults: the FLIGHT (at most 5: an unsteady or asymmetric
position, legs not stretched), the LANDING (at most 5; NO TELEMARK, feet
parallel, at least 2 by itself *(the edition read marks the minimum
between 2 and 3)*) and the OUT-RUN to the fall line (at most 7: unsteady
0.5–3, a hand back on the snow 4–5, a FALL before the fall line 7). The
highest and the lowest mark are dropped and three summed: 60 at most. A
clean telemark at K on a large hill: 60 + 3 × 18.5 = 115.5 points.

COMPENSATION (the wind and gate system) [70, 71, 74, 83]: the jury may move
the start gate during a round; a jumper started from a LOWER gate gets
points for every metre of in-run lost, a higher gate costs them (and a
coach who lowers his own jumper's gate gets them only past 95 % of HS). The
wind measured along the flight, its component along the hill averaged, is
compensated: a HEAD WIND (lift) costs points, a TAIL WIND earns them, the
tail's factor 1.21 × the head's. Each factor is the hill's own, defined at
the winner's distance (w + HS)/2: the gate factor a third of the distance
3 m of in-run buys, the wind factors a third of what ±3 m/s buys, × the
metre value. Off published sheets [74]:

| | Metre value | Gate factor | Head wind | Tail wind |
| --- | --- | --- | --- | --- |
| Normal hill | 2.0 | 7.00 points/m | 8.00 points per m/s | 9.68 |
| Large hill | 1.8 | 7.67 points/m | 10.80 points per m/s | 13.07 |

— 4.0 and 6.0 m of distance per m/s of head wind; the jury holds a
jumper on the bar until the wind is inside its window and may restart a
round from a lower gate when jumps pass 95 % of HS. A jump's score is
distance + style + gate + wind, never below zero; the competition's is
the sum of its jumps; a tie is a tie, the places shared.

**The format** [70]: two scored rounds and an optional TRIAL round before
them. At the championships and the top series a QUALIFICATION round cuts
the field to 50; the FIRST ROUND is jumped by all 50 (the order by the
standings, the best last); the best 30 jump the FINAL ROUND in REVERSE
order of their first-round score, the leader last; the total of the two
jumps wins. A jumper who falls past 95 % of the round's longest
(compensated) jump goes through anyway. The jumper has 10 s (10–15 s on a
two-phase light) to leave the bar after the green light; the start
interval is about 45–50 s [81]. A ski flying weekend jumps four rounds; a
team event four jumpers a team.

**The equipment** [73]:

- SKIS: at most 145 % of the jumper's height, at a BMI of 21 or more
  (weighed in underwear); below it the length falls 0.5 % for every
  0.125 of BMI (BMI 20.5 → 143 %). Running surface 95–105 mm wide at the
  balance point, tip and tail within 5 mm of each other, the sidecut
  straight lines — a nearly parallel ski, with no steel edges, its flat
  base grooved (grooves at most half its width, each at most 10 mm) to
  track; the tip turned up at least 40 mm, the tail at most 10 mm; each
  ski at least its length in cm as hundredths of a kilo plus 0.2 kg for
  the binding (a 2.55 m ski 2.75 kg). No fins, no aerodynamic covers.
- BINDINGS: mounted so that at most 57 % of the ski lies ahead of the
  boot's toe — the boot well back of the middle; the HEEL FREE to rise,
  held by a rear unit (curved rods or angled clips) that limits how far
  the ski hangs off the boot in the air, and a safety strap; a heel wedge
  of up to 20 mm, the sole and wedge 50 mm at most.
- BOOTS: soft, low and flexible, the shaft's forward lean never under 65°,
  the sole at most 40 mm.
- SUIT: nine panels cut to the body, 4–6 mm thick, at least 40 l/m²/s of
  air through it, 2–4 cm over the body's circumference (2–5 cm in the
  legs), the crotch no lower than the body's; a helmet, goggles, gloves.

**The jumpers** [78, 79, 82]: LIGHT. The top 50 of a recent season
averaged 178 cm and 65–66.5 kg, a BMI of 20.5–20.9 (29 of 50 under 21 all
season, only 8 on the longest skis); mean BMIs were 19.4–19.8 in the early
2000s, four units under 1970's, some as low as 16.4 — the reason the ski
length is tied to BMI. The rule cut the advantage of being light but did
not end it: in simulation, 1 % of BMI is worth about 2 % of ski area. The
flight models use 72 kg with the equipment [76].

**The camera** [81]: ten to twelve cameras. At the bar, a close-up with
the jumper seated; beside the TAKE-OFF, 5–7 m off it on a platform over it,
a long lens following him down the in-run and through the push in full
profile; the MAIN camera about two thirds of the way from the edge to K,
12–20 m off the slope, its lens at the height of his flight (3–4 m),
square to it, panning from the take-off to the landing so every marking on
the snow shows — the jump every viewer judges; a crane in the out-run for
the landing and the reaction; super slow motion beside the take-off and
low on the landing hill for the last third of the flight; a 60–80 m crane
BEHIND the tower (20 m over it) or opposite it for the flight from behind
or the front; rail and cable cameras ("fly-cams") and in-run speed cameras
by arrangement; mini cameras in the in-run's tracks. The inserts: the
athlete with the countdown at the bar, the in-run speed after the take-off,
the distance two or three seconds after the landing — none on a slow
motion.

## What every judged park format shares (halfpipe, slopestyle, big air)

The park formats' chapter of the rules is ONE chapter for skiers and
snowboarders alike: the same pipe, the same course and jump minimums, the
same formats and the same panels [1, 2]. Levels: A (the championships and
the top series), B (the continental series), C (national contests).

**The panel** [1]. A head judge who does not score, and at the top level six
to nine scoring judges (at least six on the top series; three at the lowest
levels). Each scores 0–100 in whole points. With six or more, the highest
and the lowest score are dropped and the rest averaged; with five or fewer
every score counts. Averages are cut (not rounded) to two decimals.

**The method is OVERALL IMPRESSION** [1, 3]: each judge scores the whole run
(or the whole jump) from the first move to the last, and against the other
runs of the contest — a score is a RANK made into a number, so the panel
keeps its own scale for the day. Falls, mistakes and stops are weighed in
it, and a judge may take points off for each.

**The criteria** [1, 3] — the five the rules name, and what a judge reads
for each:

| Criterion | What earns it |
| --- | --- |
| Amplitude | height and distance, read at the waist — only when the trick is in control; in slopestyle the SWEET SPOT of the landing, not the biggest air |
| Difficulty | more rotation, more height, long held grabs, switch take-offs and landings, blind landings, off-axis, alley-oops (pipe) |
| Execution | a clean take-off and landing, a quiet body, a grab strong and held, the rotation finished before the snow |
| Variety | both directions, more than one axis, different grabs, no trick repeated |
| Progression | a trick new or rare, or an old one done a new way |

Amplitude, execution, difficulty and variety are read first; progression,
risk, COMBINATIONS (tricks back to back) and, in the pipe only, PIPE USE
(landing high on the wall, keeping speed and height to the last hit, using
every hit) decide between close runs [3].

**The deductions** are written as scales for snowboard only; a freeskier's
mistakes are weighed inside the impression [3]. As a reference for the
size of a mistake (the snowboard scales, 0–100) [3]:

| | Minor | Medium | Major |
| --- | --- | --- | --- |
| Halfpipe | 1–10: flat or deck landing, a light hand | 11–20: a hand dragged, a light seat check, a revert | 21–25: a heavy seat or body check, a fall |
| Slopestyle | 1–5 | 6–15 | 16–20 |
| Big air | 1–9: a hand touched or dragged | 10–19: both hands down, a reverted trick | 20–29: the body on the snow; 30: the body down first |

A landing on the seat or the body is a FALL *(est.)*: in big air it ends the
jump's score; in slopestyle under section judging every section after it
scores nothing (below).

**Ties** [1]: tied skiers share the rank; everyone tied for the last place
through goes through. **Review** [1]: before the next phase a coach may ask
the panel to review how many rotations a trick was credited.

**The trick vocabulary** [4, 3]:

- **Spins** in steps of 180°, from a 180 to a 2340 (six and a half turns).
  A spin ending on an odd half (540, 900, 1260…) lands switch from a forward
  take-off. Four DIRECTIONS: left, right, switch left, switch right; a
  skier's less-preferred way is his UNNATURAL one.
- **Off-axis**: a CORK (the spin's axis tilted; double, triple, quad by its
  inversions), a RODEO (rotating while flipping backward), a MISTY (while
  flipping forward), a FLATSPIN (a flat inverted rotation) *(est.: the last
  definition is unsourced)*.
- **Flips**: the front flip and the back flip on a straight axis; a FULL is
  a flip with a whole twist in it.
- **Switch**: taking off or landing backward. A ZERO SPIN takes off switch
  and lands switch with no rotation.
- **The pipe's own**: an ALLEY-OOP rotates 180° or more UPHILL, against the
  way he is travelling along the pipe.
- **Grabs**: the MUTE (the opposite hand on the ski in front of the
  binding), the SAFETY (the ski's outside edge under the binding), the
  JAPAN (the opposite hand behind to the tucked leg's ski), the TAIL and
  the CRITICAL (a hand on a tail; the critical across the body *(est.)*),
  the OCTO (the front of one ski and the tail of the other), the BLUNT,
  both hands on one ski.

## Halfpipe

Tricks off the two walls of a U-shaped channel cut down the slope, one wall
after the other, judged as one run.

**The pipe** [1] (the top level is the 22-foot pipe):

| | Level A (22 ft) | Level B (18 ft) | Level C (15 ft) |
| --- | --- | --- | --- |
| Wall, floor to coping | 6.7 m | 5.3 m | 4.5 m |
| Rideable length | at least 160 m, 170 m recommended | 120 m, 150 m rec. | 100 m, 120 m rec. |
| Pitch down its centre | at least 17°, 18° rec. | 16°, 17° rec. | 14°, 15° rec. |
| Width, coping to coping | at least 19 m, 19–22 m rec. | 17 m, 17–19 m rec. | 15 m, 15–17 m rec. |

The top 0.2 m of each wall stands at 82–83° — the VERT that sends a skier
straight up out of it. The rules set no transition radius, flat bottom or
deck *(est. for a 22 ft pipe: a transition of 5–6 m radius, a flat bottom
5–7 m wide, a deck 3–5 m wide either side)*. It is cut by a pipe-grooming
machine at every level [1].

**The format** [2, 1]: a QUALIFICATION in heats (ideally 25 skiers, 12–30)
of two runs, the best counting; a semi-final when the field is big (best of
two); a FINAL of two or three runs, the single best counting — ten to
twelve men and six to twelve women on the top series [2]; the
championships' final is three runs [5].

**What a run is** [4, 5] *(est. where marked)*: five to six HITS at the top
level, a wall each, alternating; air of 4–6 m over the coping on a good hit
*(est.)* — the record is just over 8 m [4] — which is ~9.9 m/s straight up
out of the lip and ~2.0 s in the air for 5 m; 45–60 km/h across the flat
bottom *(est.)*; a run of 25–40 s *(est.)*. A winning run today chains
double corks to 1260, 1440 and 1620 in BOTH directions, switch take-offs,
an alley-oop (an alley-oop flatspin or 900–1080) and long grabs [5]; the
best women 900–1080 and doubles *(est.)*.

**The shape of the walls** [46, 47]: a pipe-grooming cutter cuts a wall's
whole profile in one pass, its blade curved to a fixed shape — an
ELLIPTICAL one on the machine most used, circular arcs of 3–4.5 m radius
on the smaller pipes the patents describe, with a flat bottom of 5–20 m
between them. Our 22 ft section *(est.)*: walls 6.7 m from the flat to the
coping and 20 m apart, the top 0.2 m at 83°, under it a circular
TRANSITION of about 7.4 m radius tangent to the flat and to the vert, so
the flat is about 5.3 m wide; a 4 m deck either side; the pitch 18° and
170 m of full wall, a 22 m mouth the walls grow over at the top and an 18 m
tail they shrink over at the foot.

**Riding it** [48, 49]: the pipe is entered across its line, not down it —
coaching material for the pipe has the skier meet each wall at near 90° to
the coping and take off and land at the same height on the same wall. The
height is kept by PUMPING: the legs extended into the transition, where
the snow presses hardest (two to nearly three times his weight on a
championship run [48]), and folded over the flat and the lip. A kinematic
study of elite pipe riders' take-off measured the centre of mass leaving
the lip at about 9.5 m/s on a 720 [48] — the 4–5 m over the coping above.
An ALLEY-OOP is a spin turned toward the top of the pipe: off the
right-hand wall (facing down the pipe) a turn to the right, off the left
one to the left [49].

**The skis and the skier** [50, 35, 36]: a pipe ski is a firm twin-tip
about 85–90 mm underfoot, 172–186 cm, a sidecut of 17–21 m (the published
pairs of a championship final's skiers run 110/84/110 to 119/90/109) —
the stiff competition twin-tip big air rides. The skiers are the freeski
team's measured mean, the MEDIUM build.

**The conditions** [51]: a pipe final has been skied in gusts near 65 km/h
with skiers falling, and a top-series stop postponed for gusts of about
64 km/h and called off for a snowstorm; we hold a pipe run to gusts under
40 km/h at the deck and a fall under 0.75 of a storm's *(est.)*.

## Slopestyle

A run down a course of JIB features (rails, boxes) and JUMPS in a row,
judged on the whole run.

**The course** [1]:

| | Level A | Level B | Level C |
| --- | --- | --- | --- |
| Vertical drop | at least 150 m | 80 m | 50 m |
| Judged SECTIONS | at least 6 | 4 | 3 |
| Of them JUMP sections | at least 3 | 2 | 1 |

A mean slope of 10° or more, about 30 m wide, at least two kinds of feature
out of the table-top jump, the fun box, the quarter pipe, the wave, the
rail, the ridge and "creative" features passed safe. A SECTION is one
feature or several side by side at one place on the slope — always two or
more LINES to choose between — and the course lets a skier spin either
way, favouring no stance. A flat finish after the last jump is at least
25 m long (over 30 m recommended) and 25–30 m wide. The jumps are sized as
a big air's (below); the rules set no course length *(est. 500–800 m)*.
The top level's courses run as three rail sections into three big jumps
[6].

**The speeds** [7]: 10–30 km/h through a rail section; 55–80 km/h down a
jump's in-run, 50–70 km/h at the take-off, 35–60 km/h on the landing; at
most 70–100 km/h.

**The format** [2]: the halfpipe's — qualification best of two, a
semi-final best of two, a final best of two or three, the single best run
counting.

**SECTION JUDGING** [1] — an option beside the overall impression, and the
one the top level uses: seven to nine scoring judges (at least nine at the
top). The TRICK judges (60 % of the score, the recommended split) sit in
two or three panels, each scoring two or three consecutive sections 0–100
(sections may be weighted apart); the COMPOSITION judges (40 %), one panel
of two or three, score the whole run 0–100 for its flow, line and variety.
After a fall every later section scores nothing for the trick judges, and
the composition judges give a set score per section completed (fixed on
the morning of the contest).

**A top-level course** [6, 41]. The championship courses run 630–700 m
long over about 150 m of vertical — just over the level-A minimum — with a
start platform, three rail sections and three jumps. A rail section offers
four or five features across it (down rails, kinked rails, boxes, a wall
ride, creative features), so a skier picks one of several lines; a rail
or a box is 6–12 m long, its top a little above the snow at the near end
and following a deck of 5–10° *(est.)* [20, 21]. The jumps are big air's
smaller cousins: kickers 4–5 m high off tables whose landings' sweet spot
lies 18–22 m past the lip, each jump bigger than the one before it, the
last the biggest [41]. A skier comes off the rail sections at rail speed
and must find the jumps' speed with no skating: the course is shaped so
the fall line gives it to him.

**The panels at the top level** [1, 41]: nine scoring judges — three TRICK
panels of two, each scoring two consecutive sections, and a COMPOSITION
panel of three on the whole run. Each section weighs the same (a tenth of
the score each, the six together the trick judges' 60 %).

**Falls** [1]: a fall ends the run's worth — nothing after it for the trick
judges — but the run is skied on to the finish line; the best run counts,
so a fall in one run is answered in the next.

**The snow and the weather** [7, 42]: a course is prepared hard and
groomed, the jumps' landings and the decks cut to shape and salted when
warm. Wind is what stops it: a final skied in gusts to about 10 m/s was
called dangerous by its riders, and finals have been cut short or called
off for wind — so a jury holds a slopestyle to a lighter wind than a race
*(est.: about 10 m/s in the gust, the same as big air)*.

**The skis and the skiers** [35, 36, 40]: the same competition twin-tip
as big air — about 119/90/115 mm, 164–183 cm, a 16–20 m sidecut, stiff
enough to land a big jump and twin enough to ride and land switch and to
slide a rail. The riders are big air's: freeskiers of about 70 kg on
176 cm for the men, about 60 kg for the women.

**What the game builds (R38)**. A course straight down a built map's face
(`setSlopestyle`): a start platform, three RAIL SECTIONS — each a deck at
7° with a RAIL and a BOX side by side, the two LINES 12 m apart (a down
box and a flat-down rail, a down rail and a flat-down box, a
down-flat-down rail and a down box) — then three JUMPS up a ladder — take-offs of 28, 29 and 30°, tables of 9,
11 and 13 m, landings shaped to an equivalent fall height — and a finish
area. The speed is DESIGNED: each
section's approach is found so the rule's skier meets its rails at about
23 km/h stood up and its lips at 52–59 km/h tucked. It measures some
765 m of plan from the start gate to the finish line over about 220 m of
vertical — longer and deeper than a championship course, the price of
designing every speed off the fall line alone. The jibs are new physics
(`jib.ts`): a skier met at a rail's end along it, his feet near its top,
is put ON it and slides it as a bead on a wire — the steel's or the
plastic's friction and the air's drag — in a 50-50 or a SLIDE (a quarter
turn across it), swapped by an edge tap, an end PRESSED on the lean, turned
out square before the end, popped off it by the jump, and slid off a jib
he has slowed to a stop on. The judges are the top level's SECTION
JUDGING: two judges a section on the trick, three on the composition,
60/40. The format is a qualification of two runs, the best counting, the
best twelve of thirty to a final of three runs, the best counting; the
field is dealt.

## Big air

*Retired: ski jumping replaced big air on the tricks card
(`docs/specs/SKI_JUMPING.md`). The research stays — slopestyle's jumps,
the judges' trick reader (`judge.ts`) and the straight venue cite it.*

ONE jump — a big kicker over a table onto a steep landing — one trick an
attempt, the best scores counting.

**The jump** [1] (the minimums):

| Part | Minimum |
| --- | --- |
| Start area | 5 m |
| Drop-in | 30 m long, 5 m wide, a 5 m platform, at least 20° |
| Flat before the kicker | 5–10 m |
| Kicker | 2 m high, a 25° take-off, 5 m wide |
| Take-off to landing (the table) | 10 m; 15 m at levels A and B (7 m indoors or for juniors) |
| Landing | at least 28° (matched to the take-off), 20 m wide, 20 m long |
| Finish area | at least 25 m if flat (over 30 m rec.), 30 m wide |

A top-level jump is far past the minimums [7]: an in-run of 35–40°, a 5 m
kicker, an ~18 m table, ~5 m of air and ~20 m out, a jump of ~30 m and ~2 s
in the air; ~80 km/h down the in-run, 55–60 km/h off the lip and on the
landing (the presenter's figures).

**The format** [2, 1]: a qualification of two jumps, the best counting; a
semi-final and a FINAL of THREE jumps, the BEST TWO counting — and the two
must be DIFFERENT tricks: the same kind twice counts once, the higher; a
skier with only two jumps landed counts only the higher. What "different"
means is chosen at the captains' meeting, and the men and the women may
take different versions:

- **Clockwise and anticlockwise**: the two counting tricks rotate opposite
  ways.
- **Two of four directions**: right, left, switch right, switch left — the
  two counting tricks in different ones.

Under both, a front flip and a back flip (forward or switch) are kinds of
their own, a flip with 180° or more of spin in it is a SPIN (clockwise or
anticlockwise), and a straight air and a switch straight air are kinds of
their own. In the final the first two jumps go in one order and the third
in reverse order of the standings after two.

**What wins** *(est.)*: men 1980–2160 (five and a half to six turns) as
triple and quad corks, opposite ways and one off a switch take-off; women
1440–1800.

**The pair** [35]: a big air skier rides a COMPETITION TWIN-TIP — stiffer
and straighter than a park ski, for the speed down the in-run and the
landing's load. The class's measured band, off makers' published specs of
the pairs a park field rides: 178–184 cm for a man, a waist of 88–96 mm,
a sidecut radius of 17–19 m, a nearly centred mount, an early rise at both
ends and a twin's turned-up tail for riding away switch. The game's pair
for it is the RAVEN (`defs/skis.ts`): 1.80 m, 118/88/114 mm, a 20 m
sidecut, mounted 1 % back of centre, stiffer in the legs than the park's
HARE so it takes the biggest landing of any pair in the catalog.

**The build** [36]: a men's elite freeski field measured a mean of about
72.5 kg at 179 cm; weight buys no speed on a jump whose in-run is sized
for the lip, and a lighter body turns faster in the air. The game opens
big air on the MEDIUM build (`RACE_RIDERS`), the nearest of its four to
that mean with the kit on.

**The jury's weather** *(est.)*: the rules set no wind speed and leave a
hold or a postponement to the jury; contests have been put back for gusts
of 60 km/h and more and for a whiteout. The game holds a big air under
40 km/h of gust and no more than a steady fall (`BIG_AIR.jury`).

**The panel as the game scores it** [1, 3]: six judges each mark the jump
0–100 on its overall impression — difficulty, execution, amplitude and
progression — the highest and the lowest are dropped and the four left
averaged, cut to two decimals. `engine/game/judge.ts` reads the flight as
the trick it was (its spin in half turns, its flips, off-axis when both,
its direction, switch in and out, the grabs held), sets the ceiling a
clean jump reaches off the trick's difficulty, takes the landing's
roughness away from it, gives the height a little and a jump that came
down on the table or the knuckle less, and scores a fall low whatever was
thrown. Each judge's own eye is a few points either way, dealt off a hash.

**The jump as the game builds it** (R37, `engine/mapgen/trick-rules.ts`):
a 6 m platform, a 30° drop-in, an 8 m flat, a 32° kicker 4 m over the
flat, a 15 m table and a landing shaped to an equivalent fall height of a
third of a metre to a cap of 38°, then a run-out — cut into the mountain
straight down the face where it fits the ground best. The drop-in is as
long as brings a tucked skier to the lip at 59 km/h; the engine's skier
loses more speed than a point mass through the compressions at its foot
and up the kicker, so the in-run is sized with that loss measured, and he
reaches near 100 km/h before he rises to the lip — more than a scaffold
jump's in-run, which drops steeper and shorter. He also leaves the lip
flatter than the lip (his legs give through the kicker's curve), so the
landing is shaped for the flight he flies — about 0.78 of the lip's angle
— not the lip's. Tucked he flies ~2.5 m over the lip and 23–34 m in about
2 s; with the jump sprung at the lip (`TUNING.jump`, which still springs a
beat after the snow is left), ~5 m over it and 34–46 m in about 3 s. Stood
up the whole in-run he would come off near 45 km/h, and sat back on his
tails or braking slower still, down on the knuckle — so the in-run is
ridden as a contest skier rides it, tucked, unbraked and centred from the
start gate to the lip, whatever is pressed (`RunRules.inRun`,
`engine/game/in-run.ts`); the edge and the jump are his own, and in the
air every control is.

## Aerials

Single jumps off steep KICKERS that throw a skier some 14 m over the
landing hill, flipped and twisted on a declared flight plan, scored like
gymnastics: a judged score times the jump's DEGREE OF DIFFICULTY.

**The site** [1, 30]:

| Part | Length | Width | Angle |
| --- | --- | --- | --- |
| In-run | 70–80 m | 22 m | 20–25° |
| Table | 20–25 m | 22 m | level |
| Landing hill | 25–30 m | 22 m | 36–38° |
| Out-run | 30 m | 35 m | level |

Sites measured on the top series and at a championship run 70–91 m of
in-run at 23–26°, a 20–26 m table and 25–30 m of landing at 36–38° [30].
Built in earth in the off-season; ready three days before [1]. The
KICKERS (each jump is assigned one) [30]:

| Kicker | Length / lip height / take-off |
| --- | --- |
| Single (K1) | 3.9–4.0 m / 2.0–2.1 m / 52–55° |
| Double (K2–K3) | 5.8–6.7 m / 3.5–3.65 m / 64–66° |
| Triple (K4–K5) | 7.2–8.0 m / 4.0–4.2 m / 71° |

The ideal flight continues the kicker's curve (about 55°, 60° and 71° by
size) and lands 2–4 m past the KNOLL — the table's edge — give or take a
metre or two; landing on the knoll itself, or out on the flat, is bad air
[32]. The site carries a speed display at the in-run's foot (km/h, on the
judges' stand), twenty in-run markers 2 m apart to pick a start height off,
and anemometers on the knoll, the in-run and the finish; the rules set no
wind limit — the start official sends each jumper "having regard to wind"
[1]. A start clock: red, ten seconds of yellow, green, twenty seconds in
all; a late start or a BALK (stopping and refusing the jump) costs 0.5 a
judge, and a second refusal is a DID NOT START [1].

**The score** [32, 1] — five (up to seven) judges, each scoring three
parts:

| Part | Weight | Scale | What |
| --- | --- | --- | --- |
| AIR | 20 % | 0–2.0 | the take-off 0–1.0, the height and distance 0–1.0 |
| FORM | 50 % | 0–5.0 | from the tips leaving the kicker to the skis on the snow |
| LANDING | 30 % | 0–3.0 | from the snow to the curve where the landing hill meets the flat |

With five judges the high and the low of EACH part are dropped and the
middle three summed (at most 6 + 15 + 9 = 30), times the DD, cut to two
decimals. A championship winner: 5.7 + 12.3 + 8.0 = 26.0, × 5.100 = 132.60
[31].

**Form** is split per flip, and its break bands shrink with the flips
[32]: a single 0.1–1.2 minor, 1.3–2.5 medium, 2.6–5.0 major; a double 0.1–
0.6, 0.7–1.2, 1.3–2.5 a flip; a triple 0.1–0.4, 0.5–0.8, 0.9–1.7 a flip;
each further fault in a flip 0.1. The faults: legs or skis apart,
scissored or crossed skis, bent knees, piking, arching, twists spiralling
off line. The POSITIONS: a LAYOUT straight, a TUCK and a PIKE bent about
90° (a pike with both hands on the legs, a tuck's hands on the knees, shins
or hamstrings, or 0.5 off); the last flip kicked out to full extension
before horizontal. The wrong number of flips or twists against the plan is
a DID NOT FINISH, as is the plan upgraded after the start; the wrong
position caps that flip's share.

**Landing** [32]: 3.0 excellent; 2.6–2.9 balanced, little compression;
2.1–2.5 a light imbalance or hard compression, a brief hand ahead of the
toe piece; 1.6–2.0 a hand dragged behind; 1.1–1.5 a back slap or a punch
forward with no body contact, or turned 45° or more off the fall line;
0.6–1.0 immediate body contact, severe over- or under-rotation; 0.1–0.5
sliding on the back or side; 0.0 no weight on the skis. A hand caps it at
2.0, the body at 1.5; a bad landing takes nothing off the form. A ski lost
in the air earns one rerun a phase [1].

**The flight plan's code** [31]: the direction (b back, f front), then a
letter a flip — L layout, T tuck, P pike, or its twists: H a half, F a
full, Ru one and a half, dF a double full, Ra two and a half, tF a triple
full. bLTF: a triple back, layout, tuck, full. At most three inverted
flips; the jury may cap the DD (men 3.55 or 4.175, women 3.55) or a
contest to doubles [1].

**The degree of difficulty** — the rules leave it to a DD chart (now
published, below); these were read off official start lists and result
sheets [30, 31, 32]:

| Code | Jump | Men | Women |
| --- | --- | --- | --- |
| bLT | double: layout, tuck | 2.600 | 2.600 |
| bLF | double: layout, full | 2.900 | 2.900 |
| bFF | double: full, full | 3.150 | 3.150 |
| bdFF | double, three twists | 3.525 | 3.525 |
| bdFdF | double, four twists | 3.900 | — |
| bLTF | triple: layout, tuck, full | 3.500 | 3.710 |
| bFTF | triple: full, tuck, full | 3.750 | 3.975 |
| bLFF | triple: layout, full, full | 3.800 | 4.028 |
| bFFF | triple: full, full, full | 4.050 | 4.293 |
| bLdFF | triple, three twists | 4.175 | — |
| bFdFF | triple, four twists | 4.425 | — |
| bdFFF | triple, four twists, the double first | 4.525 | — |
| bdFFdF | triple, six twists | 5.000 | — |
| bdFdFF | triple, five twists | 5.100 | — |
| bFtFF | triple, five twists | 5.200 | — |

The pattern *(our inference from the table)*: a women's triple is the
men's × 1.06, a double the same; a full twist added is about +0.375; a
layout flip made a full +0.25, a middle tuck made a full +0.30; twists in
the first or last flip are worth 0.10 more than in the middle. The top of
the chart was raised for the 2025–26 season (five-twist triples 4.900 →
5.100–5.200).

**The format** [1]: on the top series one qualifying jump, the best 12 to
FINAL 1 (one jump), its best 6 to FINAL 2 (one jump) — nothing carried
over, the last jump decides. At the championships: a first qualification
(the best 6 through), a second for the rest (the better of the two
counting) to fill 12; final 1 up to two jumps, the best counting, the best
6 on; final 2 one jump. The men's three final jumps must all differ; the
women may repeat one once. A jump is DIFFERENT if it is front against
back, or has another number of flips, another number of twists, or the
twists split differently by at least one a flip, or another position
(layout against tuck or pike); announcing and jumping the same one twice
in a phase is a DID NOT FINISH. Ties: the score without the DD, then the
form, then the landing, then the LOWER DD. The MIXED TEAM: teams of two to
four (three at the championships: a woman and two men), one jump each, the
sum the team's; eight teams to final 1, four to final 2.

**The physics** [33, 34] *(est. where marked)*: about 62 km/h at the
in-run's foot for a triple (58–66 km/h; a head wind slows it, a tail wind
sends a skier past the triple) and ~70 km/h at the take-off *(unverified, a
coach's figure)*; 14–15 m over the landing hill off a triple; ~2.6 s in the
air [33]. Our own ballistics *(est.)*: 17.2 m/s at the foot less a 4.1 m
climb is ~14.7 m/s at a 71° lip — 13.9 m/s up, 4.8 m/s on — ~10 m over the
lip, 2.6–3.3 s of air, landing at 65–70 km/h almost straight down onto the
37° slope. With skis and boots on, a skier tilted 8° gets about 2.2 twists
a flip, against 2.0 without [33].

**The chart, now public** [61]: the governing body publishes its aerials
DD chart (the 2023 edition is the one read here), every jump with a men's
and a women's value — the singles too: a back tuck or pike 2.000, a back
layout 2.050, a back full 2.300, a back double full 2.900; the doubles
from bLT 2.600 to bFtF 4.000; the triples from bLTT 3.200 to bFtFdF 5.775
(the women's triples × 1.06). The fifteen values read off the sheets
above are its own. The game's table (`engine/game/defs/aerial-jumps.ts`)
is the chart's BACK jumps in layout and tuck, single to triple — no pike,
no front jumps and no uprights yet.

**The skis** [62]: the class is SHORT — 150–160 cm, about the shoulder —
NARROW, some 65 mm underfoot, with LITTLE SIDECUT (a long arc: nothing is
turned on it, the in-run is straight), LIGHT (carbon and wood cores, for
the swing of three flips and up to five twists) and stiff underfoot for
the kicker's load; flat-tailed, since an aerialist lands forward. The
rules set no dimension.

**The skier** [63]: aerialists are small and light — measured national
squads put the men at about 69 kg on 175 cm and the women at about 56 kg
on 160 cm (another squad's women 58 kg on 162 cm). Light is what the
format pays for: the flips' inertia and the landing's load both grow with
the mass, and the take-off asks the legs to hold several g up the kicker.

**The landing** [64, 65]: the drop from the top of the flight to the
landing hill is over 10 m off a triple and up to some 18 m; measured
impacts on a triple's landing are 7–8 times body weight. The landing
hill's snow is CHOPPED and loosened before a contest and between jumps
(the athletes' own word for it is soft and mashed), so a ski bites into it
rather than skidding off. The in-run's SPEED is checked by radar on the
judges' stand and held within about a kilometre an hour of what a kicker
wants [66].

**What the game builds** *(est. where it is ours)*: R41's site — a 23°
in-run sized for each kicker's lip speed (some 59, 80 and 103 m of it for
the single, the double and the triple, so the foot's speed is ~55, ~62 and
~67 km/h), a 4 m table to the kicker, the three kickers on 5.2, 6.2 and
6.1 m of radius to 53°, 65° and 71°, the knoll 13, 11.5 and 10.8 m past
each lip (where the engine's skier comes down 2–4 m past it), a knoll
rounded on 4 m onto a 37° hill. The jump is DECLARED on the trick map
card (its code and DD), its kicker assigned by its flips; in the air the
lean back is a flip and the edge a full twist, asked at any time and paced
by the flight to the snow: every flip the somersault, every twist inside
the flip it was asked in (`aerial-flight.ts`). The score is the rules'
(`aerials-judge.ts`), the panel's eyes dealt off the contest's seed; the
format the top series' (one qualification jump, finals of twelve and six,
the finals' jumps different), the field of 23 dealt. Ridden on the
KESTREL (158 cm, 85/65/79 mm, a 30 m sidecut, the lightest pair) at the
LIGHT build. A triple's landing is harder than the legs take whole, as it
is for a real aerialist: it is ridden away, and the landing judged for it.

## Moguls

One run down a steep course of moguls with TWO JUMPS (the air bumps),
scored on the TURNS, the AIR and the SPEED — the one judged format with a
clock in it.

**The course** [8, 9]:

| | Championships | Top series | Continental | National |
| --- | --- | --- | --- | --- |
| Length | 260 ± 15 m | 235 ± 35 m | 220 ± 30 m | 200 ± 25 m |
| Angle | 28 ± 2° | 28 ± 4° | 27 ± 3° | 25 ± 3° |
| Width | 18–22 m | 18–22 m | 18–22 m | 18–22 m |

No stretch longer than 20 m under 20° or over 37°. The TRACK — the mogul
line a skier takes — is 10 ± 2 m wide (8–12 m between the CONTROL GATES),
at least 2 m from the fence; a vertical of ~110 m on a 235 m course *(est.,
the length times the sine of the angle)*. NINE control gates spaced evenly
down the course (flags at most 0.75 m wide and 1.20 m high) — eleven with
the start and the finish, each a tenth of the course; both tips and both
feet through each, or a DID NOT FINISH [8, 10]. Moguls stand ~3.5 m apart
[11] and ~0.8–1.2 m high *(est.: no rule gives either)*.

**The air bumps** [8, 9]: 5–6 m from the last mogul to the take-off;
50–70 cm high, a 26–35° take-off, 130–150 cm wide; a landing of 15–18 m
(18 and 20 m on the course sheet) at more than 26°, prepared over about a
tenth of the course. The top take-off at 15 % of the course from the start
(10 % on the 2023 sheet — the two disagree), the bottom at 20 % from the
finish.

**The start** [8]: an open start, a light beam 1.5–2.0 m below the line,
the poles planted ahead of it and the boots behind; "competitor ready" ten
seconds before, then 3, 2, 1, go. A stop of ten seconds or a ski lost is a
DID NOT FINISH. The finish area is 30–40 m long and level, its line 8–10 m
wide [8, 9].

**The score** [8, 10] — out of 100:

- **TURNS, 60.** Five turn judges (seven-judge panel) each give a turns
  score of 0.1–20.0 and, apart, a DEDUCTION; the high and the low of each
  are dropped and the remaining three scores and three deductions summed.
  (A five-judge panel: three turn judges, all counted.) The turn score is
  CARVING 50 %, ABSORPTION AND EXTENSION 25 %, UPPER BODY 25 %, in bands —
  excellent 16.1–20, good 12.1–16, adequate 8.1–12, managing 4.1–8, poor
  0.1–4. The deductions: a complete stop 6.0; a fall or a slide to a near
  stop 4.1–5.9; a hard touchdown or a front roll 2.9–4.0; a hip or an arm
  down 2.1–2.8; a light touchdown, a stumble, leaving the fall line, a
  speed check, a double pole plant or SHOOTING (straight on flat skis)
  0.1–2.0. Shooting or sliding sideways costs up to 2.0 a gate section not
  skied, and leaving the line wholly 1.6 a line. Air is judged until the
  skier is in control again; the turns from the moment the skis change
  direction off the landing.
- **AIR, 20.** Two air judges score each jump 0–10 — QUALITY first (the
  take-off, the form, the landing), then the AIR (height and distance),
  then the FLUIDITY — times its DEGREE OF DIFFICULTY; the two judges'
  scores are averaged and cut to two decimals. An axis tipped too far caps
  a jump at 8.0; a very poor or missed landing at 5.0; a jump earns its DD
  only with 0.1 or more for form. The two jumps must be DIFFERENT (a
  repeat counts once); one manoeuvre alone earns at most half the air
  score.
- **SPEED, 20** [8]: `48 − 32 × time ÷ pace`, at most 20.0, where the PACE
  TIME is the course length over the pace speed — 10.30 m/s for men, 9.00
  m/s for women (a 235 m course: 22.8 s and 26.1 s). Full marks come at
  0.875 of the pace (11.8 m/s for men). Checked against a championship
  winner: 23.70 s for 16.75 points is a 250 m course at the men's pace.

**The jumps and their degree of difficulty** [12] (men / women; the women's
run 0.10 above):

| Group | Jump (code) | DD |
| --- | --- | --- |
| Uprights | a single upright (a twister, a spread…) | 0.40 / 0.50 |
| | double / triple / quad / quint | 0.53, 0.65, 0.76, 0.86 (+0.10 women) |
| Straight spins | 360 (3) | 0.68 / 0.78 |
| | 720 (7) / 1080 (10) | 0.85 / 0.95, 1.02 / 1.12 |
| Off-axis | a 360 off axis (3op) | 0.71 / 0.81 |
| | cork 720 (7op) / 1080 (10op) / 1440 (14op) | 0.88, 1.05, 1.22 (+0.10 women) |
| Inverted | back tuck or pike (bT, bP) / back lay (bL) | 0.68 / 0.78, 0.71 / 0.81 |
| | back full (bF) / back double full (bdF) / back triple full (btF) | 0.88, 1.05, 1.22 (+0.10 women) |
| | front tuck (fT) / front full (fF) | 0.68 / 0.78, 0.88 / 0.98 |
| Loops | loop (l) / loop full (lF) | 0.68 / 0.78, 0.85 / 0.95 |

A POSITION (p) adds 0.03, a GRAB (G) 0.14, each further rotation 0.17.
Inverted jumps and loops are singles only. An off-axis jump with no
position, or a grab unclear or not held, is capped at 6.0; two jumps of one
category that differ only by a grab both take the lower DD.

**The format** [8] (the 2026/27 rules): on the top series either one
qualification, the best 16 to FINAL 1 and its best 6 to FINAL 2; or PHASED
— the best 8 of the first qualification straight to final 1, places 9–32
skiing a second (the better of their two runs counting) for 8 more, then
final 2 for six. At the championships the best 10 go straight through,
the rest ski a second qualification for 10 more, and final 2 is eight.
Finals run in reverse order of the qualification and carry nothing over.
Ties: the better turns, then the better air without its DD, then the
faster time.

**What a run is** [13, 10, 9]: 25–30 s; a men's championship final ran
23.7–25.7 s on ~250 m (35–38 km/h on average), its top six scoring turns
47.4–49.6, air 16.3–17.7 and speed 14.1–16.8 for 78.9–83.2. Some 2.5–3
turns a second over ~190 m of moguls *(est., from the geometry; "four a
second" is a popular overstatement)*. The skis: 160–175 cm, 60–66 mm
underfoot [13]. The airs *(est., from coverage)*: men a cork 720 or 1080
or a back full on top and a cork 1080, a cork 1440 or a back double full on
the bottom; women a back full, cork 720, a 720 off axis, back tuck or lay,
a 360 with a grab. Mogul skiers move their hips and knees through more
range, faster and in shorter cycles than alpine racers [14].

**The course as prepared** [52, 53]: the line is set with a rope of about
250 m down the course and a flag every ~4 m marking where each mogul is
built; a top series course runs some 200–270 m at about 26° on average. The
air bumps' take-offs are built in forms filled with snow and water and left
to freeze overnight, and the course is injected with water, raising the
snow from about 350 to about 580 kg/m³ so the moguls hold their shape run
after run. Moguls left to form on their own stand ~5.7 m apart and creep
uphill some 8 cm a day [54] — a built line is tighter and stays put.

**The weather it is called off for** [55]: top-series moguls have been
postponed or cancelled again and again for FOG and a heavy fall — the turn
judges sit at the course's foot and must see the whole line — far oftener
than for wind; the runs are low to the snow and the air bumps small.

**The skis** [56, 57, 58]: a mogul pair is a ski of its own class — short,
narrow and nearly straight, soft at the tip so it folds into a trough and
stiffer under foot and at the tail for the take-off:

| | Figure |
| --- | --- |
| Length | 140–179 cm the range a maker offers; adults 161–179, a men's top-series pair ~171–172 cm |
| Tip / waist / tail | ~92–100 / 61–66 / 81–90 mm (a 172 cm world-level pair 92-63-81; others 95-61-84, 95-63-85, 100-66-90) |
| Sidecut radius | 17–26 m by length (26 m on a 172 cm race pair, 19.7–21.3 m on another range, 11–19 m on an elliptical one) |
| Camber | full camber, no rocker |
| Weight | ~3 kg a pair without bindings |
| Flex | soft forebody — one maker's "pro" version is 25 % softer at the tip; ~8/10 stiff on a retailer's scale overall |

**The athletes** [59, 60]: a national team's tests over six seasons (834 of
them) give its moguls men 177.8 ± 5.6 cm and 73.4 ± 5.8 kg, its women
164.6 ± 4.9 cm and 59.6 ± 4.5 kg — some 8 kg lighter than the same team's
alpine men; another national group's men weigh 72.9 ± 6.3 kg and its women
64.0 ± 9.1 kg. A knee-angle and muscle study of six top-level mogul skiers
found each skier's turn time and knee range his own. Nothing in the score
pays for weight: the turns want legs quick enough to fold every third of a
second and the speed a body that runs — the MEDIUM build.

**As built** (R40, `engine/mapgen/moguls.ts`, `mogul-field.ts`): a 235 m
course at 25° *(the low end of the top series' 28 ± 4°, steep enough on
this engine — a straight skid drags only ~0.35 g)*; a 10 m track of moguls
3.5 m apart and 0.7 m crest to trough *(est.)*, their crests snaking across
it so the troughs zig-zag; two air bumps 0.7 m high kicking 35° off the
slope *(the take-off read as against the slope — the rules do not say)*,
at 15 % and 80 % of the course, with a 20 m landing; nine control gates.
The legs ABSORB the moguls (`engine/game/mogul-ride.ts`): the body rides the
course with the moguls taken out of the snow under it at up to ~9.5 m/s,
less of them the faster past it — down to a third by 14 m/s *(est.)*. The
jury holds the course under 50 km/h of gust and in no more than a steady
fall *(est.; fog is not modelled)*. The format is the single-qualification
one: the best 16 to FINAL 1 and its best 6 to FINAL 2.

## Sources

[1] the international snowboard, freestyle, freeski and ski-cross
competition rules, autumn 2025 edition (the park and pipe chapter: the
fields of play, the judging, the formats) · [2] the federation's top-series
rules for those sports, 2025–26 (the format sections) · [3] a national
snowboard association's pocket guide to freestyle judging, 2020–21,
restating the federation's judges' handbook · [4] a broadcaster's freestyle
glossary and an energy-drink brand's halfpipe guide (the 8.04 m record) ·
[5] a snow magazine's guide to the championship halfpipe · [6] a
broadcaster's question-and-answer on the championship slopestyle course ·
[7] a national ski-technicians' conference talk on preparing freeski courses
and jumps, 2026 (speeds, a championship big air jump) · [8] the same
competition rules, spring 2026 edition (the moguls chapters)
· [9] the federation's freestyle course standards manual, 2023 · [10] the
federation's freestyle judging handbook, November 2025 · [11] the general
reference literature on mogul skiing · [12] the federation's moguls
degree-of-difficulty table, November 2023 · [13] the federation's 2025–26
explainer on moguls · [14] a review of biomechanical
analysis in mogul skiing (perspectives for comprehensive analyses) · [20] a
ski maker's park-feature catalogue excerpt (box and rail sizes) · [21]
terrain-park listings of their features · [30] the federation's top-series
aerials start lists, 2021–24, each with its jury's technical data (the site,
the kickers, the jumps and their DDs) · [31] the published result sheets of
the 2026 championship aerials (men, women, mixed team) · [32] the
federation's freestyle judging handbook, October 2025 (the aerials chapter)
· [33] a biomechanics conference paper on twisting in aerial skiing (the
flight time, the twists a flip) · [34] a broadcaster's freestyle explainer
quoting a coach on in-run speeds · [35] ski makers' published specifications
of their park and competition twin-tips (length, dimensions, sidecut radius,
mount) · [36] an anthropometric study of a national freeski and snowboard
team (body mass and height by sport and sex) · [40] a 2020 exercise-science
study of male freeskiers' big air landings (their body mass and height, the
landing's force) · [41] broadcasters' and park builders' descriptions of
championship slopestyle courses (the length, the vertical, the features a
section, the jumps' sizes, the panels) · [42] news reports of championship
slopestyle finals skied or called off in wind · [46] patents for snow-pipe
cutting apparatus (the cutter's curved blade, the wall's radius and the flat
bottom) · [47] a snow magazine's and a pipe-machine maker's descriptions of
the 22 ft cutter (its elliptical profile) · [48] a 2016 kinematic analysis
of elite halfpipe snowboarders' take-off (the speed out of the lip, the load
in the transition) · [49] a national coaching portal's freeski halfpipe
pages (the approach, the pump, the take-off and landing on the same wall,
the alley-oop) · [50] a ski site's analysis of the equipment of a
championship pipe final · [51] news reports of pipe contests delayed or
called off for wind and snow · [52] a mountain resort's account of building
a top-series moguls course (the rope, the flags every ~4 m, the frozen
take-off forms) · [53] a winter sports science feature on course preparation
(the water injection and the snow's density) · [54] a physics magazine's
field study of natural moguls (their spacing and their creep uphill) · [55]
news reports of top-series moguls postponed or cancelled for fog and snow ·
[56] two ski makers' mogul ranges (lengths, dimensions, radii, the
softer-tipped version) · [57] a retailer's mogul ski listings (the flex
rating, the weight) · [58] a freestyle coaching page on choosing a mogul ski
· [59] a national team's six-season physical test database, summarised in a
sports science journal (height and mass by discipline and sex) · [60] a
sports biomechanics study of the knee in six top-level mogul skiers · [61]
the governing body's published aerials degree-of-difficulty chart (2023
edition) · [62] ski makers' and retailers' aerials ski listings (lengths,
dimensions, cores) · [63] sports science studies of national aerials squads
(height and mass by sex) · [64] a biomechanics study of the landing load on
aerials triples · [65] coaching and venue accounts of the aerials landing
hill (the drop, the snow chopped and loosened) · [66] a national team's
account of the radar speed check on the in-run. · [70] the
international competition rules for ski jumping, 2024 edition with its
changes marked (the hill classes, the measuring devices, the competition,
the judging, the measuring of distance, the scoring table, the formats) ·
[71] the governing body's jumping-hill construction norm, 2018 edition
(the classes, the table angle, the h/n limits, HS against w, the slope at
P, the compensation factors defined, the out-run, the judges' tower) ·
[72] its 2012 predecessor, the standards for the construction of jumping
hills (the approximation formulas, the worked normal hill, the widths, the
rails, the platforms) · [73] the specifications for the Nordic
disciplines' competition equipment, 2025–26 with its changes marked (the
skis, bindings, boots and suits) · [74] published official result sheets
of top-series men's events, 2017–20 (metre values, gate and wind factors)
· [75] a ski-jumping-hill database's certificate data for a normal hill
of HS 106 and a large hill of HS 142 · [76] Jung, Staat and Müller, a
2014 computational-mechanics conference paper on optimising the flight on
normal, large and flying hills (in-run speeds, the take-off's 2–3 m/s, the
mass and air density the models use, the angle ranges measured) · [77] a
2025 review of the biomechanics of jump distance classified by hill size
(after Komi and Virmavirta 1997, Schmölzer and Müller 2005, Gardan et al.
2017, Virmavirta 2017, Virmavirta and Komi 2000 and 2010: the take-off's
length and force, the lift-to-drag ratio through the flight, a simulated
large-hill jump's forces and speeds, the landing's load) · [78] a 2013
biomechanics congress poster on BMI and ski length in the top series (the
top 50's height, mass and BMI) · [79] a 2006 sports-medicine study of
jumpers' BMI at top events · [80] Virmavirta and Kivekäs 2019, a
technical note on the aerodynamics of an isolated jumping ski (the V angle,
the body's and the skis' shares) · [81] the governing body's broadcaster
manual for the ski jumping part of the Nordic combined, 2021–22 (the
cameras, the inserts, the start interval) · [82] Virmavirta and Kivekäs,
a parametric simulation of whether it still pays to be light (BMI against
ski area) · [83] a 2022 biomechanics study of the effect of wind on
distance (the fixed factors, the tail wind's extra 21 %) · [84] a
ski-jumping glossary (the P and K lines) and a hill dictionary (the slope
at HS by class) · [85] a classroom study hosted by a space agency of the
equivalent fall height of a landing · [86] a mechanics paper on the ski
jump (the landing's normal velocity).
