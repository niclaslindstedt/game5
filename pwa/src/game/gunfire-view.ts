// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GUNFIRE AS DRAWN (`engine/game/gunfire.ts`): what the army's weapons
// look like going off and what their rounds do where they land.
//
//   * THE MUZZLE FLASH: a white-yellow star at the muzzle for a frame or
//     two — the burning powder gases leaving the barrel, a rifle's the size
//     of a fist, a machine gun's a head's, a heavy gun's a forearm long —
//     with a smaller flame ahead of it along the bore and a wisp of grey
//     smoke left hanging; after dark its light on the snow round it.
//   * TRACERS: every fourth or fifth round of a machine gun's belt burns
//     red-orange as it flies — seen as a glowing streak some twenty metres
//     long (the eye's hold of a dot going by at 800 m/s), a chain of glows
//     along the way it goes with a bright line at its heart. The rest of
//     the rounds are not seen at all, as in life. By day the flash's and
//     the tracer's hot CORES are laid over the snow rather than added to
//     it, or white on white they would not be seen at all.
//   * WHERE A ROUND LANDS: in the snow a puff of it thrown up (the snow's
//     own cloud, `snow-cloud.ts`); in a trunk a spray of dark bark chips
//     and a little snow shaken off; off steel or rock a few sparks.
//   * THE ROCKET: its tube's backblast (a flash and a fan of dust and
//     smoke thrown back), the body flying with its motor's flame behind it
//     and a trail of white-grey smoke hanging on the wind; its BURST the
//     game's explosion (`explosion.ts`, a small, short fireball, its
//     sparks and fragments, a scorch) with the snow round it thrown up.
//   * A ROUND IN HIM: a puff of red mist — only with the INJURIES switch on
//     (`GameState.gore`); without it, nothing of it is drawn.
//
// It reads the state, never the events (the renderer is handed the state):
// the rounds in flight (`GunfireState.rounds`) for the tracers and the
// rockets, and the gunfire's LOG (`GunfireState.log`) for what was fired,
// struck and burst since the last frame. Fixed pools, nothing allocates
// once built. Presentation only.

import * as THREE from "three";
import type { GameState, GunfireEvent, Round, WeaponKind } from "@engine";

import { createBillboards } from "./billboards.ts";
import { billowStrip, createExplosion, POOL, type BallSize, type Explosion } from "./explosion.ts";
import { glow } from "./glow-sprite.ts";
import type { Flood } from "./headlamp.ts";
import type { SnowCloud } from "./snow-cloud.ts";
import { createSparks } from "./sparks.ts";
import type { SnowSampler } from "./trail-stamp.ts";

/** HOW IT READS. */
export const GUNFIRE_LOOK = {
  /** THE MUZZLE FLASH by weapon: its size, m, how long it shows, s. */
  flash: {
    rifle: { size: 0.45, life: 0.05 },
    doorGun: { size: 0.75, life: 0.05 },
    heavyGun: { size: 1.1, life: 0.06 },
    rocket: { size: 1.6, life: 0.09 },
    tankGun: { size: 4.5, life: 0.12 },
  } satisfies Record<WeaponKind, { size: number; life: number }>,
  /** The flash's colour, linear (over one: it glows through the tone map). */
  flashRgb: [7, 5.2, 2.6] as const,
  /** THE TRACER: its colour, the streak's length, s of its way, the glows
   * along it and their size, m. */
  tracerRgb: [6, 1.5, 0.35] as const,
  streak: 0.03,
  beads: 7,
  bead: 0.45,
  /** THE ROCKET: its body (length and radius, m, its paint), its motor's
   * flame (size, m), its trail (a puff every `every` m, its size, m, its
   * life, s, its shade). */
  rocket: { length: 0.95, radius: 0.045, paint: 0x3b4230 },
  motor: 0.9,
  trail: { every: 1.6, size: 0.7, grow: 3.2, life: 3.5, shade: 0.72 },
  /** THE BURST: the fireball's size and life by weapon, and the snow it
   * throws (the cloud's burst size). */
  ball: {
    rocket: { diameter: 5, life: 0.45 },
    tankGun: { diameter: 9, life: 0.6 },
  } as Record<string, BallSize>,
  snowBurst: 1.3,
  /** The burst's light against the helicopter's: a warhead's blink. */
  blastLight: { share: 0.12, fade: 6 },
  /** THE CORES laid over the glows (`cores`): the flash's, the
   * tracer's, the motor's colour, linear, and their size as a share of the
   * glow's. */
  core: { flash: [2.4, 1.25, 0.25] as const, tracer: [2.2, 0.3, 0.05] as const, size: 0.6 },
  /** THE FLASH'S LIGHT after dark: a flood's power and colour. */
  light: { power: 2.2, colour: [1, 0.78, 0.45] as const },
} as const;

