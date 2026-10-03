# Simulation

The headless harness (`engine/sim/simulate.ts`) runs the REAL engine — `createGame`, `step`, the bot skier (`engine/sim/bot.ts`) — with no renderer attached and reports what happened. It is how a ski, snow, bot or generator change is MEASURED rather than argued: run it before and after, read the diff, paste both tables in the PR. `tests/simulation_test.ts` holds the bot to finishing what the generator builds, and `tests/determinism_test.ts` holds the digest.

## The harness

`simulateRun(seed, options?)` builds the seed's map (or skis `options.level`, a synthetic one in the tests), stands the bot on the start line's first slot with **no lights** (`countdown: 0`) and, by default, **nobody else on the line** (`rivals: 0` — a solo run is the measurement; `--rivals 3` is the race), and steps it at the engine's own 120 Hz until the finish line or `maxSeconds`. It returns a `RunReport`:

| Field                            | Meaning                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `finished`, `time`               | The finish line, and the run clock at it (or at the timeout), s                                                    |
| `laps`, `lapTimes`               | Always one run on a generated map (R16); the table's `splits` column is the run's own time                         |
| `checkpoints`, `crossings`       | Gates credited, of the run's total — the start gate, every gate down the piste, the finish line                    |
| `trackLength`                    | The piste, m — on a resort (R25) the course raced down it (R28)                                                    |
| `powder`                         | How much of the piste's centreline lies under a drift (R17), 0..1 — what the catalog's rows are read against       |
| `topSpeed`, `meanSpeed`          | m/s; the mean is plan distance over the run clock                                                                  |
| `airTime`, `bestAir`, `jumps`    | Seconds of air summed over flights longer than 0.3 s, the longest flight, how many                                 |
| `harshLandings`                  | Landings the legs could not take whole (`land.harsh`)                                                              |
| `treeHits`, `bumps`              | Trunks met and (in a race) rivals shouldered                                                                       |
| `wipeouts`                       | Times the skier was thrown (`crash.ts`) — the table's `wipe`                                                       |
| `resets`, `autoResets`, `missed` | Resets, the engine's own among them, and gates skied past (a slalom gate's at three seconds on `time`, R28)        |
| `place`                          | Where the bot finished against the field (1 solo)                                                                  |
| `score`                          | The score the run banked (`tricks.ts`): the bot turns nothing, so it is its air and the ground its flights covered |
| `digest`                         | FNV-1a over the skier's position and speed every quarter second — the determinism fingerprint                      |

## The CLI

```sh
npm run sim                        # seeds 1..8, solo, top to bottom
npm run sim -- --count 20          # seeds 1..20
npm run sim -- --seeds 3,7,38      # these seeds
npm run sim -- --rivals 3          # a whole race
npm run sim -- --skis eagle        # one pair of the catalog (the all-mountain pair when left out)
npm run sim -- --skis all          # the catalog: every pair's table, then who was quickest on each seed
npm run sim -- --tricks            # each seed's map of one piste with its terrain park laid (R20)
npm run sim -- --no-poles          # the bot skis without poles (the player's hard mode)
npm run sim -- --region fell       # each seed's map built in another kind of snow country (R21)
npm run sim -- --json out.json
```

It exits non-zero when the bot finishes NO seed at all — a skier that cannot get down any map is broken, not slow. At the tuning in this tree (`make sim`; the table is re-run and pasted here with every change that moves it):

```
sim — engine 0.1.0 at 120 Hz · skis chamois · seeds 1,2,3,4,5,6,7,8 · laps map · rivals 0 · max 600 s
 seed  fin    time            splits     cps    len  pow  grade  mean   top   air  best  jmp hrsh tree wipe  rst auto miss  plc  score    digest
    1  yes   278.2               275   41/41   3629   9%   blue    49    72   1.3   0.5    3    0    0    0    0    0    0    1    155  9425c254
    2  yes   156.5               154   23/23   1976   5%   blue    47    69   0.4   0.4    1    0    0    0    0    0    0    1     19  83e10c97
    3  yes    96.7                94   13/13   1052  11%  green    40    55   0.0   0.0    0    0    0    0    0    0    0    1      0  1026b4df
    4  yes    95.4                93   12/12    994  16%  green    39    57   0.0   0.0    0    0    0    0    0    0    0    1      0  a4be564d
    5  yes   118.8               116   17/17   1460  24%    red    45    76   0.6   0.6    1    0    0    0    0    0    0    1    135  bd50e92a
    6  yes   107.8               105   13/13   1056  11%  green    36    55   0.0   0.0    0    0    0    0    0    0    0    1      0  b90851cc
    7  yes   242.9               241   28/30   2683  16%  black    47   101   7.8   0.9   12    2    0    2    2    2    2    1    510  a2bb3175
    8  yes   193.5               192   27/27   2372  17%  black    45    85   4.0   0.6    7    0    0    0    0    0    0    1    301  7a7e70a0

8/8 finished · mean 43 km/h · top 101 km/h · air 1.8 s/run · jumps 24 · harsh 2 · trees 0 · wipeouts 2 · resets 2 (auto 2) · missed 2 · score 140/run
```

And the race, `make sim ARGS="--rivals 3"`:

