<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# Conformance

Fall Line is built to the fleet's game guidelines, and `AGENTS.md` names the
version it follows. This page is the ledger of where the repository
**knowingly falls short** of them: one row per topic, the verdict, the
evidence, and what closing the gap would cost. A rule this page does not name
is one the repository meets; a gap found and not written down here is a bug in
this page.

**Verdicts:** ◐ partial, with the gap named · ✗ not met · ⊘ a deliberate
deviation, by owner decision.

A row with no date behind it is an opinion, so every row carries the day it
was last checked against the tree. The closing step of a `maintenance` sweep
walks this table: re-check each row, re-date the ones that still hold, delete
the ones the tree has closed.

| Subject | V | Evidence, and what closing it costs | Checked |
| --- | :-: | --- | --- |
| Catalogs as data | ⊘ | **By owner decision, as in the sibling games.** Mountains are generated from a seed rather than authored, so the catalogs are `engine/game/defs/` (`skis.ts`, `tuning.ts`, `modes.ts`, …) and `engine/mapgen/rules.ts` — TypeScript consts, not schema-validated data files. The type checker is the schema and a cross-reference is a compile error. Lost: a non-programmer cannot add a pair of skis, and no mod could ship one. The path, when it pays: `defs/` becomes the compiled output of a validated data file per catalog. | 2026-10-19 |
| One command per capability | ✗ | `make sim`, `make screenshots`, `make bench`, `make icons` and the store targets exist. **There is no `make store-shots`**: the store screenshot recipes are written per game against its own HUD and mountains, and have not been written for this one yet. | 2026-10-19 |
| Slots never share storage | ◐ | The manifest's `id`/`scope`/`start_url`/`name` and the service worker's cache id branch per slot, and every stored structure carries a version in its key (`fall-line.settings.v1`, `.stats.v1`, `.benchmarks.v1`, …). **The keys do not branch per slot**: they are keyed by origin, so `/preview/` and `/` read and write the same saves. Closing it: a slot prefix on every key, with a read of the old key as a migration. | 2026-10-19 |
| Migration fixtures | ✗ | No save fixtures captured from a shipped build exist yet (no build has shipped to a store), and nothing writes a save by write-then-move. The first store release is the build to capture them from. | 2026-10-19 |
| Reference device and frame rate | ✗ | No reference device and no frame-rate target are written down. `make profile`, `make cpu-cost` and DEVELOPER ▸ BENCHMARK measure what a frame costs; nothing states the phone it must hold a given rate on. | 2026-10-19 |
| A rule error ends the run visibly | ◐ | The REPRO line on the developer page and the URL it writes (`?seed=`, `?t=`, `?pose=`) stand a run up again, and the engine's ring buffer is shown there. Not established: what a thrown rule error does to a run in progress — the run loop does not catch it into a visible end and a working screen. | 2026-10-19 |
| Text as a keyed catalog | ◐ | Every word the HUD and the menus show is a key in `pwa/src/game/strings*.ts`, and composed lines are templates. One locale, no pseudo-locale pass over the longest rendering, and a TypeScript const cannot miss a key, so there is no fallback to fail on until the table is data. | 2026-10-19 |
| Dependency licences | ◐ | `provenance.json` lists every shipped asset, and `make licences` holds every npm package in the three lockfiles to the fleet's allow-list. **The desktop app's Rust crates are not checked**: `Cargo.lock` records no licence, so covering them needs `cargo metadata` (or a `cargo-deny` step) in the desktop workflow. | 2026-10-19 |
| Interface as content | ✗ | The HUD and menus are Preact components, not authored content with a schema and stable ids — though every word they show is a key in the strings table. With no mod boundary the interface is not required to be content. | 2026-10-19 |
