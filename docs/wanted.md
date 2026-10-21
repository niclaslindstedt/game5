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
| `stole-ambulance` | 1 | 1 star |
| `stole-police` | 1 | 2 stars |
| `downed-helicopter` | 1 | 3 stars |
| `stole-snowmobile` | ½ | 2 stars |
| `hit-soldier` | ½ | 1 star |

Taking the landed air ambulance (`steal.ts`'s `stepSteal`) calls it with `stole-ambulance`, through the livery's row of `OFFENCE` there; the police helicopter, when it can be taken, is a row beside it (`stole-police`).

An offence also fixes him for `WANTED.fix` (10 s): the theft is reported, and the army knows where he is.

`setWanted(state, n)` sets the stars exactly. It is how a link's `?wanted=N` and `CreateGameOptions.wanted` start a free ride already hunted, and `setWanted(state, 0)` drops them.

## The longer he survives, the worse it gets

The hunt itself climbs the heat: from each star to the next takes `WANTED.climb` seconds in sight (40, 50, 60 and 75 s from one star up to four), and runs at half that pace while they only search. A theft starts at one star, so a man the army keeps in sight is at two stars in under a minute, three in about a minute and a half, four in two and a half and five in under four. Escaping is survival too, just slower to anger. Five stars is the top and holds.

**The aim tightens as it climbs.** The rules of fire say whether they shoot at him; the stars also say how well. `WANTED.hold` widens every shooter's hold (the spread a burst is drawn about, `gunfire.ts`' `fireAt`): eight times the weapon's own at three stars, four at four, twice at five. `WANTED.pace` stretches the pause between a gun's bursts the same way: four times at three stars, two and a half at four, 1.4 at five. A launcher's reload is its own. So three stars is fire that mostly cracks past him, four is fire that finds him if he stands, and five is the weapons' own aim. Neither touches a shooter's fire at his own side's machines.

## Seen or searching

Every `lookEvery` (0.25 s) each pursuer looks. He sees the man if he is near enough for his kind (`WANTED.sight`: a helicopter crew or a door gunner 900 m, a soldier 350 m, a snowmobile's crew 400 m, a ground vehicle 500 m, a balloon's basket 1.2 km, a paramotor 900 m) and **no ground rises between his eyes and the man's chest** (`seesQuarry`: the line marched every 6 m over `groundAt`, blocked where the snow comes within 0.4 m of it). Inside `close` (25 m) he is heard whatever is between. **The woods hide him from the ground**: a soldier, a snowmobile or a vehicle on the snow does not see through three or more crowns along the line (`throughWoods`, marched every 3 m, each crown counted once; `WANTED.line.woods`), while a machine or a basket in the air looks down through them. The quarry is the man himself, or the machine he rides (`quarryOf`).

**Under cover.** A man on his own feet (not in a machine), slower than `cover.speed` (2.5 m/s) and with a tree's crown over his head (`underCover`: the crown's reach at `cover.head` (1.6) m over his boots, `cover.crown` (1.2) times the sight line's crown) is HIDDEN from the air. A helicopter, a door gunner, a paramotor or a balloon further than `cover.near` (60) m does not see him, however clear the line. A soldier, a snowmobile or a vehicle on the snow still does, through the trunks, as the woods' rule above says. Stopping under the trees is how a hunt that has only aircraft left is lost.

Out of every pursuer's sight for `WANTED.lose` seconds (12, 18, 25, 32 and 40 s for one to five stars) and the stars are dropped: the hunt ends `escaped`, the survival timer stops, and a `lost` event says so. `WANTED.searchRadius` is the circle round `lastSeen` the pursuers comb while they look for him.

The army's helicopters ([`army.md`](army.md#in-flight)) are called in from the map's edge as soon as a star asks for them, and **the search's clock does not run until the first of them has reached it**: the stars flash once the fix runs out, but a hunt nobody has yet flown is not lost. With the machines kept home (`CreateGameOptions.army: false`, how this page's tests run), the only sight is the fix: a hunt flashes after ten seconds and is lost after the search time.

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

