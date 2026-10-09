// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LANDING LAB'S ATTITUDE SWEEP (`make landing ARGS=--attitudes`): what
// a player who MEANS to land badly gets. The landing lab's own table skis
// the generated mountains hands off and asks that he rides them away; this
// asks the other half — that a landing a body could not ride away throws
// him. Each cell is a drop staged on the bench (`tests/support/synthetic.ts`)
// with `placeRun`: onto the groomer, onto a 24° landing slope and into
// powder, from three heights at two speeds, the skis held off true by a set
// attitude — tips down, tails down, rolled, sideways to the way — with the
// air's hands off (`Assist.air` 0), so the attitude set is the attitude that
// lands. A cell reads `·` ridden away or the cause that threw him, and the
// landing's load in g.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const D = Math.PI / 180;

/** The attitudes, off the slope he lands on: tips down (+) or up (−), the
 * roll across it, the skis' yaw off the way he is going. */
const ATTITUDES = [
  ["true", 0, 0, 0],
  ["tips 10° down", 10, 0, 0],
  ["tips 20° down", 20, 0, 0],
  ["tips 30° down", 30, 0, 0],
  ["tips 40° down", 40, 0, 0],
  ["tips 55° down", 55, 0, 0],
  ["tails 20° down", -20, 0, 0],
  ["tails 35° down", -35, 0, 0],
  ["tails 50° down", -50, 0, 0],
  ["rolled 15°", 0, 15, 0],
  ["rolled 25°", 0, 25, 0],
  ["rolled 35°", 0, 35, 0],
  ["rolled 50°", 0, 50, 0],
  ["sideways 20°", 0, 0, 20],
  ["sideways 35°", 0, 0, 35],
  ["sideways 50°", 0, 0, 50],
  ["sideways 70°", 0, 0, 70],
  ["sideways 90°", 0, 0, 90],
  ["switch (180°)", 0, 0, 180],
  ["tips 20° + rolled 20°", 20, 20, 0],
  ["tips 20° + sideways 30°", 20, 0, 30],
];

/** The grounds: a level groomer, a kicker's 24° landing, a level powder field. */
const GROUNDS = [
  { id: "groomer", level: (S) => S.flatLevel({ packed: 1 }), z: 200, slope: 0 },
  {
    id: "landing 24°",
    level: (S) => S.flatLevel({ packed: 1, grade: 0.45, slopeFrom: 0 }),
    z: 1500,
    slope: Math.atan(0.45),
  },
  { id: "powder", level: (S) => S.flatLevel({ packed: 0 }), z: 200, slope: 0 },
];

/** CoG heights over the snow, m, and speeds, km/h. */
const HEIGHTS = [1.6, 3, 6];
const SPEEDS = [45, 80];

function drop(E, level, ground, att, height, kmh) {
  const [, tips, roll, yaw] = att;
  const state = E.createGame({
    level,
    mode: "free",
    rivals: 0,
    countdown: 0,
    crowd: 0,
    grimbear: false,
    quiet: true,
    assist: { yaw: 1, air: 0 },
  });
  const heading = yaw * D;
  const along = Math.cos(heading);
  E.placeRun(state, {
    x: 1500,
    z: ground.z,
    heading,
    speed: kmh / 3.6,
    height,
    vy: 0,
    // The slope falls along +z: tips down is a negative pitch.
    pitch: -ground.slope * along - tips * D,
    roll: roll * D,
  });
  const c = state.skier;
  // The way is down the slope (+z), whatever the skis' yaw.
  c.vx = 0;
  c.vz = kmh / 3.6;
  const idle = { steer: 0, tuck: 0, brake: 0, lean: 0, reset: false, jump: false };
  let land = null;
  let thrown = null;
  for (let i = 0; i < 4 * E.TUNING.physicsHz && thrown === null; i++) {
    E.step(state, idle);
    for (const e of state.events) {
      if (!land && e.kind === "land" && e.airTime >= E.TUNING.landing.air) {
        land = { t: state.t, g: e.g, off: e.off, nose: E.noseDown(state) };
      }
      if (e.kind === "wipeout") thrown = e.cause;
    }
    if (land && state.t - land.t > 1.5) break;
  }
  return { g: land?.g ?? 0, off: land?.off ?? 0, thrown };
}

export function attitudeSweep(E, S, args, root) {
  const cols = [];
  for (const h of HEIGHTS) for (const v of SPEEDS) cols.push({ h, v });
  const out = {};
  let ridden = 0;
  let total = 0;
  for (const ground of GROUNDS) {
    const level = ground.level(S);
    console.log(`\n  ${ground.id}  (· ridden away, else what threw him; the load in g)`);
    console.log("    " + "".padEnd(24) + cols.map((k) => `${k.h} m ${k.v}`.padStart(13)).join(""));
    out[ground.id] = {};
    for (const att of ATTITUDES) {
      const cells = cols.map((k) => drop(E, level, ground, att, k.h, k.v));
      out[ground.id][att[0]] = cells.map((r) => r.thrown ?? "");
      for (const r of cells) {
        total++;
        if (!r.thrown) ridden++;
      }
      console.log(
        "    " +
          att[0].padEnd(24) +
          cells
            .map((r) =>
              `${r.thrown ? r.thrown.toUpperCase() : "·"} ${r.g.toFixed(0)}g`.padStart(13),
            )
            .join(""),
      );
    }
  }
  let before = null;
  if (args.compare) before = JSON.parse(readFileSync(args.compare, "utf8"));
  console.log(
    `\n  ridden away ${ridden}/${total}` +
      (before ? ` · before ${before.ridden}/${before.total}` : ""),
  );
  if (before) {
    const moved = [];
    for (const g of Object.keys(out))
      for (const a of Object.keys(out[g]))
        out[g][a].forEach((now, i) => {
          const was = before.cells?.[g]?.[a]?.[i];
          if (was !== undefined && was !== now)
            moved.push(
              `    ${g} · ${a} · ${cols[i].h} m ${cols[i].v} km/h: ${was || "ridden"} → ${now || "ridden"}`,
            );
        });
    console.log(`  cells moved: ${moved.length}`);
    for (const m of moved) console.log(m);
  }
  if (args.json) {
    mkdirSync(join(root, "previews"), { recursive: true });
    writeFileSync(
      join(root, "previews/landing-attitudes.json"),
      JSON.stringify({ ridden, total, cells: out }, null, 2),
    );
    console.log("\nwrote previews/landing-attitudes.json");
  }
}
