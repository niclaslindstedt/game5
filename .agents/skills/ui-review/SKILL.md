---
name: ui-review
description: "Use for a fit-and-finish pass over the game's UI — the HUD, the touch controls (the handlebar and the lever), the three presses, the finish plate, the cards (attract, front door, loading, pause), the new-build button. Drives the screenshot-audit loop: capture every surface at the reference viewports (desktop landscape, phone portrait, phone landscape), evaluate against the quality bar, fix what clips, overflows, or drifts off the shared look, and verify with re-captures."
---

# UI Review — audit the HUD and every overlay

The game's UI drifts the way all game UI drifts: a new readout ships at a size
that reads on desktop and vanishes on a phone, a touch control creeps under a
thumb's blind spot, an overlay assumes landscape. This skill is the periodic
sweep that catches all of it at once — **look at every surface, judge it, fix
it, look again**. Never evaluate UI from code alone; the failures (clipping,
overlap, illegibility over bright snow) only show up in pixels.

The UI surface today is small — `pwa/src/game/hud.tsx` (the readouts),
`hud-dial.tsx` (the rev bar), `hud-actions.tsx` (the three presses),
`hud-result.tsx` (the finish plate), `hud-touch.tsx` (the thumb zones, which
are the phone's only controls), the cards (`splash-screen.tsx`,
`menu-main.tsx`, `loading-screen.tsx`, `menu-pause.tsx`),
`pwa/src/styles.css`, and the new-build button (`update-button.tsx` over
`lib/pwa-update.ts`) — which is exactly why a sweep is cheap enough to run on
every UI change.

**Before starting, read this skill's lessons** —
`npx ogf-skill-lessons ui-review --list`, then the ones this task
touches. Load **`skill-reflection`** at both ends of the session.

## Tooling

