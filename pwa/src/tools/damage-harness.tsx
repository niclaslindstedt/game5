// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DAMAGE LAB'S PAGE (`make damage`, `scripts/damage-preview.mjs`): the
// HUD's body panel and g meter drawn by the game's own components and
// stylesheets over bodies the lab hands it — STAGED here (a body built
// injury by injury off the engine's catalog) and RIDDEN by the driver (a
// ride-lab scenario skied through the engine, the body at its worst).
//
// Two kinds of page, one file:
//   ?sheet=<name>   the contact sheet the driver photographs: a grid of
//                   FRAMES (iframes of this page at a real viewport, so the
//                   HUD's vmin is the device's) or of enlarged figures;
//   ?frame=<case>   one frame: a snowy backdrop and the HUD over it, the
//                   case read off the sheet that holds it (`parent`).
// The sheets: `panels` (every case at 1280×720, the panel's strip of it),
// `viewports` (one case at the three reference viewports, whole), `plate`
// (the figure enlarged, sound, every bone cracked, every bone broken, a
// mixed body), `force` (the figure enlarged with every bone fractured at
// one energy a column — a hairline, a simple break struck lightly and
// harder, a wedge, shattered, shattered hard), `blows` (the figure enlarged
// over each HIGH-G crash the driver skied through the engine — a trunk
// head-on and on the shoulder at rising speeds, a fall onto his side from
// rising heights — every fracture with the energy that did it), `refs` (the
// enlarged figure over each reference image the driver copied in — local,
// never committed).

import "../styles.css";
import "../body.css";

import { render, type JSX } from "preact";

import {
  BODY_PARTS,
  BONES,
  FRACTURE_GRADE,
  INJURIES,
  PART,
  fractureEnergyOf,
  fracturesOf,
  freshBody,
  saidOf,
  severityOf,
  type BodyPart,
  type BodyState,
  type InjuryDef,
  type InjuryKind,
} from "@engine";

import { bodyTile } from "../game/body-tile.ts";
import type { FigureSide } from "../game/body-figure.ts";
import { BodyPanel } from "../game/hud-body.tsx";
import { GForce } from "../game/hud-gforce.tsx";
import { STRINGS } from "../game/strings.ts";

/** One body to draw: its name, the body, and the clock it is read at. */
type Case = { id: string; title: string; body: BodyState; t: number };

/** A body built injury by injury: `[kind, part]` each, ranked as the
 * catalog ranks it, every one done at `energy` times its even chance's. */
function staged(id: string, title: string, list: [InjuryKind, BodyPart][], energy = 1): Case {
  const body = freshBody();
  for (const [kind, part] of list) {
    const ais = (INJURIES[kind] as InjuryDef).ais;
    body.injuries.push({ part, kind, ais, t: 0, energy });
    body.worst[PART[part]] = Math.max(body.worst[PART[part]], ais);
  }
  return { id, title, body, t: 100 };
}

/** Every fracture in the catalog of one grade, on every side. */
function everyFracture(grade: "hairline" | "break"): [InjuryKind, BodyPart][] {
  const out: [InjuryKind, BodyPart][] = [];
  for (const kind of Object.keys(INJURIES) as InjuryKind[]) {
    const def = INJURIES[kind] as InjuryDef;
    if (def.fracture !== grade || def.organ) continue;
    for (const part of BODY_PARTS) {
      const base = part.endsWith("L") || part.endsWith("R") ? part.slice(0, -1) : part;
      if (def.part === part || def.part === base) out.push([kind, part]);
    }
  }
  return out;
}

