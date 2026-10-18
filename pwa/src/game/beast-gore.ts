// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT COMES OUT OF AN ANIMAL RUN DOWN — on a free ride with the INJURIES
// switch on, every animal the engine killed (`GameState.wild.struck`,
// `beast-hit.ts`) bursts at the blow: a sheet of its blood thrown on along
// the way it was flung and a spatter back at the rider, the meat, the
// organs and the splinters of its ribs, tufts of its coat, a ruminant's
// rumen of chewed browse, and out of a big one opened the guts — a rope
// held at the wound and dragged as the carcass slides. Under the carcass
// as it slides a red smear on the snow, and where it stops a pool that
// grows as it bleeds out (`beast-wreck.ts`'s `bledBetween`). A small one
// met hard has nothing left whole: it is all thrown, and the snow it went
// over painted in a fan.
//
// WHAT IT COSTS A FRAME (`make gore-cost ARGS=--scene=moose,hare`): it is
// built with the world, behind the loading card, with a PRIMER standing in
// it (`gore-lumps.ts`'s), so the blow links no program; every piece thrown
// is an instance of its shape's mesh and is baked with the rest once it
// lies still (`createLumps`), never a mesh of its own; a gut is laid again
// only while it moves.
//
// Presentation only. It reads the engine's struck animals and writes
// nothing; what is thrown is dealt off each wreck's own seed and stepped
// on the run's own clock, so a replay throws it again the same. The blood
// is `gore-blood.ts`'s, the gibs `gore-gibs.ts`'s, the organs
// `gore-shapes.ts`' — nothing restated. A run without injuries never kills
// an animal, so it never builds this.

import * as THREE from "three";
import {
  beastById,
  createRng,
  struckAt,
  type BeastSpec,
  type GameState,
  type Level,
  type Rng,
  type StruckBeast,
} from "@engine";

import { BEAST_STYLES } from "./beast-shapes.ts";
import {
  bledBetween,
  bloodOut,
  ruminant,
  wreckOf,
  WRECK_COLOURS,
  type Wreck,
} from "./beast-wreck.ts";
import { createBlood, type Blood } from "./gore-blood.ts";
import { gibGround, lump, rope, stepRope, type Rope } from "./gore-gibs.ts";
import { spreadAt } from "./gore-leaks.ts";
import { createLumps, gorePrimer } from "./gore-lumps.ts";
import {
  layTube,
  organGeometry,
  shardGeometry,
  tubeGeometry,
  type OrganKind,
} from "./gore-shapes.ts";
import { wildGround } from "./wild-ground.ts";

type Wrap = <M extends THREE.Material>(m: M, name: string) => M;

export type BeastGore = {
  group: THREE.Group;
  /** Once a frame: anything newly killed thrown, everything flying flown. */
  update: (state: GameState) => void;
  /** A new run: the snow clean. */
  clear: () => void;
  dispose: () => void;
};

/** How long a carcass bleeds a stream out of its wound, s. */
const STREAM_FOR = 8;
/** The organs a body opened throws. */
const ORGANS: readonly OrganKind[] = ["gobbet", "liver", "lung", "heart", "kidney", "spleen"];

/** A gut, and where its points were last laid (x, y, z each): it is laid
 * again only when one has moved a millimetre. */
type Gut = { mesh: THREE.Mesh; rope: Rope; laid: Float32Array };

/** How far a gut's point moves, m, before the tube is laid again. */
const STILL = 1e-3;

/** One animal killed, as drawn: its wreck, where its last smear was laid,
 * how long after the blow the blood was last run, its guts. */
type Carcass = {
  key: string;
  hit: StruckBeast;
  spec: BeastSpec;
  wreck: Wreck;
  sx: number;
  sz: number;
  ran: number;
  guts: Gut[];
  /** Its own stream, for the blood it runs. */
  next: () => number;
};

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const v3 = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);

/** A shape's colours repainted `hex` (sRGB), each vertex shaded by a hash
 * — a lump of the coat or the rumen off an organ's shape. */