| Piece | Role |
| --- | --- |
| `scripts/screenshot.mjs` | The capture harness — serves `pwa/dist`, opens `?start=race&seed=&t=&shot=1` (or a card's own URL with `--surface`), waits for `window.__SH_READY__` (a card waits on its DOM instead), captures at 1280×720 (desktop landscape), 390×844 (phone portrait) and 844×390 (phone LANDSCAPE) to `previews/`; `--viewport` names one, `all` is every one |
| `make screenshots SCENE=<name>` | Runs it for one moment of a race (`grid`, `go`, `race`, `late`, `all`) against the BUILT app (`make build` first); `ARGS="--surface all"` for every card, `ARGS=--update` for the new-build button; `CHROMIUM_PATH=/opt/pw-browsers/chromium` in web sessions |
| Read tool on the PNGs | The evaluation itself — every judgement is made on a screenshot, not on source |
| `npm run dev` | Headed spot-checks (the lights' timing, touch behaviour in devtools emulation) |

**THE THIRD VIEWPORT IS THE ONE THE GAME IS HELD AT, and it is the only one
that reaches the `@media (orientation: landscape) and (max-height: 34rem)`
rules** — 720 and 844 are both far above them, so everything those rules
change is invisible to the other two. It is also the harshest axis in the
app: 390 px of height for a card that is paid for in rows, with the lever
and the handlebar both wanting the bottom corner and the speed wanting the
middle. **Judge every layout change there, and treat a card that scrolls
there as a bug** — `.menu-card` and `.hud-card` both slide past the fold
rather than clipping, so the overrun shows in no diff and reads as a missing
feature.

The three are the floor, not the ceiling: a small phone (375×667) is the next
tight case, since a surface tuned to exactly fit 390×844 runs out of room on
the SE class first.

**When the change is ONE instrument's placement rather than a surface, take
one scene per viewport instead of the whole sweep.** `SCENE=grid` is the cheap
one — the field on the lights, every readout at its floor; `SCENE=race` is
the same HUD at speed with the field strung out.

## The quality bar

Judge every screenshot against this list. Extend it when a new rule of thumb
settles (that is the `skill-reflection` promotion path).

1. **Nothing clips, overlaps or SCROLLS at any of the three viewports.** The HUD's elements keep
   clear of each other and of the safe areas at every aspect ratio the scenes
   capture.
2. **Legible over the WORLD, not over a mockup.** The scene behind the HUD is
   a pale winter sky over sunlit snow with dark conifers in it — the worst
   case for white text is the snow itself (most of every frame), and the
   worst case for dark text is the forest. Every readout keeps its ink/shadow treatment (`hudInk` /
   `hudShadow` in `identity.ts`'s palette); a new element that skips it reads
   fine in devtools and vanishes on the snow.
3. **Touch targets are thumb-sized and reachable.** The HUD IS the touch
   control surface on phones: the edge thumb in the lower-left arc, the tuck
   lever in the lower-right, sized for a moving thumb, and no readout a skier
   must watch mid-turn under either. The lever's full travel (a full tuck
   where the thumb lands, up to stand, further up for the skid) fits inside
   the safe area from wherever a thumb plausibly lands.
4. **Essential info reads at speed.** Speed, the position, the gates, the
   missed-gate arrow, the air clock — a skier glances at these
   mid-turn. Small captions are fine for ambient info (the news column);
   anything decision-driving is big.
5. **One look.** The HUD wears the winter identity — the palette from
   `pwa/src/identity.ts`, never a re-hardcoded colour. A new overlay that
   invents its own greys is drift; re-skin it.
6. **Portrait is designed, not squeezed.** The portrait layout is its own
   arrangement, not the landscape HUD scaled down — the snow fills a tall
   frame differently, and the horizon sits higher.
7. **Safe areas + reduced motion.** Anything pinned to a screen edge respects
   `env(safe-area-inset-*)`; decorative animation (the lights, the lever's spring) has a `prefers-reduced-motion` fallback that keeps the
   information.
8. **The PWA surfaces count too.** The new-build button and the install flow
   are UI — capture the button with `make screenshots ARGS=--update`
   (`?update=1`).
9. **An instrument's IDLE state never sits on its own alert ramp.** The rev
   bar that warms as the edge goes over must read cool and inert with the
   skis flat; a warm "neutral" lands close enough to the low end of that
   ramp that a skier standing on the start line looks like one on his edges. Quiet when there is no news is
   what makes the news findable at speed.

## Process

1. **Capture the baseline.** `make build && make screenshots` on a clean
   tree; skim EVERY PNG with the Read tool. List findings in two buckets:
   _broken_ (clips, overlaps, unreadable) and _drift_ (off-palette,
   undersized, inconsistent). Note the surfaces that are already strong —
   they define the bar, and the list proves the sweep was total.

   **When the edit is already written, take the baseline from `origin/main`
   rather than skipping it** — a chip that overflows by 40 px says nothing
   about whose fault that is. A worktree builds one in seconds with no
   `npm install`, because the build only ever reads the tree:

   ```sh
   git worktree add ../base-main origin/main
   ln -s "$PWD/node_modules" ../base-main/node_modules
   ln -s "$PWD/pwa/node_modules" ../base-main/pwa/node_modules
   (cd ../base-main && npm run build --workspace pwa)
   ```

   Point the harness at either `pwa/dist` and run it twice;
   `git worktree remove --force` before committing. This is also the only
   safe way to take a late BEFORE — `git stash && make … && git stash pop`
   leaves the work stashed when the long target times out. Report a
   pre-existing overflow instead of quietly fixing or quietly inheriting it.

2. **Fix structurally, not per-symptom.** Prefer the shared fix (a token, a
   shared text-shadow rule, a layout container) over per-element nudges; most
   drift exists because a surface predates a shared pattern. New CSS goes
   next to the component's existing block in `styles.css`.
3. **Re-capture and re-look.** Same harness, same scenes. Diff by eye against
   the baseline; a fix that helps landscape can break portrait.
4. **Gates + ship.** `make build && make test && make lint && make fmt-check`,
   a changeset fragment when anything user-visible changed, then the `commit`
   skill. Presentation-only passes rarely need new tests; engine untouched
   means the suite should be green unmodified.

## Skill self-improvement

Load the **`skill-reflection`** skill before this session commits. A settled
quality rule belongs in the bar above; a new surface earns a `SCENES` or
`SURFACES` entry in `scripts/screenshot.mjs` in the same change
that ships it — a surface the harness can't reach is a surface no sweep will
ever look at.
