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
| Super-G | — | — | researched (technique, skis, course); to build — `docs/specs/SUPER_G.md` |
| Downhill | — | — | researched (technique, skis, course); to build — `docs/specs/DOWNHILL.md` |
| Ski cross | — | — | to research — `docs/specs/SKI_CROSS.md` |
| Speed skiing | — | — | to research — `docs/specs/SPEED_SKIING.md` |

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
`camera-start.ts`, `slalom-start.ts`.

Sources: [1] PMID 30317917 · [2] PMC7739813 · [3] doi:10.3390/app14041427 ·
[4] PMC7739787 · [5] PMC12575998 · [6] KoreaScience JAKO201721242144242.

## Giant slalom, super-G and downhill

Researched together, against the slalom, for the technique rows and the
courses still to build (`docs/specs/GIANT_SLALOM.md`, `SUPER_G.md`,
`DOWNHILL.md`). Numbers are measured unless marked *(est.)*; an inclination
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

## Ski cross

*Not researched yet.* The to-do list is in `docs/specs/SKI_CROSS.md`; the
findings land here.

## Speed skiing

*Not researched yet.* The to-do list is in `docs/specs/SPEED_SKIING.md`;
the findings land here.
