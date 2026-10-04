# Working specs

One file per feature being built: what it is, what is decided, what is
built, what is left and what still has to be RESEARCHED before it can be
built honestly. A session picks a feature up by reading its spec first, and
keeps it current as the work moves.

**Every spec here is temporary.** The closing commit of a feature deletes
its spec, once everything in it has landed in the code, the tests and the
standing docs (`docs/*.md`, `AGENTS.md`). A spec that outlives its feature is
a second, stale copy of the truth.

| Spec | Discipline | State |
| --- | --- | --- |
| [SLALOM.md](SLALOM.md) | Slalom | building |
| [GIANT_SLALOM.md](GIANT_SLALOM.md) | Giant slalom | draft — research first |
| [SUPER_G.md](SUPER_G.md) | Super-G | draft — research first |
| [DOWNHILL.md](DOWNHILL.md) | Downhill | draft — research first |
| [SKI_CROSS.md](SKI_CROSS.md) | Ski cross | draft — research first |
| [SPEED_SKIING.md](SPEED_SKIING.md) | Speed skiing | draft — research first |

The drafts are written from what the game already has (the slalom's
machinery: R31's course setter, strict gates, the interval start and its
board, flex poles, the start house, the television start, the per-run
technique) and from general knowledge of each sport. Anything that needs a
number, a rule or a measurement is a **research to-do**, not a guess: answer
it from sources (biomechanics studies, the sport's published competition
rules restated in our own words, coaching material), note the source in the
spec, and only then build. Never copy a rulebook's text, and never name a
real race, venue, product or person — the repo is public and the rule is in
`AGENTS.md`.