const STAGED: Case[] = [
  staged("sound", "SOUND", []),
  staged("bruised", "BRUISES AND SPRAINS", [
    ["headBump", "head"],
    ["bruisedRibs", "chest"],
    ["sprainedThumb", "handR"],
    ["bruisedKnee", "kneeL"],
    ["deadLeg", "thighR"],
  ]),
  staged("cracked", "HAIRLINES", [
    ["crackedRibs", "chest"],
    ["crackedWrist", "handL"],
    ["crackedShin", "shinR"],
    ["compressedVertebra", "back"],
    ["crackedCollarbone", "shoulderR"],
  ]),
  staged("broken", "BREAKS", [
    ["brokenFemur", "thighL"],
    ["brokenForearm", "armR"],
    ["brokenCollarbone", "shoulderL"],
    ["brokenPelvis", "pelvis"],
    ["bootTop", "shinR"],
    ["brokenJaw", "head"],
  ]),
  staged("organs", "ORGANS AND LIGAMENTS", [
    ["concussion", "head"],
    ["collapsedLung", "chest"],
    ["tornSpleen", "abdomen"],
    ["tornAcl", "kneeL"],
    ["tornMcl", "kneeR"],
    ["backStrain", "back"],
  ]),
  staged("tree", "A TRUNK AT SPEED", [
    ["brokenRibs", "chest"],
    ["rupturedSpleen", "abdomen"],
    ["brokenCollarbone", "shoulderL"],
    ["crackedArm", "armL"],
    ["knockedOut", "head"],
    ["crackedPelvis", "pelvis"],
    ["spinalCord", "back"],
    ["bruisedShin", "shinL"],
  ]),
  staged("all-hairline", "EVERY BONE CRACKED", everyFracture("hairline")),
  staged("all-break", "EVERY BONE BROKEN", everyFracture("break")),
  staged(
    "shattered",
    "SHATTERED BY A TRUNK",
    [
      ["brokenFemur", "thighR"],
      ["brokenCollarbone", "shoulderL"],
      ["flailChest", "chest"],
      ["brokenPelvis", "pelvis"],
      ["brokenArm", "armL"],
      ["brokenShin", "shinR"],
    ],
    2.9,
  ),
];

/** THE FORCE LADDER: every bone fractured at one energy over its even
 * chance's a column — the `force` sheet. */
const FORCE: [string, string, "hairline" | "break", number][] = [
  ["force-crack", "HAIRLINE ×1.0", "hairline", 1],
  ["force-simple", "SIMPLE BREAK ×1.0", "break", 1],
  ["force-harder", "SIMPLE BREAK ×1.4", "break", 1.4],
  ["force-wedge", "WEDGE ×1.9", "break", 1.9],
  ["force-shatter", "SHATTERED ×2.4", "break", 2.4],
  ["force-most", "SHATTERED ×3.4", "break", 3.4],
];
for (const [id, title, grade, e] of FORCE) STAGED.push(staged(id, title, everyFracture(grade), e));

// A blow on the meter for the tree's frame.
{
  const tree = STAGED.find((c) => c.id === "tree")!;
  tree.body.impact = {
    g: 64,
    part: "chest",
    source: "tree",
    t: 0.15,
    id: 1,
    fall: true,
    rival: -1,
    amateur: -1,
  };
  tree.body.peak = 64;
  tree.body.fallPeak = 64;
}

type Lab = {
  cases: Case[];
  /** Add the driver's ridden bodies and the reference images, and build
   * the sheet; resolves once every frame has drawn. */
  build: (ridden: Case[], refs: string[]) => Promise<{ note: string; table: string[] }>;
};

declare global {
  interface Window {
    __damage?: Lab;
  }
}

const params = new URLSearchParams(location.search);

const GRADE_NAMES = Object.keys(FRACTURE_GRADE);

/** One case's facts, for the label and the table: the severity, what the
 * bones show, what the lines say. */
function factsOf(c: Case): string {
  const energy = fractureEnergyOf(c.body);
  const bones = fracturesOf(c.body)
    .map((g, i) => (g ? `${BONES[i]}:${GRADE_NAMES[g]}×${energy[i].toFixed(1)}` : ""))
    .filter(Boolean);
  const said = c.body.injuries
    .filter((h) => saidOf(h.kind))
    .map((h) => STRINGS.injury(h.kind, h.part));
  return `ISS ${severityOf(c.body)}  bones[${bones.join(" ")}]  said[${said.join(", ")}]`;
}

/** THE BACKDROP: a bright winter slope under a pale sky, the light the HUD
 * is read over for most of a run. */
const BACKDROP =
  "linear-gradient(180deg, #8fb4d8 0%, #c9dcec 34%, #eef3f7 36%, #dfe8ef 60%, #f6f8fa 100%)";

/** ONE FRAME: the HUD as the game lays it, over the backdrop. */
function Frame({ c }: { c: Case }): JSX.Element {
  const tile = bodyTile(c.body, c.t);
  return (
    <div style={{ position: "fixed", inset: 0, background: BACKDROP }}>
      <div class="hud">
        <BodyPanel tile={tile} />
        {tile.blow && <GForce blow={tile.blow} />}
      </div>
    </div>
  );
}