function repaint(g: THREE.BufferGeometry, hex: number, seed: number): THREE.BufferGeometry {
  const out = g.clone();
  const col = out.getAttribute("color") as THREE.BufferAttribute;
  const c = new THREE.Color().setHex(hex);
  for (let i = 0; i < col.count; i++) {
    const k = 0.75 + 0.35 * Math.abs(Math.sin(i * 12.9898 + seed));
    col.setXYZ(i, c.r * k, c.g * k, c.b * k);
  }
  return out;
}

/** Whether any point of `gut` has moved `STILL` since it was last laid;
 * where each is now kept as laid when one has. */
function moved(gut: Gut): boolean {
  const p = gut.rope.p;
  const d = gut.laid;
  let far = 0;
  for (let i = 0; i < p.length && far < STILL; i++) {
    far = Math.max(
      far,
      Math.abs(p[i].x - d[3 * i]) +
        Math.abs(p[i].y - d[3 * i + 1]) +
        Math.abs(p[i].z - d[3 * i + 2]),
    );
  }
  if (far < STILL) return false;
  for (let i = 0; i < p.length; i++) {
    d[3 * i] = p[i].x;
    d[3 * i + 1] = p[i].y;
    d[3 * i + 2] = p[i].z;
  }
  return true;
}

/** What the last `update` cost, ms — read by the gore cost lab. */
export const beastGoreMeter = { updateMs: 0 };

