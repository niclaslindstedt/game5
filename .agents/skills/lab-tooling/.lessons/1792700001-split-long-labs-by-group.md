---
title: Run a four-hour browser lab a group at a time into its own JSON, and merge after — a container restart then costs one group
date: 2026-10-16
scope: scripts/rock-eval.mjs, scripts/lib/rock-eval-report.mjs
concepts: [labs, long-runs, resumable, rock-eval]
---

`make rock-eval`'s full run is about four hours under SwiftShader. Driven
group by group (`--groups=<g> --json=<dir>/<g>.json.tmp`, renamed when the
group finishes, `--skip-build` after the first, a progress file, and a loop
that skips any group whose JSON exists) the run resumes where it stopped;
the report's own `totals`, `table`, `compare` and `pages` merge the groups'
`maps`, `groupNotes` and `scenes` into the one result the whole run writes,
and `make shimmer --json` supplies its `flicker`. While iterating, `--no-cost`
skips the price passes and draws a scene in under a minute.
