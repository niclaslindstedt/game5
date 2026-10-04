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
| Giant slalom | — | — | to research — `docs/specs/GIANT_SLALOM.md` |
| Super-G | — | — | to research — `docs/specs/SUPER_G.md` |
| Downhill | — | — | to research — `docs/specs/DOWNHILL.md` |
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

**In the game**: the course is `engine/mapgen/slalom.ts` (`setSlalom`), the
gate verdicts `engine/game/strict.ts`, the board `engine/game/field.ts` and
`par.ts`, the flex poles `gate-poles.ts`, the start `start-push.ts`; the
house, the shots and the clip `pwa/src/game/start-house*.ts`,
`camera-start.ts`, `slalom-start.ts`.

Sources: [1] PMID 30317917 · [2] PMC7739813 · [3] doi:10.3390/app14041427 ·
[4] PMC7739787 · [5] PMC12575998 · [6] KoreaScience JAKO201721242144242.

## Giant slalom

*Not researched yet.* The to-do list is in `docs/specs/GIANT_SLALOM.md`;
the findings land here.

## Super-G

*Not researched yet.* The to-do list is in `docs/specs/SUPER_G.md`; the
findings land here.

## Downhill

*Not researched yet.* The to-do list is in `docs/specs/DOWNHILL.md`; the
findings land here.

## Ski cross

*Not researched yet.* The to-do list is in `docs/specs/SKI_CROSS.md`; the
findings land here.

## Speed skiing

*Not researched yet.* The to-do list is in `docs/specs/SPEED_SKIING.md`;
the findings land here.
