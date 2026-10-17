---
name: picture-pricing
description: "Use when a PICTURE row's stops change, when PRESET ▸ AUTO picks a picture that looks wrong for a machine, or when anything a frame draws gets dearer or cheaper enough to move what AUTO should keep: every stop of every OPTIONS ▸ PICTURE row carries a measured COST (ms a frame on the reference machine) and a judged BENEFIT (what it adds to the look, 0–100 on one scale for every row), and `fitPicture` spends a machine's frame on the most look it can buy. Owns `PICTURE_PRICES` and `FLOOR_MS` in `pwa/src/game/picture-fit.ts`, the price list lab (`make bench ARGS=\"--gpu --costs\"`, `--reprice`), how a benefit is argued, and the rule that a stop added to a ladder owes a price. Not the ladders themselves (`menu-system`, `settings-video.ts`) and not the probe's timing (`menu-system`, `video-probe.ts`)."
---

# Pricing the picture

PRESET ▸ AUTO fits every PICTURE row to the machine it runs on
(`video-probe.ts` times the race under the front door, `picture-fit.ts`
decides). The fit is only as good as its PRICE LIST: for every stop of
every row, what it COSTS a frame and what it is WORTH to the look. The
fit takes, of every picture the ladders can make, the one of most worth
whose cost fits the machine's frame — exactly, a knapsack with one choice a
row over the costs in hundredths of a millisecond. A price that is wrong
makes AUTO throw away something that shows to save nothing, or keep
something invisible at a real price.

> **A cost is measured; a benefit is argued.** Never guess a cost, and
> never "measure" a benefit — write down why a stop is worth what it is,
> beside the number, so the next session can disagree with a reason.

## Read the lessons first

`npx ogf-skill-lessons picture-pricing` — and `debug-tools`'
lesson on reading the GPU's slices, which is where the measuring traps
live.

## The COST: `make bench ARGS="--gpu --costs"`