if (params.has("frame")) {
  const id = params.get("frame");
  const lab = (parent as Window).__damage;
  const c = lab?.cases.find((x) => x.id === id);
  document.body.style.margin = "0";
  const root = document.getElementById("sheet")!;
  if (c) render(<Frame c={c} />, root);
  // The sheet waits on this.
  (window as unknown as { __drawn: boolean }).__drawn = true;
} else {
  const sheet = params.get("sheet") ?? "panels";
  const lab: Lab = {
    cases: [...STAGED],
    build: (ridden, refs) => build(sheet, ridden, refs),
  };
  window.__damage = lab;

  async function build(
    name: string,
    ridden: Case[],
    refs: string[],
  ): Promise<{ note: string; table: string[] }> {
    lab.cases.push(...ridden);
    document.body.style.cssText = "margin:0;background:#0b1116;overflow:auto;height:auto";
    const root = document.getElementById("sheet")!;
    root.style.cssText = "display:inline-block;padding:12px;font:12px/1.3 monospace;color:#fff";
    const table = lab.cases.map((c) => `${c.id.padEnd(16)} ${factsOf(c)}`);
    if (name === "panels") {
      render(<Panels cases={lab.cases} />, root);
      await framesDrawn(root);
      return { note: `${lab.cases.length} bodies at 1280×720, the panel's strip`, table };
    }
    if (name === "viewports") {
      const c = lab.cases.find((x) => x.id === (params.get("case") ?? "tree"))!;
      render(<Viewports c={c} />, root);
      await framesDrawn(root);
      return {
        note: `${c.id} at the three reference viewports`,
        table: [table[lab.cases.indexOf(c)]],
      };
    }
    if (name === "force") {
      const cases = FORCE.map(([id]) => lab.cases.find((x) => x.id === id)!);
      render(<Plate cases={cases} side="front" px={720} width={330} />, root);
      return {
        note: "every bone fractured at one energy a column",
        table: cases.map((c) => table[lab.cases.indexOf(c)]),
      };
    }
    if (name === "closeup") {
      const cases = FORCE.map(([id]) => lab.cases.find((x) => x.id === id)!);
      render(<Closeups cases={cases} />, root);
      return {
        note: "the force ladder up close: the shoulder and arm, the pelvis and thighs, the shins",
        table: cases.map((c) => table[lab.cases.indexOf(c)]),
      };
    }
    if (name === "snap") {
      const cases = SNAP.map((id) => lab.cases.find((x) => x.id === id)!);
      render(<Snaps cases={cases} />, root);
      await new Promise((r) => requestAnimationFrame(r));
      freeze(root);
      await new Promise((r) => setTimeout(r, 300));
      return {
        note: `the bones' snap frozen at ${SNAP_AT.join(", ")} ms, the legs up close`,
        table: cases.map((c) => table[lab.cases.indexOf(c)]),
      };
    }
    if (name === "blows") {
      const cases = ridden.length ? ridden : lab.cases.filter((c) => c.id === "shattered");
      render(<Plate cases={cases} side="front" px={620} width={290} wrap facts />, root);
      return {
        note: `${cases.length} high-g crashes skied through the engine`,
        table: cases.map((c) => table[lab.cases.indexOf(c)]),
      };
    }
    if (name === "plate" || name === "back") {
      const ids = ["sound", "all-hairline", "all-break", "tree"];
      const side = name === "back" ? "back" : "front";
      render(
        <Plate cases={ids.map((id) => lab.cases.find((x) => x.id === id)!)} side={side} />,
        root,
      );
      return { note: `the figure enlarged, from the ${side}`, table };
    }
    render(<Refs refs={refs} c={lab.cases.find((x) => x.id === "sound")!} />, root);
    await Promise.all(
      [...root.querySelectorAll("img")].map((img) => (img.complete ? null : img.decode())),
    );
    return { note: `${refs.length} references under the figure`, table: refs };
  }
}

/** Every iframe in `root` loaded and drawn. */
async function framesDrawn(root: HTMLElement): Promise<void> {
  const frames = [...root.querySelectorAll("iframe")];
  await Promise.all(
    frames.map(
      (f) =>
        new Promise<void>((done) => {
          const poll = (): void => {
            const w = f.contentWindow as unknown as { __drawn?: boolean } | null;
            if (w?.__drawn) done();
            else setTimeout(poll, 50);
          };
          poll();
        }),
    ),
  );
  // Fonts, a frame's layout, and the bones' snaps settled.
  await new Promise((r) => setTimeout(r, 900));
}

