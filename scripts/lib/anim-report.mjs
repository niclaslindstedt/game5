// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ANIMATION LAB'S PAGE (`make anim`): `previews/anim/index.html`, every
// scene's row in one table — red where it snaps, pops, stretches or clips —
// and its sheet under it, so the lab's whole run is read in a browser and
// can be handed on as it stands (the sheets are beside it, linked by name).

import { writeFileSync } from "node:fs";
import { join } from "node:path";

const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

/** Write the page over `rows` (the lab's table) into `dir`. */
export function writeReport(dir, rows, { most, angleMost }) {
  const pct = (v) => `${Math.round(v * 100)}%`;
  const bad = (b) => (b ? ' class="bad"' : "");
  const body = rows
    .map(
      (r) => `<tr id="row-${esc(r.family)}-${esc(r.id)}">
<td>${esc(r.family)}</td><td><a href="#${esc(r.family)}-${esc(r.id)}">${esc(r.id)}</a></td>
<td>${r.frames}</td><td${bad(r.snapShare > 0)}>${pct(r.snapShare)}</td>
<td${bad(r.worstJolt > most)}>${r.worstJolt}</td><td>${esc(r.worstJoint)} @${r.worstAt}s</td>
<td${bad(r.pops > 0)}>${r.pops}</td><td${bad(r.angleSnaps > 0)}>${r.angleSnaps}</td>
<td>${r.worstAngle} ${esc(r.worstAngleId)}</td><td${bad(!r.clean && r.stretch > 3)}>${r.stretch}% ${esc(r.stretchBone)}</td>
<td${bad(r.clips > 0)}>${r.clips}</td><td>${r.jerkRms}</td>
<td${bad(!r.clean)}>${r.clean ? "clean" : "look"}</td></tr>`,
    )
    .join("\n");
  const sheets = rows
    .filter((r) => r.sheet)
    .map(
      (r) => `<section id="${esc(r.family)}-${esc(r.id)}">
<h2>${esc(r.family)} · ${esc(r.id)} <a href="#top">↑</a></h2>
<p>${esc(r.title ?? "")}</p>
<a href="${esc(r.sheet)}"><img loading="lazy" src="${esc(r.sheet)}" alt="${esc(r.id)}"></a>
</section>`,
    )
    .join("\n");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Animation lab</title>
<style>
:root { color-scheme: dark; }
body { margin: 0; padding: 16px; background: #0e1218; color: #dce2ec; font: 14px/1.4 system-ui, sans-serif; }
table { border-collapse: collapse; font-variant-numeric: tabular-nums; }
th, td { padding: 3px 8px; border-bottom: 1px solid #2a3240; text-align: left; white-space: nowrap; }
th { color: #8c96a8; font-weight: 600; position: sticky; top: 0; background: #0e1218; }
td.bad { color: #f4504a; font-weight: 600; }
a { color: #7ab4ff; }
.wrap { overflow-x: auto; }
img { max-width: 100%; height: auto; border: 1px solid #343c4a; }
section { margin: 32px 0; }
</style></head><body id="top">
<h1>Animation lab</h1>
<p>${rows.filter((r) => r.clean).length} of ${rows.length} scenes clean. A frame SNAPS past ${most} m/s² of jolt on any joint; an angle snaps past ${angleMost} deg/s²; a pop is a joint flung out of line and back; stretch is a limb's length off its middle; a clip is a limb through another or the trunk.</p>
<p><a href="summary.png">summary.png</a></p>
<div class="wrap"><table>
<tr><th>family</th><th>scene</th><th>frames</th><th>snap</th><th>worst m/s²</th><th>joint</th><th>pops</th><th>angle snaps</th><th>worst deg/s²</th><th>stretch</th><th>clips</th><th>jerk</th><th>verdict</th></tr>
${body}
</table></div>
${sheets}
</body></html>
`;
  writeFileSync(join(dir, "index.html"), html);
}
