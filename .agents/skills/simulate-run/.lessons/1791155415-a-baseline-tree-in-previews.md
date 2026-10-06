---
title: Take the before-numbers from a copy of origin/main in previews/, not by checking files out over the work
date: 2026-10-04
concepts: [baseline, before-after, labs, worktree]
---

Restoring `origin/main`'s files over a working tree to measure the "before" risks the work and is refused in a sandboxed session. Instead unpack the base into the gitignored previews: `git archive origin/main | tar -x -C previews/base` and `ln -s ../../node_modules previews/base/node_modules`, then run any pure-Node lab there (`npm run sim`, `ride`, `technique -- --sheets=none --json=…`, or a scratch sweep copied into `previews/base/previews/`) beside the same run in the work tree. Both trees live side by side for the whole session, so a byte-identity check is a `cmp` of the two tables with npm's `>` echo lines stripped.