From two stars the army also comes **up the mountain from the valley** in waves (`WANTED.waves`, read with `groundWave(stars, n)` and counted with `wavesSent(w, t)`): the first `first` seconds after he reached the star, then one every `every` seconds, each one's `base` plus `grow` for every wave before it, rounded down and capped. Each wave mixes military snowmobiles, tracked over-snow carriers, trucks as far as the roads go, tanks, and **soldiers climbing on foot**, who come in growing numbers with every wave. The soldiers on foot, the snowmobiles, the carriers, the trucks and the tanks are all sent ([`army.md`](army.md#ground-waves), [`army.md`](army.md#the-waves-vehicles)).

| Stars | First, s | Every, s | First wave (snowmobiles, tracked, trucks, tanks, on foot) | Cap a wave |
| --- | --- | --- | --- | --- |
| 2 | 90 | 75 | 1, 0, 0, 0, 4 | 2, 0, 1, 0, 12 |
| 3 | 60 | 60 | 2, 1, 1, 0, 8 | 4, 2, 2, 0, 24 |
| 4 | 45 | 50 | 2, 2, 2, 0, 16 | 5, 4, 3, 1, 40 |
| 5 | 30 | 40 | 3, 2, 2, 1, 24 | 6, 6, 4, 3, 64 |