1. `make build`, then run the price list on the host's GPU at the
   reference buffer (`FIT_REFERENCE`, 1920×1080):
   `make bench ARGS="--gpu --costs --width 1920 --height 1080"`. It needs
   a real GPU (see `debug-tools`; in a cloud container SwiftShader prices
   the CPU, which is no price at all), and it takes over an hour. The
   driver is not a dependency: `npm install --no-save playwright-core@1`,
   then `git checkout package-lock.json`, which the install rewrites. On
   macOS point it at the installed browser, which draws through Metal on the
   real GPU (`CHROMIUM_PATH="/Applications/Google
   Chrome.app/Contents/MacOS/Google Chrome"`; the default path is the cloud
   container's).
   Run it IDLE, ON THE CHARGER, under `caffeinate -dimsu`. A share cancels
   drift that is slow (a laptop warming over the hour), not someone working
   on the machine, whose bursts land on one run and not the next. And a
   laptop off its charger sleeps mid-list: the run does not fail, it hangs,
   and a list cut in two is two machines' prices. Watch the log's age; a
   stop is a minute or two.
2. What it does: every stop of every row, the other rows at their top, a
   600-frame run three times, each beside a run of the top picture; the
   stop's price is its frame as a SHARE of the top frame around it. It
   does all of that from TWO VIEWS: the race's chase camera, and the VISTA
   (`?view=vista`, the lens high on the summit ridge looking down all of
   it), and keeps each stop at its dearer view. The JSON lands in
   `previews/picture-costs.json`, and the table to paste is printed last
   (`--reprice` prints it again from the JSON without running anything).
3. Paste the costs and `FLOOR_MS` into `PICTURE_PRICES`, then run
   `npx vitest run tests/video_test.ts`: every row is priced, the cheapest
   stop is 0/0, and neither cost nor benefit falls up a ladder.

### The sweep: every row in one long run (`--sweep`)

`make bench ARGS="--gpu --sweep --width 1920 --height 1080"` prices the
whole list a second way, and is the faster of the two — but only where the
frame is heavy enough for its blocks to read (see its lessons: on a fast
GPU it priced nothing). Per SCENE
(`bench-scenes.ts`: the race, the vista, sunset, night and a snowfall —
every one calm on the same race; `--views` to pick), it loads the page ONCE and draws the
race in blocks of 40 frames (`SWEEP` in `picture-sweep.ts`), each under a
picture dealt at random — every row at a stop, each row's stops dealt
equally often and shuffled apart from the other rows' — letting the first
12 frames of a block settle (a moved row rebuilds what it draws) and taking
the median of the rest. The race is stood up again at the start every 1800
frames so a long sweep keeps drawing the woods and the kicker. A
least-squares fit over the blocks reads each stop's ms over its row's
cheapest with a standard error, beside a slow drift in time and the place
in the race loop, so neither the machine warming up nor the race moving on
lines up with any stop; blocks a hitch spoiled are dropped.

- `--blocks n` (default 240): the standard errors go as one over the root.
  The report prints them; a stop whose ± is as big as its figure is not
  priced yet — run more blocks.
- Out: the report's PICTURE SWEEP table (wall, ±, the CPU's share, today's
  price), `previews/picture-sweep.json` (`floorMs`, `costs` in
  `PICTURE_PRICES`' shape — the dearer view's, levelled up each ladder —
  and every view's blocks and fits), and the table to paste.
- A DEVICE no lab drives: DEVELOPER ▸ PICTURE COSTS runs it from the
  menu — ALL SCENES one after another (a single report carrying every
  scene's sweep and the table off the dearest), or one scene — or open the
  built site with `?bench=1&sweep=1` (`&view=<scene>` for another). COPY
  DEBUG REPORT, save it, and
  `make bench ARGS="--sweep --report FILE"` prints its table; `--sweep
  --reprice` reprints the last JSON's.
- What a figure means: the stop's cost AVERAGED over the pictures the other
  rows were dealt (a main effect). Rows that multiply each other
  (RESOLUTION and anything pixel-bound) read as at the middle of the other
  ladders, which is what `pictureCost` adds up. LAMPS reads about nothing
  by day: the NIGHT scene is where it is priced, and the costs take every
  stop at its dearest scene.

Why the `--costs` list is built this way, each point learned the hard way:

- **Separate runs drift.** A laptop warms up over half an hour and every
  frame gets slower. Two runs minutes apart differ by more than a cheap
  row costs, so a stop is priced as a share of the top frame measured
  beside it, never as a difference of milliseconds across the list.
- **A row's cost depends on the view.** DISTANCE was nearly free from the
  chase camera, because the race runs through the woods and nothing far
  shows. From a hilltop it is the dearest row. A picture has to hold 60 fps
  on its dearest view, which is what the vista is for.
- **Price the frame end to end, not only the card.** The probe times a
  drained frame (CPU and GPU together), and some rows cost mostly
  processor (FOREST's culling, TRAILS' stamping), so the table is priced in
  what the probe will see.
- **Hiding a pass is not the same as dropping a stop.** The A/B's `hero`
  row skips the skiers' pass and leaves every material still reading their
  maps. SHADOWS HIGH cost about 1 ms, where the A/B said 0.24.

## The BENEFIT: one scale, argued

0 is the row at its cheapest; the numbers add across rows, so a benefit of
40 on SHADOWS and 40 on RESOLUTION have to mean the same loss to a skier.
Judge at race speed from the chase camera (`make world`, `make screenshots
--video …`), not from a still:

- **What is ON EVERY PIXEL** outranks everything else. RESOLUTION's soft
  picture is felt everywhere.
- **What the game is ABOUT** comes next. TRAILS OFF takes the furrows away,
  the heaviest single loss on the list; TRAILS LOW keeps most of it.
- **What gives the world DEPTH**: the trees' shadows, DISTANCE's mist
  closing in.
- **What sharpens a thing already there** is worth little: SHADOWS HIGH
  over MEDIUM (the skiers' shadows sharper), TERRAIN HIGH over MEDIUM, SPRAY.

Write the reasoning in `PICTURE_PRICES`' header, row by row, when a number
moves.

## When a price is owed

- A stop added to a ladder, or a ladder re-cut (`settings-video.ts`): the
  new stop owes a cost and a benefit, and `tests/video_test.ts` fails until
  it has them.
- A change that makes a row's work dearer or cheaper by more than about
  0.1 ms at the reference (a shader, a pass, a mesh): re-price at least
  that row, and say in the PR what AUTO now keeps that it did not.
- AUTO picks something that looks wrong on a device: read that device's
  benchmark report beside the price list before touching a benefit. The
  cost ratios may be wrong for that class of machine (a phone is short of
  pixels where a desktop is short of processor). The probe's second round
  corrects the scale, never the proportions.

## Checking a price change

`npx vitest run tests/video_test.ts`, then drive the fit over a range of
machine speeds and read what it keeps (`fitPicture(top, pictureCost(top) *
k)` for k from 0.5 to 6): each step down should read as the right thing
to lose next. Put that table in the PR.

## Skill self-improvement

Record what a pricing session taught (a view that priced a row wrong, a
benefit a playtest overturned) as a lesson fragment under
`.agents/skills/picture-pricing/.lessons/` via the **`skill-reflection`**
skill.