```
sim — engine 0.1.0 at 120 Hz · skis chamois · seeds 1,2,3,4,5,6,7,8 · laps map · rivals 3 · max 600 s
 seed  fin    time            splits     cps    len  pow  grade  mean   top   air  best  jmp hrsh tree wipe  rst auto miss  plc  score    digest
    1  yes   282.2               280   41/41   3629   9%   blue    49    73   1.3   0.5    3    0    0    0    0    0    0    2    177  46cdc629
    2  yes   163.2               161   23/23   1976   5%   blue    45    67   0.4   0.4    1    0    0    0    0    0    0    2     19  dc77f280
    3  yes   111.2               109   13/13   1052  11%  green    35    49   0.0   0.0    0    0    0    0    0    0    0    3      0  34ae06ea
    4  yes   104.9               102   12/12    994  16%  green    35    51   0.0   0.0    0    0    0    0    0    0    0    2      0  fc7762c5
    5  yes   119.1               117   17/17   1460  24%    red    45    71   0.9   0.6    2    0    0    0    0    0    0    1    152  af51150e
    6  yes   124.8               122   13/13   1056  11%  green    31    47   0.0   0.0    0    0    0    0    0    0    0    4      0  a8cf7a49
    7  yes   221.7               220   28/30   2683  16%  black    45   101   6.8   1.0   10    2    0    1    1    1    2    2    500  6793b797
    8  yes   197.5               196   26/27   2372  17%  black    45    85   4.0   0.6    7    0    0    0    0    0    1    1    331  023d25d0

8/8 finished · mean 41 km/h · top 101 km/h · air 1.7 s/run · jumps 23 · harsh 2 · trees 0 · wipeouts 1 · resets 1 (auto 1) · missed 3 · score 147/run
```

## Reading the table

- **`pow`** is how much of the piste lies under a drift (R17) — the column the catalog is read against. `--skis all` ends with one row a seed, every pair's run time and a `*` on the quickest: no pair should win them all, and the powder pair should take the powder runs.
- **`fin` NO** on any seed is a regression until it is explained: the bot is a competent skier, and a map it cannot finish is a map a player will not finish either — or a skier that cannot get down what the generator builds.
- **`time`** is the run from the start line to the finish, top to bottom, with every slalom gate missed charged on it; a resort's course (R28) runs 0.8–4.8 km, so at the bot's pace it is a minute and a half off the nursery to five minutes off the peak — read it beside `len`. A jump across every seed is a skier that got slower or a bot that got timid; a jump on one seed is that map.
- **`grade`** is the colour the course measures: its steepest run's (R28).
- **`mean`** sits around 40–50 km/h for the bot today (a recreational skier's pace on a groomed piste; a downhill racer's tuck would be twice that), **`top`** near a hundred.
- **`air`/`jmp`** are the kickers on the course — none down a short green, a dozen down a black. Fewer jumps than kickers is a kicker the bot takes too slowly to leave the snow; `best` over 2.5 s is a lip overshot.
- **`hrsh`** counts landings past `air.harshSpeed`: a few is a kicker whose landing the bot's plan misjudges; many is a landing model gone hard.
- **`tree`, `rst`, `auto`** should be zero or nearly. A tree hit on a generated map is the bot leaving the piste (R14 keeps the corridor clear); an automatic reset is a skier down or bogged.
- **`wipe`** must be zero on a solo run: every wipeout threshold (`TUNING.crash`) sits well past anything a clean run meets, so a wipeout there is a threshold come down into clean skiing or a bot that got worse. In a race a shoulder can put one down.
- **`miss`** is a gate skied past; on a resort's course every one between the start gate and the finish is a SLALOM GATE set off the line, and one missed costs three seconds and the run goes on (`cps` is then short by it). The bot skis the gate line, so a miss is a weave it could not make — a gate set wide off a steep pitch, or one just past a kicker's landing.
- **`score`** is what the run banked (`tricks.ts`). The bot turns nothing, so on a race map it is the air and the ground the kickers threw it across, combo by combo — a fall across every seed is a kicker that stopped throwing.
- **`digest`** changes with ANY change to the physics, the bot or the generator, and must not change between two runs of the same tree — `tests/determinism_test.ts` holds that.

## The bot (`engine/sim/bot.ts`)

A deterministic skier that reads the same `GameState` the HUD reads and produces the same `SkierInput` a thumb produces; it never reaches into the physics — what it knows about the skier it reads off `limits.ts` (the terminal speed on a grade, the edge at a speed, the carve's curvature, the corner grip, the braking). Its decisions, in the order they are made every step:

- **Where it is**: the nearest point of the piste, restricted to the stretch between the last gate it took and the one it owes — so a traverse's return leg is never mistaken for its own, and a gate gone past is a gate missed rather than a gate found again.
- **What it steers at**: a point `lookBase` + `lookPerSpeed`·v metres further down the centreline — on a course of slalom gates down THE GATE LINE through them (`gateLineAt`, R28), the weave's curvature read into how fast it may go — or down its LANE (inside a slalom gate's own width), the line a rival's slot started on (`Rival.lane`, m right of the centreline), held in from the piste's edge by a margin that grows with speed, so the field holds its slots out of the gate and closes on the racing line as it gathers pace; the player's stand-in skis the centreline — against the heading its yaw rate is carrying it to; in powder it reads further ahead and asks for less edge.
- **Off the start line**: it poles out of the standing start and aims through the start gate onto the line.
- **How fast**: for every bend within braking reach, the speed its curvature allows at `cornerShare` of the corner grip, less what skidding at `brakeShare` of the grip can take off before it; for every on-piste KICKER, the speed its lip is taken at; a tuck where nothing needs the edge.
- **In the air**: levels the pitch to the slope it is going to land on, with the lean.
- **Trees**: moves its aim off a trunk standing in its line.
- **Giving up**: asks to be reset after `giveUpAfter` seconds without a gate.

A RIVAL is the same bot on a run of its own, its tuck capped at the pace it was dealt at the start line (`RACE.paceBand`).
