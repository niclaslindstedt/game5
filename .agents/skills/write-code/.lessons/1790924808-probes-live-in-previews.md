---
title: A throwaway Node probe that imports the engine goes under previews/, not the scratchpad or scripts/
date: 2026-10-02
scope: scripts/
concepts: [labs, probes, lint]
---

Node resolves `@niclaslindstedt/oss-game-framework` from the probe's own
directory, so a probe in the session scratchpad dies with
ERR_MODULE_NOT_FOUND; one under `scripts/` runs but `make lint` (eslint over
the whole tree) fails on it. `previews/` is inside the repo, gitignored and
eslint-ignored: `aliasEngine(root)` then `import(join(root, "engine/index.ts"))`
works there and nothing gates on it.
