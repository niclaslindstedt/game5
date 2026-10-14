# The film camera

The camera the front door's backdrop race is seen through, and the replay's
FILM angle (its default rung): the run cut as an action film cuts a ski
sequence, not as television covers a race. It is presentation only. It reads
`GameState` and never writes one, and the run it reads ahead of is a copy, so
no digest moves.

| Piece | File |
| --- | --- |
| The edit: which framing, for how long, for which moment; the menu's slow motion | `pwa/src/game/cinema-director.ts` (three-free) |
| The lenses: where each framing stands and what it looks at | `pwa/src/game/camera-cinema.ts` (three-free) |
| The run read ahead, to know a jump before it happens | `pwa/src/game/cinema-ahead.ts` (DOM-free) |
| The wiring under the menu: on and off, the frame budget, the rate | `pwa/src/game/cinema-run.ts` |
| The lab | `make cinema` (`scripts/cinema-preview.mjs`, `pwa/src/tools/cinema-harness.ts`) |
| The suite | `tests/cinema_camera_test.ts` |

## What the research says a ski sequence is made of

The sequences the genre is remembered for were shot by a small crew of
skiing camera operators, and the same handful of set-ups comes back in every
one of them:

- **The camera skier.** An operator on skis with a hand-held camera, skiing
  close behind the actor or ahead of him and backward, a metre or two off his
  line. This is the shot that puts the audience on the snow, and it is the
  most-used set-up of the lot. It shakes, which is part of what sells it.
- **The helicopter.** A gyro-stabilised long lens hung under a helicopter
  flying alongside the skier at tens of metres, holding him on a long focal
  length so the mountain slides past behind him. Used for the long straights
  and to open a scene wide, with the skier small on the face.
- **The long lens head-on.** A 400–600 mm lens on a tripod far down the
  line, the skier coming straight at it. The long lens compresses the
  distance, so he seems to stay the same size for a long time and then fill
  the frame fast.
- **The low lens at the landing.** A camera dug in beside or under a kicker's
  landing, looking up, so the skier is in the air against the sky. Jumps are
  cut as two shots: the take-off from beside the lip, then on the action to
  the landing lens.
- **The ride-by.** A planted camera a few metres off the line that he passes
  close by. It whips round after him and he is gone.
- **The boots and the edges.** A low lens on the snow beside his feet in the
  turns, sometimes on a sled towed alongside, for the edge cutting and the
  spray.
- **Powder.** A low lens he skis straight at and sprays.
- **The tilted frame (the dutch angle)** for tension, and the **crash zoom**,
  a long lens zoomed in hard on a fall.
- **Slow motion** at the top of a big jump: the jump is shot over-cranked,
  at two to five times the projection rate, and played back over the hang.

The pace is what makes it read as action. Studies of shot length put the
average shot of a 1960s feature at about eight to ten seconds, and the action
sequences of the last twenty years at two to three seconds, with a common
figure of about 2.7 s for a whole action film and shorter in its chases. A
chase cuts hard on every shot, with no dissolve. It keeps to the 180° rule
across a cut on the action, so he is moving the same way across the screen
before and after the cut, and it never puts the same framing up twice in a
row.

## The shot list

Thirteen framings. The first eight **follow** him, standing off his body and
eased after it. The last five are **planted**: stood still off his line
before he arrives, and zoomed to hold a width of the world round him. Every
number is in `CINEMA` (`camera-cinema.ts`) or `DIRECTOR`
(`cinema-director.ts`).

| Framing | What it is | Its numbers |
| --- | --- | --- |
| `establish` | the wide aerial: the mountain with him small on it | 30 m back, 16 m aside, 15 m up, 32° |
| `heli` | the helicopter alongside on a long lens | 5 m back, 24 m aside, 12 m up, 17° |
| `chase` | the camera skier behind him, hand-held, off to the side of his spray | 4.6 m back, 2.2 m aside, 1.3 m up, 50°, a shake of 5 cm and 0.8° |
| `lead` | the camera skier ahead, skiing backward | 5.2 m ahead, 1 m aside, 0.9 m up, 50° |
| `boots` | down by his feet in the turns | 1.6 m ahead, 2.6 m aside, 0.35 m over the snow, 50°, looking 0.2 m below the hips |
| `powder` | low ahead, for the spray he throws at it | 6.5 m ahead, 1.3 m aside, 0.35 m over the snow, 50° |
| `dutch` | beside him, the horizon tilted | 0.6 m ahead, 6 m aside, 44°, rolled 0.24 rad |
| `arc` | circling him | 8 m out, 2.2 m up, 0.32 rad/s round |
| `headon` | the long lens far down his line | stood where he will be 3.2 s on, 2 m aside and 1.6 m up, zoomed to 9 m of world; given up inside 14 m |
| `rideby` | the planted lens he passes close | where he will be 1.8 s on, 3.6 m aside, 0.55 m up, 5.5 m of world |
| `lip` | beside the kicker's lip for the take-off | 2.5 m past the lip, 4.5 m aside, 0.45 m up, 6 m of world |
| `hero` | low by the landing, him against the sky | three-quarters down the flight, 7 m aside, 0.35 m up, 12 m of world |
| `crash` | the crash zoom | 7 m along, 6 m aside, 1.2 m up, zooming 44° to 17° |

