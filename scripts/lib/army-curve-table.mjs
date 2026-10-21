// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ESCALATION CURVE (`make army-ground ARGS=--table=curve`): a whole
// hunt from the theft, off the real engine on a real map — the air
// ambulance taken (`raiseHeat(state, "stole-ambulance")`) and the army left
// to climb the stars as it would on a free ride, the whole roster and the
// ground waves out. A row a quarry:
//
//   * `run`: the bot skiing on, away from them (evasive: never stood);
//   * `still`: stood where he took it;
//   * `hide`: skiing until the hunt has reached `hide.stars`, then stood
//     under the thickest trees within `hide.reach` m (a lab's stage: he is
//     put there) — the way a hunt is meant to be lost.
//
// The columns: the run time each star was first reached (from the theft),
// the share of the hunt he was SEEN (the stars solid), the longest he was
// out of every pursuer's sight, how the hunt ended (lost, dead, arrested)
// and when, the snowmobiles' rounds and the rounds of theirs in him, and
// every round and fragment of the army's in him. Reads nothing the engine
// does not publish.

const f = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : "—");

const HIDE = { stars: 2, reach: 300 };

/** The point within `reach` m of (x, z) with the most trunks within 12 m. */
function thickest(E, level, x, z, reach) {
  const near = [];
  let best = { x, z, n: -1 };
  for (let dx = -reach; dx <= reach; dx += 15)
    for (let dz = -reach; dz <= reach; dz += 15) {
      const px = x + dx;
      const pz = z + dz;
      if (Math.hypot(dx, dz) > reach) continue;
      const n = E.treesNear(level, px, pz, 12, near).length;
      if (n > best.n) best = { x: px, z: pz, n };
    }
  // Beside the trunk nearest the middle, under its crown.
  const at = E.treesNear(level, best.x, best.z, 12, near);
  if (at.length > 0) {
    const t = level.trees[at[0]];
    best = { x: t.x + 1.2, z: t.z + 0.4, n: best.n };
  }
  return best;
}

export function curveTable(E, level, args, list) {
  const dt = E.TUNING.dt;
  const quarries = args.quarry === "skier,still" ? ["run", "still", "hide"] : list(args.quarry);
  const rows = [];
  for (const quarry of quarries) {
    const s = E.createGame({
      level,
      seed: args.seed,
      mode: "free",
      quiet: true,
      crowd: 0,
      gore: !args.sfw,
      sfw: args.sfw,
    });
    for (let i = 0; i < 4 / dt; i++) E.step(s, E.botInput(s));
    E.raiseHeat(s, "stole-ambulance");
    const t0 = s.t;
    const row = {
      quarry,
      reached: [NaN, NaN, NaN, NaN, NaN, NaN],
      seen: 0,
      steps: 0,
      longest: 0,
      ended: "—",
      at: NaN,
      sledRounds: 0,
      sledHits: 0,
      hits: 0,
      by: {},
    };
    let hidden = false;
    let out = 0;
    for (let i = 0; i < args.seconds / dt; i++) {
      if (quarry === "hide" && !hidden && (s.wanted?.stars ?? 0) >= HIDE.stars) {
        const c = s.skier;
        const p = thickest(E, level, c.x, c.z, HIDE.reach);
        E.standSkier(s, p.x, p.z, c.heading);
        hidden = true;
      }
      const still = quarry === "still" || (quarry === "hide" && hidden);
      E.step(s, still ? E.NEUTRAL_INPUT : E.botInput(s));
      const w = s.wanted;
      if (!w) break;
      for (let k = 1; k <= 5; k++)
        if (Number.isNaN(row.reached[k]) && Number.isFinite(w.reached[k]) && w.peak >= k)
          row.reached[k] = Math.max(0, w.reached[k] - t0);
      for (const e of s.events) {
        if (e.kind !== "gunfire" || e.phase !== "hit") continue;
        row.hits++;
        row.by[e.weapon] = (row.by[e.weapon] ?? 0) + 1;
        if (e.weapon === "lmg") row.sledHits++;
      }
      for (const e of s.events)
        if (e.kind === "gunfire" && e.weapon === "lmg" && e.phase === "shot") row.sledRounds++;
      if (w.ended !== null) {
        row.ended = w.ended === "escaped" ? "lost" : w.ended;
        if (w.ended === "killed" && s.gore?.cause) row.ended += ` (${s.gore.cause})`;
        row.at = w.endedAt - t0;
        break;
      }
      row.steps++;
      if (w.seen) {
        row.seen++;
        out = 0;
      } else {
        out += dt;
        row.longest = Math.max(row.longest, out);
      }
    }
    rows.push(row);
  }
  console.log(
    "| Quarry | ★1 | ★2 | ★3 | ★4 | ★5 | Seen | Longest out of sight, s | Ended | At, s | Snowmobile rounds (in him) | In him, all (by weapon) |",
  );
  console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const r of rows) {
    const st = r.reached.slice(1).map((v) => f(v));
    console.log(
      `| ${r.quarry} | ${st.join(" | ")} | ${f((100 * r.seen) / Math.max(1, r.steps))} % | ${f(r.longest, 1)} | ${r.ended} | ${f(r.at)} | ${r.sledRounds} (${r.sledHits}) | ${r.hits}${
        r.hits
          ? ` (${Object.entries(r.by)
              .map(([k, n]) => `${k} ${n}`)
              .join(", ")})`
          : ""
      } |`,
    );
  }
  console.log("");
  return rows;
}