The helicopters and their door gunners fly ([`army.md`](army.md#in-flight)), the soldiers on skis and on the lifts are set down and chase him ([`army.md`](army.md#on-the-ground)), and the roster's snowmobiles drive after him ([`army.md`](army.md#on-snowmobiles)); the rest of the roster and the ground waves are data the later parts read.

## How a hunt ends

- **Escaped:** the search ran out. The timer stops; the stars and the stopped timer stay on the HUD a few seconds (`LOST_HOLD`), then go. Another offence starts a new hunt with a new timer.
- **Killed:** he died (`GameState.gore`'s death). The timer stops.
- **Arrested:** with SAFE FOR WORK on the army does not kill. A soldier who reaches him (`WANTED.arrest.reach`, 2 m) while he is slow or down calls `arrestSkier(state)` (`army-ground.ts`): he is thrown face down and held there, his hands at the small of his back, the soldier knelt at his side and the squad round him, and he is never stood back up. The hunt ends `arrested`, the timer stops, and the run ends the way a death does: the HUD fades, ARRESTED comes up over the picture going dark, and a new rider starts (`hud-wreck.ts`'s `deathOver` reads `arrestedOf`). `arrestSkier` refuses where the army shoots to kill.

An arrest or a death ends the hunt for the run: no offence raises it again.

## Events

One `wanted` event, its `change` saying what happened: `raised` (a star gained, with the `cause` when an offence did it), `lowered` (stars taken away by hand), `lost`, `seen`, `searching`, `arrested`. The news column says the raise, the escape and the arrest (`run-news.ts`); the stars say the rest. They make no sound of their own: the army is heard by its machines and its guns.

## The HUD

Under the presses in the top right (`hud-wanted.tsx`, `pwa/src/wanted.css`), drawn off the snapshot's `wanted` (`wanted-tile.ts`, DOM-free):

- **Five stars**, the lit ones solid white on a dark rim, the rest a faint outline; the lit ones **flash** while the army searches rather than sees him.
- **The search** under them while the stars flash: OUT OF SIGHT over a bar that runs down as the search does (`search`, the share of `lose` still to run), so he can see how much longer he has to stay hidden. Stood under a crown it reads HIDDEN in green (`hidden`), and the bar stays full while nothing searches.
- **The survival timer** under them, counting while the hunt runs and stopped once it ends.
- **The best** under that: the survival highscore, kept on this device under `fall-line.survival.v1` (`survival-book.ts`, checked on the way in, written when a hunt ends and every five seconds of a hunt still running past the best).

The death card and the arrest card carry the hunt's line, SURVIVED against the BEST.

## Labs and tests

- `make screenshots ARGS="--surface wanted,wanted-search"`: three stars solid five seconds in, and five stars flashing once the fix has run out, at every viewport.
- `tests/wanted_test.ts`: absent until raised, no digest moved, the hook and its floors, the climb, the search and the loss, the sight line over a ridge, cover from the air, the arrest and the timer, the roster and the waves.
- `tests/wanted_hud_test.ts`: the tile (the search bar and HIDDEN with it), the survival book, the news.
- `make army-ground ARGS=--table=curve` (`scripts/lib/army-curve-table.mjs`, pure Node): THE ESCALATION CURVE, a whole hunt from the theft on a real map with the whole army out. The air ambulance is taken (`raiseHeat(state, "stole-ambulance")`), and the army is left to climb the stars as it would on a free ride. A row is a quarry: `run` (the bot skiing on, never stood), `still` (stood where he took it) and `hide` (skiing until two stars, then stood under the thickest trees within 300 m). The columns are when each star was first reached, the share of the hunt he was seen, the longest he was out of sight, how and when it ended, the snowmobiles' rounds (and theirs in him) and every round of the army's in him by weapon.

On seed 38, 420 s a hunt, the whole army out. Before is the tuning this page replaced (a theft at two stars, the climb at 45, 60, 80 and 100 s, the aim the same at every star, no cover from the air); after is the one above.

| Quarry | Switch | Tuning | ★2, s | ★3, s | ★4, s | ★5, s | Seen | Longest out of sight, s | Ended | At, s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| run | INJURIES | before | 0 | 64 | — | — | 92 % | 6.8 | killed | 99 |
| run | INJURIES | after | 43 | 93 | — | — | 95 % | 6.8 | killed (shot, 2 rifle rounds) | 138 |
| run | SAFE FOR WORK | before | 0 | 64 | 144 | 194 | 97 % | 6.8 | arrested | 246 |
| run | SAFE FOR WORK | after | 43 | 93 | 153 | 228 | 98 % | 6.8 | arrested | 331 |
| still | INJURIES | before | 0 | 69 | — | — | 80 % | 9.8 | killed | 90 |
| still | INJURIES | after | — | — | — | — | 56 % | 12.0 | lost | 47 |
| still | SAFE FOR WORK | before | 0 | 69 | — | — | 80 % | 9.8 | arrested | 92 |
| still | SAFE FOR WORK | after | — | — | — | — | 56 % | 12.0 | lost | 47 |
| hide | INJURIES | before | 0 | 68 | — | — | 81 % | 8.8 | killed | 80 |
| hide | INJURIES | after | 43 | — | — | — | 60 % | 18.0 | lost | 62 |
| hide | SAFE FOR WORK | before | 0 | 68 | — | — | 84 % | 8.8 | arrested | 97 |
| hide | SAFE FOR WORK | after | 43 | — | — | — | 60 % | 18.0 | lost | 62 |

Before, a theft was two stars at once and three a minute later, and a man was dead or arrested within a minute and a half whatever he did. Standing still or hiding under the trees made no difference. After, the climb is one star at a time. A man skiing on, never stood, reaches five stars in under four minutes with SAFE FOR WORK on and is arrested in the sixth. With the INJURIES on the bot is killed at three stars, at 2 min 18 s rather than 1 min 39 s. It skis straight down the piste in the open, so the riflemen's rounds find him in the end even at three stars' hold. A man who stops under the trees is hidden from the air. He loses a one-star hunt in 47 s, and a two-star hunt within 20 s of stopping.

The lab's last two columns read the snowmobiles' lethality against him skiing on (evasive, never stood). With the INJURIES on, they fire 5 rounds before the riflemen kill him and put none in him. With SAFE FOR WORK on, their 273 rounds are all warning fire. The snowmobiles alone are measured in [`army.md`](army.md#on-snowmobiles)'s sleds table.

## Not yet

- The night does not shorten sight.
