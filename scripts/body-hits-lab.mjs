#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A PERSON RUN INTO (`make body-hits`): the player driven at 10 to 90 km/h
// into an amateur stood still — a grown man and a child — on a free ride
// with the INJURIES switch on and off (`tests/support/body-hits.ts`, the
// meeting `tests/body_hits_test.ts` holds); and the same into a person on
// foot (`engine/game/foot.ts`, `tests/civilian_body_hits_test.ts`): a
// civilian, a rescue crew member, a dog walker and a ski patrolman run
// into on skis, and a civilian met by the snowmobile the player rides, by
// his body thrown, by a piste machine and by a car of the village's
// traffic (`--who`), each at the speeds it goes; and a body LYING on the
// snow gone over (`--who=lying`, `engine/game/lying.ts`,
// `tests/lying_bodies_test.ts`: a dead, injured or knocked civilian lying
// across the line, along it or with his legs under the tips, met on skis,
// on the snowmobile and by a piste machine — its own table: the passes,
// the rider thrown, the speed taken and lost, the body pushed, dead,
// injured and crushed). Each row prints both sides:
// whether the player was thrown, his worst AIS, his severity score, dead
// or down, his worst injuries; and the amateur knocked, killed, injured
// past getting up, crushed and back up — and who `casualtiesOf` lists for
// the rescue to collect. Pure Node.
//
//   node scripts/body-hits-lab.mjs [--who=amateur,civilian,crew,walker,patrol,sled,thrown,groomer,car,lying]
//                                  [--seconds=N] [--json=FILE]

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(
  process.argv.slice(2),
  {
    seconds: { kind: "number", default: 15, help: "seconds ridden on after the meeting" },
    json: { kind: "string", default: "", help: "write the rows to this file" },
    who: {
      kind: "string",
      default: "amateur,civilian,crew,walker,patrol,sled,thrown,groomer,car",
      help: "who is run into, and by what, comma-separated (amateur, civilian, crew, walker, patrol, sled, thrown, groomer, car, lying — a body on the snow gone over, its own table; not in the default)",
    },
  },
  "usage: node scripts/body-hits-lab.mjs [--who=LIST] [--seconds=N] [--json=FILE]",
);

aliasEngine(root);
const lab = await import(join(root, "tests/support/body-hits.ts"));
const { HIT_BODIES, HIT_SPEEDS, footRow, hitRow } = lab;
const WHO = [
  "amateur",
  "civilian",
  "crew",
  "walker",
  "patrol",
  "sled",
  "thrown",
  "groomer",
  "car",
  "lying",
];
// The speeds each goes at: a piste machine at its working, climbing and
// driven pace, a car at the village's and the road out's.
const SPEEDS = { groomer: [9, 12, 22], car: [15, 25, 45] };
const asked = args.who.split(",").filter(Boolean);
for (const w of asked) {
  if (!WHO.includes(w)) {
    console.error(`unknown --who ${w} (one of ${WHO.join(", ")})`);
    process.exit(1);
  }
}

const pad = (s, n) => String(s).padEnd(n);
const yes = (b) => (b ? "yes" : "-");
console.log(
  `${pad("who", 9)}${pad("km/h", 5)}${pad("body", 6)}${pad("inj", 4)}| ${pad("thrown", 7)}${pad("AIS", 4)}${pad("ISS", 4)}${pad("dead", 5)}${pad("down", 5)}| ${pad("knock", 6)}${pad("killed", 7)}${pad("hurt", 5)}${pad("crush", 6)}${pad("up", 4)}| casualties · the player's worst`,
);
const rows = [];
for (const who of asked.filter((w) => w !== "lying")) {
  for (const gore of [true, false]) {
    for (const body of who === "sled" || who === "patrol" ? ["man"] : HIT_BODIES) {
      for (const kmh of SPEEDS[who] ?? HIT_SPEEDS) {
        const r =
          who === "amateur"
            ? hitRow(kmh, body, gore, args.seconds)
            : footRow(kmh, body, gore, who, args.seconds);
        rows.push({ who, ...r });
        const worst = [...r.injuries]
          .sort((a, b) => Number(b.split(":")[1]) - Number(a.split(":")[1]))
          .slice(0, 4)
          .join(" ");
        console.log(
          `${pad(who, 9)}${pad(kmh, 5)}${pad(body, 6)}${pad(gore ? "on" : "off", 4)}| ${pad(yes(r.thrown), 7)}${pad(r.worst, 4)}${pad(r.iss, 4)}${pad(yes(r.dead), 5)}${pad(yes(r.down), 5)}| ${pad(yes(r.knocked), 6)}${pad(yes(r.killed), 7)}${pad(yes(r.injured), 5)}${pad(r.crush.toFixed(2), 6)}${pad(yes(r.up), 4)}| ${r.casualties.join(", ") || "—"} · ${worst || "—"}`,
        );
      }
    }
  }
}
if (asked.includes("lying")) {
  const { lyingRow } = await import(join(root, "tests/support/lying.ts"));
  console.log(
    `\n${pad("rider", 8)}${pad("as", 8)}${pad("lie", 7)}${pad("km/h", 5)}${pad("inj", 4)}| ${pad("passes", 7)}${pad("thrown", 7)}${pad("taken", 6)}${pad("lost", 6)}${pad("AIS", 4)}| ${pad("moved", 6)}${pad("dead", 5)}${pad("hurt", 5)}crush`,
  );
  const cases = [];
  for (const gore of [true, false]) {
    for (const as of ["dead", "knocked"])
      for (const lie of ["across", "along", "legs"])
        for (const kmh of [20, 45, 90]) cases.push({ rider: "skis", as, lie, kmh, gore });
    for (const as of ["dead", "injured", "knocked"])
      for (const kmh of [20, 45, 90]) cases.push({ rider: "sled", as, lie: "across", kmh, gore });
    for (const as of ["injured", "knocked"])
      for (const kmh of [9, 22]) cases.push({ rider: "groomer", as, lie: "across", kmh, gore });
  }
  const num = (v) => (Number.isFinite(v) ? v.toFixed(1) : "—");
  for (const k of cases) {
    const r = lyingRow({ who: "civilian", ...k });
    rows.push({ who: "lying", ...r });
    console.log(
      `${pad(k.rider, 8)}${pad(k.as, 8)}${pad(k.lie, 7)}${pad(k.kmh, 5)}${pad(k.gore ? "on" : "off", 4)}| ${pad(r.passes, 7)}${pad(yes(r.thrown), 7)}${pad(num(r.taken), 6)}${pad(num(r.lost), 6)}${pad(r.worst, 4)}| ${pad(r.moved.toFixed(2), 6)}${pad(yes(r.dead), 5)}${pad(yes(r.injured), 5)}${r.crush.toFixed(2)}`,
    );
  }
}
if (args.json) writeFileSync(args.json, JSON.stringify({ rows }, null, 2));