export type GunfireView = {
  group: THREE.Group;
  /** Draw `state`'s gunfire this frame: `alpha` the share of a step past
   * the state's, `simDt` the step, s; `dt` the frame's own. */
  frame(
    state: GameState,
    alpha: number,
    dt: number,
    simDt: number,
    cloud: SnowCloud | null,
    snowAt: SnowSampler,
  ): void;
  /** The flashes' light after dark (`lit` how dark, 0..1) for the eye. */
  lamps(lit: number, eye: { x: number; y: number; z: number }, out: Flood[]): void;
  dispose(): void;
};

/** A drifting puff: smoke, dust or mist. */
type Puff = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  size0: number;
  size1: number;
  r: number;
  g: number;
  b: number;
  a: number;
  rot: number;
};

/** A glow that lives a moment where it was lit (a muzzle flash). */
type Glow = { x: number; y: number; z: number; size: number; age: number; life: number };

/** A bark chip. */
type Chip = { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number };

const PUFFS = 900;
const GLOWS = 64;
const CHIPS = 240;
const BEADS = 1400;
const ROCKETS = 6;
const LINES = 200;

/** A seeded stream of its own for the scatter — never the engine's. */
function makeRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createGunfireView(): GunfireView {
  const L = GUNFIRE_LOOK;
  const group = new THREE.Group();
  group.name = "gunfire";
  const random = makeRandom(0x9a7f12);
  // The glows (flashes, tracers' beads, the motor's flame), added on.
  const glows = createBillboards(glow(), 1, BEADS, true);
  glows.mesh.renderOrder = 11;
  // ...and their hot CORES laid over, not added on: by day a glow added to
  // the white of the snow and the sky is white on white and gone, where a
  // flash and a tracer are seen as a yellow and a red spark.
  const cores = createBillboards(glow(), 1, BEADS, false);
  cores.mesh.renderOrder = 10;
  group.add(cores.mesh);
  // The smoke, the dust and the mist, laid over.
  const strip = billowStrip();
  const smoke = createBillboards(strip, 2, PUFFS);
  smoke.mesh.renderOrder = 8;
  group.add(glows.mesh, smoke.mesh);
  // The tracers' hearts: one bright line each.
  const linePos = new Float32Array(LINES * 6);
  const lineCol = new Float32Array(LINES * 6);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
  lineGeo.setAttribute("color", new THREE.BufferAttribute(lineCol, 3));
  const lineMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  lines.frustumCulled = false;
  lines.renderOrder = 11;
  group.add(lines);
  // The bark chips: small dark points.
  const chipPos = new Float32Array(CHIPS * 3);
  const chipGeo = new THREE.BufferGeometry();
  chipGeo.setAttribute("position", new THREE.BufferAttribute(chipPos, 3));
  const chipMat = new THREE.PointsMaterial({ color: 0x3a2a1c, size: 0.06, sizeAttenuation: true });
  const chipPoints = new THREE.Points(chipGeo, chipMat);
  chipPoints.frustumCulled = false;
  group.add(chipPoints);
  // The strikes' sparks off steel and rock.
  const sparks = createSparks();
  group.add(sparks.group);
  // The rockets' bodies.
  const R = L.rocket;
  const bodyGeo = new THREE.CylinderGeometry(R.radius, R.radius, R.length, 8);
  bodyGeo.rotateX(Math.PI / 2);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: R.paint,
    roughness: 0.6,
    metalness: 0.3,
  });
  const bodies: THREE.Mesh[] = [];
  for (let i = 0; i < ROCKETS; i++) {
    const m = new THREE.Mesh(bodyGeo, bodyMat);
    m.visible = false;
    bodies.push(m);
    group.add(m);
  }
  // The bursts: two, so one going off while another still burns is drawn.
  const booms: Explosion[] = [0, 1].map(() =>
    createExplosion({
      pool: { ...POOL, radius: 1.2 },
      scorch: 3.5,
      melt: false,
      flash: L.blastLight,
    }),
  );
  for (const b of booms) {
    b.clear();
    group.add(b.group);
  }
  let nextBoom = 0;

  const puffs: Puff[] = Array.from({ length: PUFFS }, () => ({
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    age: 1,
    life: 0,
    size0: 0,
    size1: 0,
    r: 0,
    g: 0,
    b: 0,
    a: 0,
    rot: 0,
  }));
  let nextPuff = 0;
  const flashes: Glow[] = Array.from({ length: GLOWS }, () => ({
    x: 0,
    y: 0,
    z: 0,
    size: 0,
    age: 1,
    life: 0,
  }));
  let nextFlash = 0;
  const chips: Chip[] = Array.from({ length: CHIPS }, () => ({
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    age: 9,
  }));
  let nextChip = 0;
  /** Each rocket's last trail puff (by round id). */
  const trailFrom = new Map<number, { x: number; y: number; z: number }>();
  /** The log's last event drawn, and the run it was drawn on. */
  let seen = 0;
  let owner: GameState | null = null;
  let groundAt: (x: number, z: number) => number = () => 0;
  let lastDt = 0;
  const eye = { x: 0, y: 0, z: 0 };
  const flood: Flood = {
    x: 0,
    y: 0,
    z: 0,
    dx: 0,
    dy: -1,
    dz: 0,
    colour: L.light.colour,
    beam: [-2, -1.5, -3, 0],
    power: 0,
  };

  const puff = (
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    size: number,
    grow: number,
    life: number,
    r: number,
    g: number,
    b: number,
    a: number,
  ): void => {
    const p = puffs[nextPuff];
    nextPuff = (nextPuff + 1) % PUFFS;
    Object.assign(p, {
      x,
      y,
      z,
      vx,
      vy,
      vz,
      age: 0,
      life,
      size0: size,
      size1: size * grow,
      r,
      g,
      b,
      a,
    });
    p.rot = random() * Math.PI * 2;
  };

  const flashAt = (x: number, y: number, z: number, size: number, life: number): void => {
    const f = flashes[nextFlash];
    nextFlash = (nextFlash + 1) % GLOWS;
    Object.assign(f, { x, y, z, size, age: 0, life });
  };

  /** One event of the log, drawn. */
  function draw(
    e: GunfireEvent,
    state: GameState,
    cloud: SnowCloud | null,
    snowAt: SnowSampler,
  ): void {
    switch (e.phase) {
      case "shot": {
        const F = L.flash[e.weapon];
        const dx = e.dx ?? 0;
        const dy = e.dy ?? 0;
        const dz = e.dz ?? 0;
        // The star at the muzzle and the flame ahead along the bore.
        flashAt(e.x + dx * 0.1, e.y + dy * 0.1, e.z + dz * 0.1, F.size, F.life);
        flashAt(
          e.x + dx * F.size * 0.7,
          e.y + dy * F.size * 0.7,
          e.z + dz * F.size * 0.7,
          F.size * 0.6,
          F.life * 0.8,
        );
        // A wisp of smoke left hanging.
        puff(
          e.x + dx * 0.3,
          e.y,
          e.z + dz * 0.3,
          dx * 2,
          0.4,
          dz * 2,
          F.size * 0.5,
          3,
          1.2,
          0.75,
          0.75,
          0.75,
          0.25,
        );
        if (e.weapon === "rocket" || e.weapon === "tankGun") {
          // THE BACKBLAST: a fan of dust and smoke thrown back out of the
          // tube (a tank's gun throws its blast forward and round).
          const back = e.weapon === "rocket" ? -1 : 0.4;
          for (let i = 0; i < 14; i++) {
            const s = 6 + random() * 14;
            const a = (random() - 0.5) * 1.2;
            const bx = (dx * Math.cos(a) - dz * Math.sin(a)) * back;
            const bz = (dz * Math.cos(a) + dx * Math.sin(a)) * back;
            puff(e.x, e.y, e.z, bx * s, 0.5 + random(), bz * s, 0.8, 4, 2.5, 0.8, 0.79, 0.76, 0.5);
          }
          if (cloud)
            cloud.burst(
              e.x - dx * 3,
              groundAt(e.x - dx * 3, e.z - dz * 3),
              e.z - dz * 3,
              -dx * 4,
              -dz * 4,
              0.6,
              snowAt(e.x, e.z),
            );
        }
        flood.x = e.x;
        flood.y = e.y + 0.5;
        flood.z = e.z;
        flood.power = Math.max(flood.power ?? 0, L.light.power * (F.size / 0.75));
        return;
      }
      case "impact": {
        const on = e.on ?? "snow";
        if (on === "snow") {
          // The snow thrown up: a puff and a little spray of it.
          if (cloud) {
            const big = e.weapon === "heavyGun" ? 1.6 : e.weapon === "doorGun" ? 1 : 0.7;
            cloud.blow(e.x, e.y + 0.1, e.z, 0, 2.5 * big, 0, 0.55 * big);
            cloud.blow(
              e.x,
              e.y + 0.2,
              e.z,
              (random() - 0.5) * 2,
              4 * big,
              (random() - 0.5) * 2,
              0.35 * big,
            );
          }
        } else if (on === "trunk") {
          for (let i = 0; i < 9; i++) {
            const c = chips[nextChip];
            nextChip = (nextChip + 1) % CHIPS;
            Object.assign(c, {
              x: e.x,
              y: e.y,
              z: e.z,
              vx: (random() - 0.5) * 6,
              vy: 1 + random() * 4,
              vz: (random() - 0.5) * 6,
              age: 0,
            });
          }
          // Snow shaken off the branches over it.
          if (cloud) cloud.blow(e.x, e.y + 1.5, e.z, 0, -0.5, 0, 0.6);
        } else {
          for (let i = 0; i < 8; i++)
            sparks.emit(
              e.x,
              e.y,
              e.z,
              (random() - 0.5) * 12,
              2 + random() * 6,
              (random() - 0.5) * 12,
              0.15 + random() * 0.3,
            );
        }
        return;
      }
      case "blast": {
        const boom = booms[nextBoom];
        nextBoom = (nextBoom + 1) % booms.length;
        boom.clear();
        boom.burst(e.x, e.y, e.z, 20, 0, 0, L.ball[e.weapon] ?? L.ball.rocket);
        if (cloud) cloud.burst(e.x, e.y, e.z, 0, 0, L.snowBurst, snowAt(e.x, e.z));
        // The snow and the smoke thrown up in a column.
        for (let i = 0; i < 26; i++) {
          const a = random() * Math.PI * 2;
          const s = 2 + random() * 9;
          const k = 0.55 + random() * 0.35;
          puff(
            e.x,
            e.y + 0.5,
            e.z,
            Math.sin(a) * s,
            3 + random() * 9,
            Math.cos(a) * s,
            1.4,
            3.5,
            3 + random() * 3,
            k,
            k,
            k * 0.97,
            0.7,
          );
        }
        return;
      }
      case "hit": {
        // Gore is drawn only with the INJURIES switch on.
        if (!state.gore) return;
        for (let i = 0; i < 3; i++)
          puff(
            e.x,
            e.y,
            e.z,
            (random() - 0.5) * 2,
            0.5 + random(),
            (random() - 0.5) * 2,
            0.18,
            2.5,
            0.5,
            0.32,
            0.02,
            0.02,
            0.8,
          );
        return;
      }
      default:
        return;
    }
  }

  /** The tracers and the rockets in flight, drawn where they are this frame. */
  function flying(rounds: readonly Round[], ahead: number): number {
    let n = 0;
    let rockets = 0;
    const [tr, tg, tb] = L.tracerRgb;
    for (const r of rounds) {
      const x = r.x + r.vx * ahead;
      const y = r.y + r.vy * ahead;
      const z = r.z + r.vz * ahead;
      if (r.tracer && n < LINES) {
        // The streak: a bright line, and a chain of glows fading back.
        const k = n * 6;
        const s = L.streak;
        linePos.set([x, y, z, x - r.vx * s, y - r.vy * s, z - r.vz * s], k);
        lineCol.set([tr * 0.6, tg * 0.6, tb * 0.6, tr * 0.1, tg * 0.1, tb * 0.1], k);
        n++;
        for (let i = 0; i < L.beads; i++) {
          const f = i / L.beads;
          const back = s * f;
          const w = L.bead * (1 - 0.6 * f);
          const a = 1 - f;
          glows.push(
            x - r.vx * back,
            y - r.vy * back,
            z - r.vz * back,
            w,
            w,
            0,
            tr * a,
            tg * a,
            tb * a,
            1,
            0,
          );
          const c = w * L.core.size;
          const [cr, cg, cb] = L.core.tracer;
          cores.push(x - r.vx * back, y - r.vy * back, z - r.vz * back, c, c, 0, cr, cg, cb, a, 0);
        }
      }
      if ((r.weapon === "rocket" || r.weapon === "tankGun") && rockets < ROCKETS) {
        const m = bodies[rockets++];
        m.visible = true;
        m.position.set(x, y, z);
        m.lookAt(x + r.vx, y + r.vy, z + r.vz);
        if (r.weapon === "rocket") {
          // The motor's flame, and the trail laid behind it.
          const v = Math.hypot(r.vx, r.vy, r.vz) || 1;
          const bx = x - (r.vx / v) * L.rocket.length * 0.7;
          const by = y - (r.vy / v) * L.rocket.length * 0.7;
          const bz = z - (r.vz / v) * L.rocket.length * 0.7;
          glows.push(bx, by, bz, L.motor, L.motor, 0, 7, 4.5, 1.6, 1, 0);
          const [fr, fg, fb] = L.core.flash;
          cores.push(bx, by, bz, L.motor * 0.6, L.motor * 0.6, 0, fr, fg, fb, 1, 0);
          glows.push(bx, by, bz, L.motor * 2.4, L.motor * 2.4, 0, 1.4, 0.7, 0.25, 0.6, 0);
          const T = L.trail;
          let from = trailFrom.get(r.id);
          if (!from) {
            from = { x: bx, y: by, z: bz };
            trailFrom.set(r.id, from);
          }
          const d = Math.hypot(bx - from.x, by - from.y, bz - from.z);
          for (let t = T.every; t <= d; t += T.every) {
            const k = t / d;
            const sh = T.shade * (0.9 + 0.2 * random());
            puff(
              from.x + (bx - from.x) * k,
              from.y + (by - from.y) * k,
              from.z + (bz - from.z) * k,
              (random() - 0.5) * 0.6,
              0.3,
              (random() - 0.5) * 0.6,
              T.size,
              T.grow,
              T.life * (0.8 + 0.4 * random()),
              sh,
              sh,
              sh * 0.98,
              0.55,
            );
          }
          if (d >= T.every) {
            const k = (Math.floor(d / T.every) * T.every) / d;
            from.x += (bx - from.x) * k;
            from.y += (by - from.y) * k;
            from.z += (bz - from.z) * k;
          }
        }
      }
    }
    for (let i = rockets; i < ROCKETS; i++) bodies[i].visible = false;
    // Trails of rockets no longer flying are let go.
    if (trailFrom.size > 0)
      for (const id of trailFrom.keys()) if (!rounds.some((r) => r.id === id)) trailFrom.delete(id);
    return n;
  }

  return {
    group,
    frame(state, alpha, dt, simDt, cloud, snowAt) {
      lastDt = dt;
      groundAt = (x, z) => state.level.groundAt(x, z);
      const g = state.gunfire;
      if (owner !== state) {
        // A new run: nothing of the last one's smoke or bursts carried in.
        owner = state;
        seen = g?.said ?? 0;
        for (const p of puffs) p.life = p.age = 0;
        for (const f of flashes) f.life = f.age = 0;
        for (const c of chips) c.age = 9;
        for (const b of booms) b.clear();
        trailFrom.clear();
      }
      if (g) {
        // What was fired, struck and burst since the last frame.
        const from = Math.max(seen + 1, g.said - g.log.length + 1);
        for (let n = from; n <= g.said; n++) {
          const entry = g.log.find((l) => l?.n === n);
          if (entry) draw(entry.e, state, cloud, snowAt);
        }
        seen = g.said;
      }
      glows.begin();
      cores.begin();
      const n = flying(g?.rounds ?? [], alpha * simDt);
      lineGeo.setDrawRange(0, n * 2);
      (lineGeo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
      (lineGeo.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
      lines.visible = n > 0;
      const [fr, fg, fb] = L.flashRgb;
      for (const f of flashes) {
        if (f.age >= f.life) continue;
        f.age += dt;
        const a = Math.max(0, 1 - f.age / f.life);
        const s = f.size * (0.8 + 0.4 * random());
        glows.push(f.x, f.y, f.z, s, s, random() * Math.PI, fr * a, fg * a, fb * a, 1, 0);
        const c = s * L.core.size;
        cores.push(f.x, f.y, f.z, c, c, 0, L.core.flash[0], L.core.flash[1], L.core.flash[2], a, 0);
      }
      flood.power = (flood.power ?? 0) * Math.exp(-dt * 30);
      // The puffs: drifting, swelling, thinning.
      smoke.begin();
      for (const p of puffs) {
        if (p.age >= p.life) continue;
        p.age += dt;
        const drag = Math.exp(-2.2 * dt);
        p.vx *= drag;
        p.vz *= drag;
        p.vy = p.vy * drag + 0.3 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        const k = Math.min(1, p.age / p.life);
        const size = p.size0 + (p.size1 - p.size0) * Math.sqrt(k);
        const a = p.a * Math.min(1, k * 10) * (1 - k) ** 1.3;
        smoke.push(p.x, p.y, p.z, size, size, p.rot, p.r, p.g, p.b, a, 0, 2, 0, p.rot * 1.3, 0);
      }
      // The chips: thrown, falling, lying a moment.
      let c = 0;
      for (const ch of chips) {
        if (ch.age > 2) continue;
        ch.age += dt;
        ch.vy -= 9.81 * dt;
        ch.x += ch.vx * dt;
        ch.y += ch.vy * dt;
        ch.z += ch.vz * dt;
        const gy = groundAt(ch.x, ch.z);
        if (ch.y < gy) {
          ch.y = gy;
          ch.vx = ch.vy = ch.vz = 0;
        }
        chipPos.set([ch.x, ch.y, ch.z], c * 3);
        c++;
      }
      chipGeo.setDrawRange(0, c);
      (chipGeo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
      chipPoints.visible = c > 0;
      sparks.update(dt, groundAt);
    },
    lamps(lit, e, out) {
      eye.x = e.x;
      eye.y = e.y;
      eye.z = e.z;
      for (const b of booms) {
        b.dusk(lit);
        b.update(lastDt, groundAt, eye);
      }
      glows.end(eye);
      cores.end(eye);
      smoke.end(eye);
      if (lit <= 0 || (flood.power ?? 0) < 0.02) return;
      out.push({ ...flood, power: (flood.power ?? 0) * lit });
    },
    dispose() {
      glows.dispose();
      cores.dispose();
      smoke.dispose();
      strip.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      chipGeo.dispose();
      chipMat.dispose();
      sparks.dispose();
      bodyGeo.dispose();
      bodyMat.dispose();
      for (const b of booms) b.dispose();
    },
  };
}
