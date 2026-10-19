# The wanted level

Steal the air ambulance or the police helicopter on a free ride and the army comes for you. How hard it hunts is a **wanted level**: five stars, raised by what you do and by how long you last, and lost only by staying out of every pursuer's sight long enough. This page is the engine's half (`engine/game/wanted.ts`, its numbers `engine/game/defs/wanted.ts`, its state `engine/game/wanted-state.ts`) and the HUD's. The army itself (the helicopters, the gunfire, the soldiers, the vehicles) is built on top of it in later work and reads the rows below; how its helicopter and its soldiers look is [`army.md`](army.md).

## Where it comes from

The shape is the one open-world crime games settled on, and it is borrowed as a shape only:

- **Stars, each sending more.** One star is a single helicopter shadowing you; every star after that sends more and heavier pursuers, up to several aircraft at once at the top.
- **Solid while seen, flashing while searched for.** While a pursuer has you in sight the stars are solid and the search is centred on you. Out of every pursuer's sight they flash: the army is combing the place you were last seen.
- **Lost all at once.** Stay unseen long enough (longer the more stars you carry) and the stars drop to nothing. They do not tick down one at a time.

The roster climbs the way a real military response is escalated: first find and shadow the suspect, then put a fire team down, then a squad, then mechanised pursuit over the snow, then more aircraft. The rules of fire follow the force continuum the same way: presence and no shots (`hold`), warning fire aimed off him (`warn`), then aimed fire (`aim`). Every shooter fires through the one gunfire layer ([`gunfire.md`](gunfire.md)), which reads these rules.

## The state

`GameState.wanted` is **absent until something raises it**, so a run that never does moves no digest. Nothing in it draws from any stream (`tests/wanted_test.ts` holds both).

| Field | What it is |
| --- | --- |
| `stars` | 0..5, the stars held |
| `heat` | the heat in star units; the fraction is how near the next star is |
| `seen` | a pursuer has him in sight (or the fix after an offence holds); false while searching — the stars flash |
| `unseen` | seconds out of every pursuer's sight, this search |
| `fix` | seconds left of the fix an offence gives them: they know where he is whether or not anyone sees him |
| `lastSeen` | where he was last seen — the centre of the search |
| `pursuers` | every man and machine out after him, written each step by the parts that move them (`Pursuer`: `id`, `kind`, `x`, `y`, `z`) |
| `lethal` | whether the army shoots to kill — false with SAFE FOR WORK on (`RunRules.sfw`, the INJURIES switch off) |
| `since`, `stopped` | THE SURVIVAL TIMER: when the hunt began and when it stopped (null while it runs) |
| `ended`, `endedAt` | how the hunt ended — `escaped`, `arrested` or `killed` — and when |
| `peak`, `reached` | the most stars this hunt reached, and when each star was reached (the clock its ground waves count from) |
| `cause` | the last offence |

## The hook, and what raises it

`raiseHeat(state, cause)` is the one door in. Each cause is a row of `WANTED.offences`: `add` stars on top of what he has, to at least `floor`.

| Cause | Add | At least |
| --- | --- | --- |
| `stole-ambulance` | 1 | 2 stars |
| `stole-police` | 1 | 3 stars |
| `downed-helicopter` | 1 | 3 stars |
| `stole-snowmobile` | ½ | 2 stars |
| `hit-soldier` | ½ | 1 star |