const label = (title: string, sub: string): JSX.Element => (
  <div style={{ margin: "0 0 4px", maxWidth: "100%" }}>
    <div style={{ fontSize: "14px", letterSpacing: "0.06em" }}>{title}</div>
    <div style={{ opacity: 0.7, whiteSpace: "normal" }}>{sub}</div>
  </div>
);

/** A frame of `w`×`h`, showing `show`×`h` of its left. */
function Cell({ c, w, h, show }: { c: Case; w: number; h: number; show: number }): JSX.Element {
  return (
    <div style={{ width: `${show}px`, height: `${h}px`, overflow: "hidden" }}>
      <iframe
        src={`damage-preview.html?frame=${encodeURIComponent(c.id)}`}
        width={w}
        height={h}
        style={{ border: 0, display: "block" }}
      />
    </div>
  );
}

function Panels({ cases }: { cases: Case[] }): JSX.Element {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 360px)", gap: "14px" }}>
      {cases.map((c) => (
        <div key={c.id}>
          {label(c.title, factsOf(c))}
          <Cell c={c} w={1280} h={720} show={360} />
        </div>
      ))}
    </div>
  );
}

const VIEWPORTS: [string, number, number][] = [
  ["desktop 1280×720", 1280, 720],
  ["phone 390×844", 390, 844],
  ["phone on its side 844×390", 844, 390],
];

function Viewports({ c }: { c: Case }): JSX.Element {
  return (
    <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
      {VIEWPORTS.map(([name, w, h]) => (
        <div key={name}>
          {label(name, c.title)}
          <Cell c={c} w={w} h={h} show={w} />
        </div>
      ))}
    </div>
  );
}

/** THE FIGURE ENLARGED: the panel itself, its figure sized to `px`. */
function Big({
  c,
  px,
  side,
  at = null,
}: {
  c: Case;
  px: number;
  side: FigureSide;
  /** Frozen this many ms into the bones' snap; null settled. */
  at?: number | null;
}): JSX.Element {
  // Settled: every snap and flash taken to its end. Frozen: the page seeks
  // every one `at` ms in and commits it (`freeze`).
  const still =
    at === null
      ? "animation:none!important;transition:none!important"
      : "transition:none!important";
  const cls = at === null ? "damage-settled" : `damage-at-${at}`;
  return (
    <div
      class={`hud damage-big ${cls}`}
      data-at={at ?? undefined}
      style={{ position: "relative", inset: "auto" }}
    >
      <style>{`.damage-big .hud-body{position:static;transform:none;max-width:none}.damage-big .hud-body-figure{height:${px}px}.${cls} .hud-bone,.${cls} .hud-bone-move{${still}}`}</style>
      <BodyPanel tile={bodyTile(c.body, c.t)} side={side} />
    </div>
  );
}

function Plate({
  cases,
  side,
  px = 880,
  width = 400,
  wrap = false,
  facts = false,
}: {
  cases: Case[];
  side: FigureSide;
  px?: number;
  width?: number;
  wrap?: boolean;
  facts?: boolean;
}): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        gap: "18px",
        alignItems: "flex-start",
        flexWrap: wrap ? "wrap" : "nowrap",
        maxWidth: wrap ? `${5 * (width + 38)}px` : "none",
      }}
    >
      {cases.map((c) => (
        <div key={c.id} style={{ background: BACKDROP, padding: "10px", width: `${width}px` }}>
          <div style={{ color: "#0b1116" }}>{c.title}</div>
          {facts && <div style={{ color: "#33414c", fontSize: "10px" }}>{factsOf(c)}</div>}
          <Big c={c} px={px} side={side} />
        </div>
      ))}
    </div>
  );
}

/** THE WINDOWS a close-up looks through, in the figure's own units (92 ×
 * 211, head up): the left shoulder and upper arm, the pelvis and the
 * thighs, the shins. */
const WINDOWS: [string, number, number, number, number][] = [
  ["shoulder and arm", 50, 28, 40, 48],
  ["pelvis and thighs", 18, 92, 56, 52],
  ["shins", 18, 140, 56, 46],
];

