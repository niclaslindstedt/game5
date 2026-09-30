---
name: picture-pricing
description: "Use when a PICTURE row's stops change, when PRESET ▸ AUTO picks a picture that looks wrong for a machine, or when anything a frame draws gets dearer or cheaper enough to move what AUTO should keep: every stop of every OPTIONS ▸ PICTURE row carries a measured COST (ms a frame on the reference machine) and a judged BENEFIT (what it adds to the look, 0–100 on one scale for every row), and `fitPicture` spends a machine's frame on the most look per millisecond. Owns `PICTURE_PRICES` and `FLOOR_MS` in `pwa/src/game/picture-fit.ts`, the price list lab (`make bench ARGS=\"--gpu --costs\"`, `--reprice`), how a benefit is argued, and the rule that a stop added to a ladder owes a price. Not the ladders themselves (`menu-system`, `settings-video.ts`) and not the probe's timing (`menu-system`, `video-probe.ts`)."
---

# Pricing the picture

PRESET ▸ AUTO fits every PICTURE row to the machine it runs on
(`video-probe.ts` times the race under the front door, `picture-fit.ts`
decides). The fit is only as good as its PRICE LIST: for every stop of
every row, what it COSTS a frame and what it is WORTH to the look. Over
budget, the fit gives up the step that loses the least worth per
millisecond saved; with room, it buys the step with the most worth per
millisecond spent. A price that is wrong makes AUTO throw away something
that shows to save nothing, or keep something invisible at a real price.

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
   the CPU, which is no price at all), and it takes over an hour.
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

Why it is built this way, each point learned the hard way:

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
