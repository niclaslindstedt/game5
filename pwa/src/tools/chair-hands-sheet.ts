// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CHAIR LEFT ONLY BY HAND, photographed (`make chair-ride`, the lift
// ride lab's `?hands=`): the player's chair ride as the app stands it up
// (`CreateGameOptions.chairHands`, `engine/game/chair-hands.ts`), ridden on
// the real engine through the game's renderer at sixty frames a second.
//
//   * `stay` — nothing touched: the bar down, raised short of the top, the
//     unload passed sat on the chair, round the wheel and back down the line
//     facing the valley, a row a lens (the game's camera, the rider's own
//     look down the line, off the line's flank).
//   * `jump` — forward pressed on the way back down once the chair is `h` m
//     over the snow, a row a height (`?heights=`): the press, the shove off
//     the seat, the fall, the landing and after — each captioned with the
//     blow's g, the injury severity score and whether he lived (the run is
//     mortal, as with the INJURIES switch on).

import {
  carrierAt,
  chairBarDown,
  liftPlans,
  NEUTRAL_INPUT,
  severityOf,
  step,
  TUNING,
  type GameState,
  type LiftPlan,
  type SkierInput,
} from "@engine";

import type { createWorldRenderer } from "../game/renderer.ts";

export type HandsCtx = {
  renderer: ReturnType<typeof createWorldRenderer>;
  canvas: HTMLCanvasElement;
  sheet: HTMLDivElement;
  width: number;
  height: number;
  scale: number;
  /** The free ride as the lab stands it up, the options laid over it. */
  standUp(extra: { chairHands: boolean; gore?: boolean }): GameState;
};

const FRAME = 1 / 60;
const STEPS = Math.round(FRAME / TUNING.dt);
/** How long before a shot the picture is drawn, s. */
const WARM = 1;

/** Where his chair is, and its bar. */
function chairOf(run: GameState, plan: LiftPlan): { side: number; turn?: number; bar: number } {
  const l = run.skier.lift;
  if (!l || l.carrier === undefined) return { side: -1, bar: 0 };
  const at = carrierAt(plan, l.carrier, run.t);
  return { side: at.side, turn: at.turn, bar: chairBarDown(plan, at) };
}

/** A lens in the rider's frame: `look` his own eyes down the way he faces,
 * `side` off the lift line's flank, `chase` the game's own camera. */
function lensFor(run: GameState, v: string, ctx: HandsCtx): void {
  const c = run.skier;
  if (v === "look") {
    const sh = Math.sin(c.heading);
    const ch = Math.cos(c.heading);
    ctx.renderer.setOverride({
      eye: { x: c.x - sh * 0.35, y: c.y + 1.15, z: c.z - ch * 0.35 },
      target: { x: c.x + sh * 30, y: c.y - 6, z: c.z + ch * 30 },
      fov: 70,
      roll: 0,
    });
  } else if (v === "side") {
    const sh = Math.sin(c.heading);
    const ch = Math.cos(c.heading);
    // Off his right, a little behind and over him: the chair, its bar and
    // the snow under it.
    ctx.renderer.setOverride({
      eye: { x: c.x + ch * 5 - sh * 1.5, y: c.y + 1.4, z: c.z - sh * 5 - ch * 1.5 },
      target: { x: c.x, y: c.y + 0.2, z: c.z },
      fov: 55,
      roll: 0,
    });
  } else ctx.renderer.setOverride(null);
}

function tile(ctx: HandsCtx, caption: string): HTMLElement {
  const tw = Math.round(ctx.width * ctx.scale);
  const th = Math.round(ctx.height * ctx.scale);
  const cell = document.createElement("figure");
  const t = document.createElement("canvas");
  t.width = tw;
  t.height = th;
  t.getContext("2d")?.drawImage(ctx.canvas, 0, 0, tw, th);
  const cap = document.createElement("figcaption");
  cap.textContent = caption;
  cell.append(t, cap);
  return cell;
}

/** What the run is doing, for a caption. */
function said(run: GameState, plan: LiftPlan): string {
  const c = run.skier;
  const over = c.y - run.level.groundAt(c.x, c.z);
  const ch = chairOf(run, plan);
  const where = c.lift
    ? ch.turn !== undefined
      ? "round the wheel"
      : ch.side === 1
        ? "riding down"
        : "riding up"
    : c.thrown
      ? "thrown"
      : c.airborne
        ? "falling"
        : "skiing";
  const bar = c.lift ? ` bar ${ch.bar > 0.5 ? "down" : "up"}` : "";
  return `${run.t.toFixed(1)} s  ${where}${bar}  ${over.toFixed(1)} m over the snow`;
}

/** Ride `run` on `pilot` to each of `times`, drawing a tile a lens at each. */
async function film(
  ctx: HandsCtx,
  run: GameState,
  plan: LiftPlan,
  pilot: (run: GameState) => SkierInput,
  times: number[],
  views: string[],
  label: (run: GameState) => string,
): Promise<HTMLElement[][]> {
  const rows: HTMLElement[][] = views.map(() => []);
  let next = 0;
  while (next < times.length) {
    for (let i = 0; i < STEPS; i++) step(run, pilot(run));
    const due = run.t >= times[next];
    // Drawn only in the second before a shot (the lens settles, the spray
    // and the tracks catch up); a software GL can't draw a whole ride.
    if (run.t < times[next] - WARM) continue;
    ctx.renderer.setOverride(null);
    ctx.renderer.draw(run, 0, FRAME);
    if (!due) continue;
    views.forEach((v, row) => {
      lensFor(run, v, ctx);
      ctx.renderer.draw(run, 0, 0);
      rows[row].push(tile(ctx, `${v}  ${label(run)}`));
    });
    ctx.renderer.setOverride(null);
    next++;
  }
  return rows;
}