/** THE FORCE LADDER UP CLOSE: each column one energy, each row a window
 * onto the figure drawn at 2400 px. */
function Closeups({ cases }: { cases: Case[] }): JSX.Element {
  const px = 2400;
  const k = px / 211;
  return (
    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
      {cases.map((c) => (
        <div key={c.id} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div>{c.title}</div>
          {WINDOWS.map(([name, x, y, w, h]) => (
            <div
              key={name}
              title={name}
              style={{
                width: `${Math.round(w * k * 0.5)}px`,
                height: `${Math.round(h * k * 0.5)}px`,
                overflow: "hidden",
                position: "relative",
                background: BACKDROP,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: `${-x * k * 0.5}px`,
                  top: `${-y * k * 0.5}px`,
                  transform: "scale(0.5)",
                  transformOrigin: "0 0",
                }}
              >
                <Big c={c} px={px} side="front" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** FROZEN FRAMES: every animation under each `data-at` figure — the
 * stylesheet's own snaps and flashes, their timing and stagger the game's —
 * seeked `at` ms in and written down as a still style, then let go. A page
 * of paused animations instead puts every piece on a layer of its own, which
 * is more than the rasterizer paints. */
function freeze(root: HTMLElement): void {
  for (const el of root.querySelectorAll<HTMLElement>("[data-at]")) {
    const at = Number(el.dataset.at);
    for (const a of el.getAnimations({ subtree: true })) {
      a.pause();
      a.currentTime = at;
      try {
        a.commitStyles();
      } catch {
        // An element no longer rendered keeps no frame.
      }
      a.cancel();
    }
  }
}

/** THE SNAP: which bodies, and the moments of it. */
const SNAP = ["force-simple", "force-wedge", "force-shatter", "force-most"];
const SNAP_AT = [0, 50, 100, 160, 240, 340, 460];

/** THE BONES' SNAP frame by frame: a row a body, a column a moment, each a
 * window onto the legs (the pelvis to the ankles) drawn at 1200 px. */
function Snaps({ cases }: { cases: Case[] }): JSX.Element {
  const px = 1200;
  const k = px / 211;
  const [x, y, w, h] = [16, 90, 60, 98];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", gap: "8px", paddingLeft: "130px" }}>
        {SNAP_AT.map((t) => (
          <div key={t} style={{ width: `${Math.round(w * k)}px` }}>{`${t} ms`}</div>
        ))}
      </div>
      {cases.map((c) => (
        <div key={c.id} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div style={{ width: "122px" }}>{c.title}</div>
          {SNAP_AT.map((t) => (
            <div
              key={t}
              style={{
                width: `${Math.round(w * k)}px`,
                height: `${Math.round(h * k)}px`,
                overflow: "hidden",
                position: "relative",
                background: BACKDROP,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: `${-x * k}px`,
                  top: `${-y * k}px`,
                }}
              >
                <Big c={c} px={px} side="front" at={t} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** THE REFERENCES: each image, then the figure over it at half its opacity.
 * The image is stretched to the figure's own box (0..92 × 0..211), which
 * is how the driver expects a reference to be cropped. */
function Refs({ refs, c }: { refs: string[]; c: Case }): JSX.Element {
  const px = 880;
  const w = Math.round((px * 92) / 211);
  return (
    <div style={{ display: "flex", gap: "18px", alignItems: "flex-start", flexWrap: "wrap" }}>
      {refs.map((src) => (
        <div key={src} style={{ display: "flex", gap: "8px" }}>
          <img src={src} style={{ width: `${w}px`, height: `${px}px`, display: "block" }} />
          <div style={{ position: "relative", width: `${w}px`, height: `${px}px` }}>
            <img
              src={src}
              style={{ position: "absolute", width: `${w}px`, height: `${px}px`, opacity: 0.55 }}
            />
            <div style={{ position: "absolute", left: 0, top: 0 }}>
              <style>{`.damage-ref .hud-body{position:static;transform:none;max-width:none;left:0}.damage-ref .hud-body-figure{height:${px}px;display:block;margin:0;filter:none}.damage-ref .hud-body-word,.damage-ref .hud-chip-sub{display:none}`}</style>
              <div
                class="hud damage-ref"
                style={{ position: "relative", inset: "auto", padding: 0 }}
              >
                <BodyPanel tile={bodyTile(c.body, c.t)} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
