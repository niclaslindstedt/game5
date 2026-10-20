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
// traffic (`--who`), each at the speeds it goes. Each row prints both sides:
// whether the player was thrown, his worst AIS, his severity score, dead
// or down, his worst injuries; and the amateur knocked, killed, injured
// past getting up, crushed and back up — and who `casualtiesOf` lists for
// the rescue to collect. Pure Node.
//
//   node scripts/body-hits-lab.mjs [--who=amateur,civilian,crew,walker,patrol,sled,thrown,groomer,car]
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
      help: "who is run into, and by what, comma-separated (amateur, civilian, crew, walker, patrol, sled, thrown, groomer, car)",
    },
  },
  "usage: node scripts/body-hits-lab.mjs [--who=LIST] [--seconds=N] [--json=FILE]",
);

aliasEngine(root);
const lab = await import(join(root, "tests/support/body-hits.ts"));
const { HIT_BODIES, HIT_SPEEDS, footRow, hitRow } = lab;
const WHO = ["amateur", "civilian", "crew", "walker", "patrol", "sled", "thrown", "groomer", "car"];
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
for (const who of asked) {
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
if (args.json) writeFileSync(args.json, JSON.stringify({ rows }, null, 2));