export function createBeastGore(level: Level, wrap: Wrap): BeastGore {
  const group = new THREE.Group();
  group.name = "beast-gore";
  const blood: Blood = createBlood(wrap);
  group.add(blood.group);
  const flesh = wrap(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.35,
      metalness: 0.02,
      side: THREE.DoubleSide,
    }),
    "beast-gore",
  );
  const geometries: THREE.BufferGeometry[] = [];
  const keep = (g: THREE.BufferGeometry): THREE.BufferGeometry => {
    geometries.push(g);
    return g;
  };
  const organs = ORGANS.map((k, i) => keep(organGeometry(k, 2.3 + i * 5.1)));
  const shards = [0, 1, 2].map((i) => keep(shardGeometry(0.1 + 0.05 * i, 0.014, i * 4.1)));
  const gobbet = organGeometry("gobbet", 9.7);
  const rumen = [0, 1].map((i) => keep(repaint(gobbet, WRECK_COLOURS.rumen, i)));
  const fur = new Map<string, THREE.BufferGeometry[]>();
  const furOf = (spec: BeastSpec): THREE.BufferGeometry[] => {
    let list = fur.get(spec.id);
    if (!list) {
      const style = BEAST_STYLES[spec.id];
      list = [style.coat, style.coat, style.belly].map((hex, i) => keep(repaint(gobbet, hex, i)));
      fur.set(spec.id, list);
    }
    return list;
  };
  gobbet.dispose();

  const lumps = createLumps(flesh);
  group.add(lumps.group);
  // Every kind of draw the blow adds, compiled with the world.
  const primer = gorePrimer(flesh, new THREE.Group());
  group.add(primer.group);

  const ground = gibGround(level);
  const drawn = wildGround(level);
  const bloodGround = {
    heightAt: (x: number, z: number) => drawn.snowY(x, z),
    normalAt: (x: number, z: number, out: { x: number; y: number; z: number }) =>
      ground.normalAt(x, z, out),
  };
  const carcasses = new Map<string, Carcass>();
  let last: GameState | null = null;
  let lastT = 0;
  const lying = { x: 0, z: 0, lift: 0, down: false };

  /** Throw `count` pieces of `geos` out of `at`, along `dir` (a unit) at
   * `speed` m/s and spread round it, each `scale` times its shape. */
  const fling = (
    rng: Rng,
    geos: readonly THREE.BufferGeometry[],
    count: number,
    at: THREE.Vector3,
    dir: THREE.Vector3,
    speed: number,
    scale: number,
    r: number,
  ): void => {
    for (let i = 0; i < count; i++) {
      const geo = rng.pick(geos);
      const size = scale * rng.range(0.7, 1.3);
      v1.set(
        dir.x + rng.range(-0.8, 0.8),
        dir.y + rng.range(0, 1.1),
        dir.z + rng.range(-0.8, 0.8),
      ).normalize();
      const u = speed * rng.range(0.35, 1.25);
      v3.set(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).normalize();
      const thrown = lump(
        { x: at.x, y: at.y, z: at.z },
        { x: v1.x * u, y: v1.y * u, z: v1.z * u },
        r * scale,
        { x: v3.x, y: v3.y, z: v3.z },
        rng.range(5, 18),
        1 / 60,
      );
      lumps.add(geo, thrown, size);
    }
  };

  /** THE BLOW: everything that comes out of `hit` at once. */
  const burst = (hit: StruckBeast, spec: BeastSpec, wreck: Wreck): Gut[] => {
    const rng = createRng(Math.floor(wreck.seed * 1e4) ^ 0xbea57);
    const next = () => rng.next();
    const c = Math.max(0.3, hit.crush);
    // How big it is against a man: the organs are built a man's size.
    // A small one burst is strewn in pieces bigger than its own organs would
    // be, or nothing of it reads past a few metres.
    const k = Math.min(1.8, Math.max(wreck.burst ? 0.6 : 0.3, Math.cbrt(spec.mass / 70)));
    const at = new THREE.Vector3(hit.x, hit.y + spec.height * 0.6, hit.z);
    const flung = Math.hypot(hit.vx, hit.vy, hit.vz);
    const dir = new THREE.Vector3(hit.vx, hit.vy + 0.2 * flung, hit.vz);
    if (dir.lengthSq() < 1e-6) dir.set(Math.sin(hit.heading), 0.3, Math.cos(hit.heading));
    dir.normalize();
    const carry = new THREE.Vector3(hit.vx, hit.vy, hit.vz).multiplyScalar(0.6);
    const fast = Math.max(4, flung);
    const big = Math.min(1, spec.mass / 100);
    // The sheet of blood along the fling, and the spatter back at him.
    blood.emit(at, dir, fast * 0.9 + 2, Math.round(160 + 700 * c * (0.3 + big)), 0.75, carry, next);
    v2.copy(dir).negate().add(up).normalize();
    blood.emit(at, v2, 3 + 2 * c, Math.round(60 + 200 * c), 1.1, v3.set(0, 0, 0), next);
    // The meat, the organs and the splinters of its ribs; its coat.
    // A burst one's pieces are dropped near where it was met, not thrown off.
    const strew = wreck.burst ? fast * 0.45 : fast;
    fling(
      rng,
      organs,
      Math.round((wreck.burst ? 12 : 3) + 9 * c * (0.4 + big)),
      at,
      dir,
      strew,
      k,
      0.03,
    );
    if (c > 0.4) fling(rng, shards, Math.round(2 + 5 * c), at, dir, fast * 0.8, k, 0.01);
    fling(
      rng,
      furOf(spec),
      Math.round((wreck.burst ? 16 : 2) + 6 * c),
      at,
      dir,
      strew * 0.7,
      k * 0.8,
      0.02,
    );
    if (ruminant(spec) && c > 0.45)
      fling(rng, rumen, Math.round(3 + 6 * c), at, dir, fast * 0.6, k * 1.3, 0.04);
    if (wreck.burst) {
      // Nothing left whole: the snow it went over painted in a fan.
      for (let i = 0; i < 40; i++) {
        // Thickest where it was met, thinning down the fling.
        const d = (3 + flung * 0.35) * rng.next() ** 1.6;
        const a = rng.range(-0.5, 0.5);
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const x = hit.x + (dir.x * ca - dir.z * sa) * d;
        const z = hit.z + (dir.x * sa + dir.z * ca) * d;
        blood.splat(
          x,
          z,
          rng.range(0.2, 0.7) * (1.2 - d / (4 + flung * 0.35)),
          rng.range(0.75, 1),
          rng.range(0, 6.28),
        );
      }
      return [];
    }
    // A big body opened: the guts out of it, held at the wound.
    if (spec.mass < 20 || c < 0.35) return [];
    const guts: Gut[] = [];
    for (let i = 0; i < 1 + Math.round(2 * c); i++) {
      const count = 14 + Math.round(10 * c);
      const g = new THREE.Mesh(tubeGeometry(count), flesh);
      g.castShadow = true;
      g.frustumCulled = false;
      group.add(g);
      v1.set(dir.x + rng.range(-0.6, 0.6), dir.y + 0.4, dir.z + rng.range(-0.6, 0.6));
      v1.normalize().multiplyScalar(fast * rng.range(0.2, 0.5));
      guts.push({
        mesh: g,
        rope: rope(at, carry, v1, count, 0.1 * k, 0.026 * k, 1 / 60),
        laid: new Float32Array(count * 3).fill(Infinity),
      });
    }
    return guts;
  };

  const clear = (): void => {
    lumps.clear();
    for (const c of carcasses.values()) {
      for (const gut of c.guts) {
        group.remove(gut.mesh);
        gut.mesh.geometry.dispose();
      }
    }
    carcasses.clear();
    blood.clear();
  };

  const update = (state: GameState): void => {
    const at = performance.now();
    advance(state);
    beastGoreMeter.updateMs = performance.now() - at;
  };

  const advance = (state: GameState): void => {
    primer.group.visible = false;
    if (state !== last || state.t < lastT) {
      if (last) clear();
      last = state;
      lastT = state.t;
    }
    const dt = Math.min(0.1, state.t - lastT);
    lastT = state.t;
    const t = state.t;
    for (const hit of state.wild?.struck ?? []) {
      if (!hit.killed) continue;
      const key = `${hit.group}:${hit.member}:${hit.t}`;
      if (carcasses.has(key)) continue;
      const spec = beastById(hit.species);
      const wreck = wreckOf(hit, spec);
      carcasses.set(key, {
        key,
        hit,
        spec,
        wreck,
        sx: hit.x,
        sz: hit.z,
        ran: 0,
        guts: burst(hit, spec, wreck),
        next: (
          (rng: Rng) => () =>
            rng.next()
        )(createRng(Math.floor(wreck.seed * 1e3) ^ 0x5eb)),
      });
      // A burst one's blood is all out at once, in a slick where it was met.
      if (wreck.burst) {
        const litres = Math.max(0.4, 3 * bloodOut(spec, Math.max(0.3, hit.crush)));
        blood.pool(key, hit.x, hit.z, litres, spreadAt(state, hit.x, hit.z));
      }
    }
    if (dt <= 0) return;
    for (const c of carcasses.values()) {
      const u = t - c.hit.t;
      struckAt(c.hit, t, lying);
      const half = (BEAST_STYLES[c.spec.id].width * c.spec.height) / 2;
      const y = drawn.snowY(lying.x, lying.z) + lying.lift;
      // The wound, up: where it lies with the side it was met on to the sky.
      const wound = v2.set(lying.x, y + half * 1.8, lying.z);
      // THE SLIDE smeared red, a blot every few hand's breadths of it.
      if (lying.lift <= 0 && Math.hypot(lying.x - c.sx, lying.z - c.sz) > 0.3) {
        const r = 0.18 + 0.5 * Math.min(1, c.spec.mass / 150);
        blood.splat(lying.x, lying.z, r, 1, (lying.x * 7 + lying.z * 3) % 6.28);
        c.sx = lying.x;
        c.sz = lying.z;
      }
      if (!c.wreck.burst) {
        // THE POOL under it, grown by what it bleeds out.
        const litres = bledBetween(c.spec, Math.max(0.3, c.hit.crush), c.ran, u);
        c.ran = u;
        if (litres > 0 && lying.lift <= 0) {
          blood.pool(c.key, lying.x, lying.z, litres, spreadAt(state, lying.x, lying.z));
        }
        if (u < STREAM_FOR && c.spec.mass >= 20) {
          v3.set(Math.sin(c.hit.heading), 0.4, Math.cos(c.hit.heading)).normalize();
          blood.stream(wound, v3, 0.8, (litres / dt) * 0.5, dt, v1.set(0, 0, 0), c.next);
        }
      }
      for (const gut of c.guts) {
        gut.rope.held = { x: wound.x, y: wound.y - half * 0.5, z: wound.z };
        stepRope(gut.rope, ground, dt);
        if (moved(gut)) layTube(gut.mesh.geometry, gut.rope.p, gut.rope.r);
      }
    }
    lumps.update(ground, dt);
    blood.update(dt, bloodGround);
  };

  return {
    group,
    update,
    clear,
    dispose() {
      clear();
      lumps.dispose();
      primer.dispose();
      for (const g of geometries) g.dispose();
      flesh.dispose();
      blood.dispose();
    },
  };
}