Taking the landed air ambulance (`steal.ts`'s `stepSteal`) calls it with `stole-ambulance`, through the livery's row of `OFFENCE` there; the police helicopter, when it can be taken, is a row beside it (`stole-police`).

An offence also fixes him for `WANTED.fix` (10 s): the theft is reported, and the army knows where he is.

`setWanted(state, n)` sets the stars exactly. It is how a link's `?wanted=N` and `CreateGameOptions.wanted` start a free ride already hunted, and `setWanted(state, 0)` drops them.

## The longer he survives, the worse it gets

The hunt itself climbs the heat: from each star to the next takes `WANTED.climb` seconds in sight (45, 60, 80 and 100 s from one star up to four), and runs at half that pace while they only search. Escaping is survival too, just slower to anger. Five stars is the top and holds.

## Seen or searching

Every `lookEvery` (0.25 s) each pursuer looks. He sees the man if he is near enough for his kind (`WANTED.sight`: a helicopter crew or a door gunner 900 m, a soldier 350 m, a snowmobile's crew 400 m, a ground vehicle 500 m, a balloon's basket 1.2 km, a paramotor 900 m) and **no ground rises between his eyes and the man's chest** (`seesQuarry`: the line marched every 6 m over `groundAt`, blocked where the snow comes within 0.4 m of it). Inside `close` (25 m) he is heard whatever is between. The woods do not hide him yet. The quarry is the man himself, or the machine he rides (`quarryOf`).

Out of every pursuer's sight for `WANTED.lose` seconds (12, 18, 25, 32 and 40 s for one to five stars) and the stars are dropped: the hunt ends `escaped`, the survival timer stops, and a `lost` event says so. `WANTED.searchRadius` is the circle round `lastSeen` the pursuers comb while they look for him.

Until pursuers exist on the map, the only sight is the fix: a hunt raised with nobody out flashes after ten seconds and is lost after the search time.

## What each star sends

`WANTED.roster` (read with `rosterOf(stars)`): the most of each the army has out at once.

| Stars | Helicopters | Door gunners | Soldiers on skis | Snowmobiles | Soldiers up the lifts | Balloons | Rocketeers | Paramotors | Fire |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | hold |
| 2 | 1 | 2 | 4 | 0 | 0 | 0 | 0 | 0 | warn |
| 3 | 1 | 2 | 8 | 1 | 4 | 0 | 0 | 0 | aim |
| 4 | 2 | 4 | 8 | 2 | 8 | 1 | 2 | 2 | aim |
| 5 | 3 | 6 | 12 | 3 | 12 | 2 | 4 | 4 | aim |

A utility helicopter seats a section of about a dozen and has a gun in each door; a fire team is four, a squad two of them. Soldiers ride the ski area's lifts up and ski down at him; the army's hot-air balloons drift in on the wind with soldiers firing shoulder-launched rockets from the basket, and riflemen fly in on the game's paramotor beside them.

### The ground waves

From two stars the army also comes **up the mountain from the valley** in waves (`WANTED.waves`, read with `groundWave(stars, n)` and counted with `wavesSent(w, t)`): the first `first` seconds after he reached the star, then one every `every` seconds, each one's `base` plus `grow` for every wave before it, rounded down and capped. Each wave mixes military snowmobiles, tracked over-snow carriers, trucks as far as the roads go, tanks, and **soldiers climbing on foot**, who come in growing numbers with every wave.

| Stars | First, s | Every, s | First wave (snowmobiles, tracked, trucks, tanks, on foot) | Cap a wave |
| --- | --- | --- | --- | --- |
| 2 | 90 | 75 | 1, 0, 0, 0, 4 | 2, 0, 1, 0, 12 |
| 3 | 60 | 60 | 2, 1, 1, 0, 8 | 4, 2, 2, 0, 24 |
| 4 | 45 | 50 | 2, 2, 2, 0, 16 | 5, 4, 3, 1, 40 |
| 5 | 30 | 40 | 3, 2, 2, 1, 24 | 6, 6, 4, 3, 64 |

All of this is data the later parts read; nothing moves on the map in this part.

## How a hunt ends

- **Escaped:** the search ran out. The timer stops; the stars and the stopped timer stay on the HUD a few seconds (`LOST_HOLD`), then go. Another offence starts a new hunt with a new timer.
- **Killed:** he died (`GameState.gore`'s death). The timer stops.
- **Arrested:** with SAFE FOR WORK on the army does not kill. A soldier who reaches him (`WANTED.arrest.reach`, 2 m) calls `arrestSkier(state)`: the hunt ends `arrested`, the timer stops, and the run ends the way a death does: the HUD fades, ARRESTED comes up over the picture going dark, and a new rider starts (`hud-wreck.ts`'s `deathOver` reads `arrestedOf`). `arrestSkier` refuses where the army shoots to kill.

An arrest or a death ends the hunt for the run: no offence raises it again.

## Events

One `wanted` event, its `change` saying what happened: `raised` (a star gained, with the `cause` when an offence did it), `lowered` (stars taken away by hand), `lost`, `seen`, `searching`, `arrested`. The news column says the raise, the escape and the arrest (`run-news.ts`); the stars say the rest. They make no sound of their own: the army is heard by its machines and its guns.

## The HUD

Under the presses in the top right (`hud-wanted.tsx`, `pwa/src/wanted.css`), drawn off the snapshot's `wanted` (`wanted-tile.ts`, DOM-free):

- **Five stars**, the lit ones solid white on a dark rim, the rest a faint outline; the lit ones **flash** while the army searches rather than sees him.
- **The survival timer** under them, counting while the hunt runs and stopped once it ends.
- **The best** under that: the survival highscore, kept on this device under `fall-line.survival.v1` (`survival-book.ts`, checked on the way in, written when a hunt ends and every five seconds of a hunt still running past the best).

The death card and the arrest card carry the hunt's line, SURVIVED against the BEST.

## Labs and tests

- `make screenshots ARGS="--surface wanted,wanted-search"`: three stars solid five seconds in, and five stars flashing once the fix has run out, at every viewport.
- `tests/wanted_test.ts`: absent until raised, no digest moved, the hook and its floors, the climb, the search and the loss, the sight line over a ridge, the arrest and the timer, the roster and the waves.
- `tests/wanted_hud_test.ts`: the tile, the survival book, the news.

## Not yet

- The woods do not block sight, and the night does not shorten it.
- Nothing moves on the map yet: the helicopters, the soldiers, the vehicles, the balloons and the paramotors are the later parts', and they write `pursuers`.
- An arrest does not yet hold the skier still; the soldier who makes it will.