**The edit** (`DIRECTOR`): a follow shot holds 2–4 s and is cut hard. It
never uses the framing just used and seldom one of the last three. Every
seventh take is the wide aerial, and so is the first. The follow framing is
chosen off what is happening: on a fast straight (over 17 m/s, under
0.45 rad/s of turn) the head-on, the helicopter and the ride-by; in the
turns the boots and the chase; in powder (under 0.45 packed) the low powder
lens; in the air the helicopter and the circling lens; at a crawl the lead
and the circling lens.

**A moment** coming (a flight of 0.5 s or more, a crash, a pass, the finish)
gets its own take, opened 1.5 s before it (a crash 1.1 s) so he has the
frame to arrive into, and held 1.1 s past it (a crash 2.4 s). A flight of
0.9 s or more is two shots: the lip, then a cut 0.15 s past the take-off to
the landing lens, on the same side of his line. A shorter flight is one of
the two. A big air straight after another is seen from the helicopter, the
ride-by or the circling lens instead, so two jumps are never cut the same
way. A gap shorter than 1.2 s between a take and the next moment is held on
the take already up, never cut to a flash of another.

**A planted lens is stood where the line is open**: off the line by its
numbers, pushed out 2.5 m at a time up to three times, on either side, until
neither the slope nor a trunk stands between it and where he will be — the
take-off and the air points of a flight included. A lens with nowhere to
stand gives its take up, and so does one shut off from him for 0.3 s, one he
has passed, or a head-on lens he has come within 14 m of.

## Knowing what is coming

A replay has the whole run (`replay-shots.ts`'s moments, handed in as the
plan). Under the menu the run has not happened yet, but the engine is
deterministic and the backdrop is the daring bot's, so the future can be
read. `cinema-ahead.ts` rides a COPY of the run (`impact-forecast.ts`'s
`forkRun`) on ahead on the same hands, 4.5 s past the run, and watches it
with the replay's own collector. The copy is stepped only while the frame's
budget lasts (2.5 ms and 48 steps), and a fresh copy is taken every 2 s
because the daring bot keeps its memo beside the state it rides and may pick
a line again. A find is kept until a fresh read has passed it without
finding it again. Where the copy had him is kept every 6 steps (`path`), so a
planted lens is stood on the line he will actually ski. The copy shares only
the map and pure functions with the run. `tests/cinema_camera_test.ts` holds
the run to a hair against a run with no read beside it, and holds the read
to finding the first jump more than a second before the take-off.

## Slow motion

Under the menu nobody is riding, so the backdrop's clock is the director's
to bend. A flight of 0.9 s or more read ahead is run at 0.36 of real time
over its middle third, eased in and out over the rest of the flight
(`cinemaRate`, `CINEMA_SLOW`). That is about what a jump shot at 66 frames a
second and projected at 24 looks like. Only the hang is slowed, never the
take-off or the landing. In a replay the replay's own director slows the
picture (`replay-shots.ts`'s `directAt`) and the film follows it.

## Where it is used, and where not

- **Under the front door, the attract card and the loading card**, while the
  backdrop is the race the daring bot rides (`title.raced()`). It is off over
  the title scene and while the rider and gear cards' stage covers the race
  (`backdrop-hold.ts`).
- **In a replay**, as the FILM angle, the first rung of `WATCHING_CAMERAS`.
  The camera button walks on to the broadcast, CLOSE, SIDE, FRONT, AERIAL and
  HELMET.
- **Nowhere on a run.** Every rung of the run's own ladder (TIPS, HELMET,
  CHASE, FAR, HIGH, ORBIT, and the machines' ladders) is as it was. The film
  is told through the renderer's replay door (`setReplayCam`) and nothing
  else.

## The lab

`make cinema` photographs the backdrop through the film camera, live as under
the front door (`--mode=live`) and as a replay watched on the FILM angle
(`--mode=replay`). Every frame is captioned with its take and measured
against the skier: the distance, how far off the lens's axis he is, whether
he is inside the frame, whether the snow stands between, and whether the lens
is in the snow. It writes `previews/cinema-<mode>.jpg` (a frame every half
second) and `previews/cinema-<mode>-shots.jpg` (one frame a framing). It
prints a table of the takes, the framings used, the mean take, and the
shares in frame, within 12° of the axis and behind the snow. `--json` and
`--compare` keep a before and an after.

## Still open

- The planted lens is checked against the slope and the trees
  (`camera-clear.ts`), not against buildings or lift towers, so a lens can
  stand inside a station.
- A follow lens is eased after him and lifted over the snow, but nothing
  keeps it from passing through a trunk between two frames.
- The read ahead sees only the daring bot's run. A rival, the crowd and the
  machines are not in the copy, so a pass is never planted for under the
  menu.
