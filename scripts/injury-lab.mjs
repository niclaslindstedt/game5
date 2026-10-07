#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE INJURY LAB — does a moment hurt a skier the way it hurts a body?
// Every scenario in `tests/support/injury-scenarios.ts` stages the skier at
// the moment before a blow — thrown off his skis and posed (head first, on
// his back, on a side, onto his hands, on a shoulder, on his seat) and
// driven into the snow by its kind, or into a trunk, a lift tower's bare
// steel or its pad, a cabin's log wall; or on his skis, dropped off a cliff
// onto the flat, landed in the back seat or over the tips, an edge caught,
// skied into a solid — and lets the engine deal it, many times over, each
// trial a run seed of its own. A row is the moment's rates: how often each
// injury came of it, against the groups the scenario EXPECTS (each in at
// least half the trials) and the injuries it must NEVER do (in at most an
// eighth). `tests/injury_lab_test.ts` holds the same rows.
//
//   make injuries                          every scenario, the table
//   make injuries ARGS="--only=head-ice,drop-20"   some of them
//   make injuries ARGS="--list"            every injury's rate under each row
//   make injuries ARGS="--json"            previews/injuries.json, a baseline
//   make injuries ARGS="--compare previews/injuries.json"
//
// Pure Node: the engine at 120 Hz, no renderer. Exits non-zero when a
// scenario misses.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));
const B = await import(join(root, "tests/support/injury-stage.ts"));
const S = await import(join(root, "tests/support/injury-scenarios.ts"));

const args = parseArgs(
  process.argv.slice(2),
  {
    only: { kind: "string", help: "comma-separated scenario ids" },
    trials: { kind: "number", default: B.TRIALS, help: "trials a scenario" },
    list: { kind: "flag", help: "print every injury's rate under each row" },
    json: { kind: "flag", help: "write previews/injuries.json (the baseline)" },
    compare: { kind: "string", help: "a baseline to print beside this run" },
  },
  "usage: make injuries ARGS='[--only ids] [--trials n] [--list] [--json] [--compare file]'",
);

const only = args.only ? new Set(args.only.split(",")) : null;
const scenarios = S.INJURY_SCENARIOS.filter((s) => !only || only.has(s.id));
const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;

const pct = (x) => `${Math.round(x * 100)}%`.padStart(4);
const out = {};
let missed = 0;

console.log(
  `${"scenario".padEnd(20)} ${"pass".padEnd(4)} ${"AIS".padStart(3)} ${"g".padStart(5)}  expected (rate)  ·  never (rate)`,
);
for (const s of scenarios) {
  const r = B.ratesOf(s, args.trials);
  const fails = S.missesOf(s, r);
  const exp = s.expect.map(
    (group) =>
      `${group.length > 3 ? `${group.slice(0, 3).join("|")}…` : group.join("|")} ${pct(B.anyRate(r, group))}`,
  );
  for (const bone of s.shatter ?? []) exp.push(`${bone} shattered ${pct(B.shatterRate(r, bone))}`);
  const nev = (s.never ?? [])
    .map((k) => [k, r.rate.get(k) ?? 0])
    .filter(([, rate]) => rate > 0)
    .map(([k, rate]) => `${k} ${pct(rate)}`);
  if (fails.length) missed++;
  const rates = Object.fromEntries([...r.rate].sort((a, b) => b[1] - a[1]));
  out[s.id] = { pass: fails.length === 0, worst: r.worst, peak: r.peak, rates };
  const was = before?.[s.id];
  const delta = was ? `  (was ${was.pass ? "pass" : "FAIL"}, AIS ${was.worst})` : "";
  console.log(
    `${s.id.padEnd(20)} ${(fails.length ? "FAIL" : "ok").padEnd(4)} ${String(r.worst).padStart(3)} ${r.peak.toFixed(0).padStart(5)}  ${exp.join(", ") || "—"}  ·  ${nev.join(", ") || "—"}${delta}`,
  );
  console.log(`${"".padEnd(20)} ${s.title}`);
  for (const f of fails) console.log(`${"".padEnd(25)}✗ ${f}`);
  if (args.list) {
    const all = [...r.rate].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v)}`);
    const causes = [...r.causes].map(([k, n]) => `${k} ${n}`).join(", ");
    const land = r.land > 0 ? `, landing ${r.land.toFixed(1)} g` : "";
    console.log(`${"".padEnd(25)}thrown by: ${causes}${land}`);
    console.log(`${"".padEnd(25)}${all.join(", ") || "nothing"}`);
    const shattered = new Map();
    for (const t of r.trials)
      for (const b of t.shattered) shattered.set(b, (shattered.get(b) ?? 0) + 1);
    if (shattered.size) {
      const list = [...shattered].map(([b, k]) => `${b} ${pct(k / r.trials.length)}`).join(", ");
      console.log(`${"".padEnd(25)}shattered: ${list}`);
    }
  }
}
console.log(`\n${scenarios.length - missed} of ${scenarios.length} scenarios as expected`);

// THE COVERAGE: every injury the catalog has that no scenario expects —
// the moments this list is still short of. A burn is a burning wreck's
// (`heat`), staged by the helicopter's own suite, not here.
if (!only) {
  const named = new Set(S.INJURY_SCENARIOS.flatMap((s) => s.expect.flat()));
  const loose = Object.keys(E.INJURIES).filter(
    (k) => !named.has(k) && E.INJURIES[k].mech !== "heat",
  );
  console.log(`expected by no scenario (${loose.length}): ${loose.join(", ") || "none"}`);
}

if (args.json) {
  const file = join(root, "previews/injuries.json");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`wrote ${file}`);
}
process.exit(missed ? 1 : 0);
