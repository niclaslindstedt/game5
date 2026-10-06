# Dual moguls — draft spec

**Draft. Researched, not built.** Delete this file when dual moguls is
finished (see `README.md`). It is moguls (`MOGULS.md`) side by side; build
that first. The shared pieces are `TRICK_MODES.md`'s.

## Start here

1. Follow `README.md`'s *Starting a discipline in a new session*, and read
   `TRICK_MODES.md` and `MOGULS.md` first.
2. The research is `docs/freestyle.md` § *Dual moguls*: two lanes of 6.5 m
   (blue on the left, red on the right looking up), a start device of two
   gates opening together, only the GAP at the finish timed; two judging
   systems — VOTES (each judge splits five; 35 votes on a seven-judge
   panel: turns 20, air 10, speed 5 off the gap) and DIRECT COMPARISON
   (each skier out of 100: turns 50, air 25 with the DD × 1.25, speed 25
   off the gap); a ladder of 8–32 with a big and a small final.
3. The closest thing built is the SKI CROSS's heat (`cross-heat.ts`): a
   start gate whose doors drop together, two (there four) racers on the
   course at once on their own stream, lanes, a bracket
   (`cross-bracket.ts`, pure). Reuse it; a dual is a heat of two in lanes
   that never meet.

## Watch out

- **The rival is skied.** Both skiers are on the course at once: the bot
  must ski moguls well enough to be a race, and every heat's draws need a
  stream of their own (the ski cross's lesson), so a restart and a replay
  stand up the same dual.
- **Lanes never cross.** Both feet over the centre line is a DID NOT
  FINISH, not contact; the ski cross's lane and contact code must stay
  off here.
- **Judging is relative.** Every vote compares the two runs; a judge never
  scores one skier alone. The judge module's head-to-head mode reads both
  skiers' records together.
- **Two lanes, one course.** The moguls must be set in two parallel lines
  4.5 m+ apart with the same rhythm, and the air bumps level across both
  lanes, or one lane is the faster.

## What it is

Moguls head to head: two skiers start together out of one gate and race
down two parallel lanes of the same mogul course, each with two jumps. The
judges compare them on turns, air and speed; the winner goes through. A
knock-out bracket of 16 or 32, with a big final and a small final.

## What the game already has to reuse

- Moguls, the course and the scorers (`MOGULS.md`).
- The ski cross's start gate, the heat on its own stream, the bracket
  (`cross-heat.ts`, `cross-bracket.ts`, `crossCountdown`).
- The finish's crossing read to the fraction of a step (`crossingShare`) —
  the gap at the line.

## What it needs to be complete

- [ ] **The course (moguls' rule with a dual row)**: 220 ± 35 m, 20–24 m
      wide, two lanes of 6.5 ± 0.5 m, a middle gate 0.40 m wide and
      outside gates 0.75 m, the mogul lines 4.5 m+ apart with one rhythm,
      the air bumps level across (4–5 m after the last mogul, landings 18
      and 20 m), the start device of two 2 m gates.
- [ ] **The start**: "blue course ready… red course ready", both gates
      opening within three seconds; a false start a DID NOT START.
- [ ] **The dual judge**: VOTES (five a judge, 5–0, 4–1, 3–2; four turn
      judges, two air, one speed off the gap — 0.74 s or less 3–2,
      0.75–1.49 s 4–1, 1.5 s+ 5–0; a repeated jump two votes, a same
      category one; the majority wins) or DIRECT COMPARISON (turns 50 off
      three judges never tied, air 25 off the dual DD, speed 25 off the
      gap — `24.50 − 0.025 × hundredths`); ties.
- [ ] **The format**: a qualification (single moguls runs) seeding a
      ladder of 16 (or 32), the top eight keeping their seeds, the rest
      drawn in groups; the higher seed picks the lane; a big final and a
      small final; the eliminated ranked by score then seed. A DOM-free
      module beside `cross-bracket.ts`.
- [ ] **Mode and rules**: a `GameMode` row; the gate start; a rival in the
      other lane; DID NOT FINISH for the centre line, a gate missed, a ski
      lost or a ten-second stop; both out, the first out ranks lower.
- [ ] **The field**: duals the player is not in dealt off the race's seed
      (the ski cross's dealt heats).
- [ ] **The bot**: the moguls bot in a lane, against a rival.
- [ ] **HUD**: the two lanes' colours, the gap at the line, the votes or
      scores coming up, the bracket between duals.
- [ ] **Cameras**: from below, both lanes in frame.
- [ ] **Sound**: the gates, the crowd's split.
- [ ] **Labs** (`make sim ARGS="--mode dualMoguls --heat"`), **tests**,
      **docs**; delete this spec.

## Research to-do

- [x] The course, the start, the two judging systems, the format, falls
      and ties.
- [ ] Which judging system the top series uses now (the championships
      used votes in 2026).

## Open questions for the user

- VOTES (the classic, easy to read: 30–5) or DIRECT COMPARISON (scores
  out of 100)?
- A whole bracket in one sitting, or a dual as the playable unit (the
  ski cross's open question, answered there as a whole bracket)?
