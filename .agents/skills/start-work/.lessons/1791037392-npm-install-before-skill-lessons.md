---
title: Run npm install before the first `npx ogf-skill-lessons` — the bin is the framework's, not npm's
date: 2026-10-03
concepts: [preflight, tooling]
---

On a fresh clone `npx ogf-skill-lessons start-work` answers a 404 from the npm registry: there is no package of that name, the bin ships inside the `@niclaslindstedt/oss-game-framework` git dependency. `npm install` (a minute, in the background while the preflight's git steps run) makes every `ogf-*` bin resolve.