/** UNTOUCHED: through the top and back down, a row a lens. */
export async function staySheet(ctx: HandsCtx): Promise<{ note: string; tiles: number }> {
  const dry = ctx.standUp({ chairHands: true });
  if (dry.skier.lift?.kind !== "chair")
    return { note: "the ride did not begin on a chair", tiles: 0 };
  const plan = liftPlans(dry.level)[dry.skier.lift.index];
  let up = NaN;
  let turn = NaN;
  let down = NaN;
  while (dry.t < 120 && !Number.isFinite(down)) {
    step(dry, NEUTRAL_INPUT);
    const ch = chairOf(dry, plan);
    if (!Number.isFinite(up) && ch.side === 0 && ch.bar < 0.02) up = dry.t;
    if (!Number.isFinite(turn) && ch.turn !== undefined) turn = dry.t;
    if (Number.isFinite(turn) && !Number.isFinite(down) && ch.side === 1 && ch.turn === undefined)
      down = dry.t;
  }
  if (!Number.isFinite(down)) return { note: "never came round the top wheel", tiles: 0 };
  const times = [0.3, up - 2, up + 1, turn - 1.5, turn + 2, down + 3, down + 15, down + 40]
    .filter((t) => t >= 0)
    .sort((a, b) => a - b);
  const run = ctx.standUp({ chairHands: true });
  await ctx.renderer.load(run);
  ctx.renderer.setCamera("chase", true);
  const views = ["chase", "look", "side"];
  const rows = await film(
    ctx,
    run,
    plan,
    () => NEUTRAL_INPUT,
    times,
    views,
    (r) => said(r, plan),
  );
  layout(ctx, times.length, rows);
  return {
    note: `stayed on: bar up ${up.toFixed(1)} s, round the wheel ${turn.toFixed(1)} s, down ${down.toFixed(1)} s`,
    tiles: times.length * views.length,
  };
}

/** A rider who sits on, round the top, and presses forward on the way back
 * down once the chair is `h` m over the snow. */
function jumper(plan: LiftPlan, h: number): (run: GameState) => SkierInput {
  let pressed = false;
  return (run) => {
    const c = run.skier;
    if (pressed || !c.lift) return NEUTRAL_INPUT;
    const ch = chairOf(run, plan);
    if (ch.side === 1 && ch.turn === undefined && c.y - run.level.groundAt(c.x, c.z) >= h) {
      pressed = true;
      return { ...NEUTRAL_INPUT, tuck: 1 };
    }
    return NEUTRAL_INPUT;
  };
}

/** JUMPED OFF on the way down at each of `heights`, a row a height. */
export async function jumpSheet(
  ctx: HandsCtx,
  heights: number[],
): Promise<{ note: string; tiles: number }> {
  const rows: HTMLElement[][] = [];
  const notes: string[] = [];
  let cols = 0;
  for (const h of heights) {
    const dry = ctx.standUp({ chairHands: true, gore: true });
    if (dry.skier.lift?.kind !== "chair")
      return { note: "the ride did not begin on a chair", tiles: 0 };
    const plan = liftPlans(dry.level)[dry.skier.lift.index];
    const pilot = jumper(plan, h);
    let press = NaN;
    let land = NaN;
    while (dry.t < 240 && !(Number.isFinite(land) && dry.t > land + 3)) {
      const had = dry.skier.lift !== null;
      step(dry, pilot(dry));
      if (had && !dry.skier.lift) press = dry.t;
      if (Number.isFinite(press) && !Number.isFinite(land) && dry.t > press + 0.1) {
        const c = dry.skier;
        if (!c.airborne || c.thrown) land = dry.t;
      }
    }
    if (!Number.isFinite(land)) {
      notes.push(`${h} m: never left the chair`);
      continue;
    }
    const body = dry.skier.body;
    const dead = (dry.gore?.dead ?? -1) >= 0;
    const verdict = `${h} m: ${body.peak.toFixed(0)} g, ISS ${severityOf(body)}${dead ? ", DIED" : ""}`;
    notes.push(verdict);
    const fall = land - press;
    const times = [
      press - 0.6,
      press + 0.15,
      press + fall * 0.5,
      land - 0.05,
      land + 0.6,
      land + 2.5,
    ];
    const run = ctx.standUp({ chairHands: true, gore: true });
    await ctx.renderer.load(run);
    ctx.renderer.setCamera("chase", true);
    const live = jumper(plan, h);
    const [row] = await film(ctx, run, plan, live, times, ["chase"], (r) => {
      const b = r.skier.body;
      return `${verdict.split(":")[0]}  ${said(r, plan)}  ${b.peak.toFixed(0)} g ISS ${severityOf(b)}`;
    });
    rows.push(row);
    cols = Math.max(cols, row.length);
  }
  layout(ctx, cols, rows);
  return { note: `jumped off on the way down — ${notes.join("; ")}`, tiles: rows.flat().length };
}

function layout(ctx: HandsCtx, cols: number, rows: HTMLElement[][]): void {
  const tw = Math.round(ctx.width * ctx.scale);
  ctx.sheet.style.gridTemplateColumns = `repeat(${cols}, ${tw}px)`;
  ctx.sheet.replaceChildren();
  for (const row of rows) ctx.sheet.append(...row);
  ctx.canvas.style.display = "none";
}
