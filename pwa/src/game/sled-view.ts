// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE AS DRAWN (`sled.ts`) — the Blender model (`make models
// KIND=sled`, `models/sled.glb`, `SLED_NODES`) hung on the engine's body
// and posed off its readings every frame: the BARS turned with the skis,
// each SKI lifted on its compression and turned about its spindle, the REAR
// SUSPENSION swung up about the drive as the belt's springs take load, the
// PADDLES run round the loop at the belt's own speed (the `run` morph), the
// headlamp lit while the engine runs — and the SKI RACK carrying the rider's
// pair (dressed in his topsheet's colours) while he rides it. While it waits
// for him, parked near him, a halo over it calls him to it.
//
// Presentation only: it reads `GameState.sled` and writes nothing back.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { SLED, type GameState, type SledState } from "@engine";

import { glow } from "./glow-sprite.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { createTrack, observe, sample, type Pose } from "./interp.ts";
import { SLED_LOOK } from "./sled-look.ts";
import { createSledCockpit } from "./sled-cockpit.ts";
import type { Outfit } from "./outfit.ts";
import { SLED_NODES, sledModelUrl } from "./skier-models.ts";

/** How near the parked machine a skier is for its halo to call him, m. */
const LIGHT_UP = 45;
/** The rest compression of the skis and the belt (a third of each travel —
 * `SLED_PROBES` hang so), m: what the drawn suspension moves from. */
const SKI_REST = SLED.front.travel / 3;
const TREAD_REST = SLED.rear.travel / 3;
/** How far behind the drive the rear idler stands, m — the arm the rear's
 * lift turns the drawn track about. */
const TRACK_ARM = SLED_LOOK.sprocket.at[0] - SLED_LOOK.idler.at[0];
/** One morph weight carries the belt this far round, m (the builder's
 * `beltRunMetres`, read off the model; this the fallback). */
const RUN_FALLBACK = 0.152;

export type SledView = {
  group: THREE.Group;
  /** Draw the machine at the state's last step, eased from the step before
   * by `alpha`; `player` is where the skier is drawn (the halo's call);
   * `cockpit`, whether the lens is the rider's own eye over the bars — the
   * cockpit drawn close in place of the model's bars (`sled-cockpit.ts`). */
  update(
    state: GameState,
    alpha: number,
    dt: number,
    player: { x: number; z: number },
    cockpit?: boolean,
  ): void;
  /** Dress the rider's hands and sleeves in the cockpit in his kit. */
  dressRider(outfit: Outfit): void;
  /** Dress the racked pair in the rider's colours: the topsheet and its trim. */
  dressRack(body: number, trim: number): void;
  /** The machine as drawn this frame. */
  drawn(): { x: number; y: number; z: number; q: THREE.Quaternion } | null;
  /** Resolved once the model is in the group (or the stand-in, should it
   * not load) — awaited before the run's programs are compiled, so none of
   * them is linked mid-ride. */
  ready: Promise<void>;
  dispose(): void;
};

/** A code-built stand-in, should the model not load: a cowl, a tunnel, a
 * belt and two skis — so a missing file is still a sled to take. */
function standIn(haze: HazeUniforms): THREE.Group {
  const g = new THREE.Group();
  const paint = hazeMaterial(
    new THREE.MeshStandardMaterial({ color: 0xb8241a, roughness: 0.4 }),
    haze,
    "sled",
  );
  const dark = hazeMaterial(
    new THREE.MeshStandardMaterial({ color: 0x1a1c1f, roughness: 0.7 }),
    haze,
    "sled",
  );
  const box = (w: number, h: number, l: number, m: THREE.Material, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), m);
    mesh.position.set(0, y, z);
    g.add(mesh);
    return mesh;
  };
  // In the trace's frame, glTF-turned: z aft from the tunnel's end is −z.
  box(0.65, 0.5, 1.2, paint, 0.6, -2.3);
  box(0.42, 0.25, 1.7, dark, 0.65, -0.85);
  box(0.41, 0.3, 1.6, dark, 0.2, -0.85);
  for (const s of [-1, 1]) {
    const ski = box(0.17, 0.05, 1.05, dark, 0.04, -2.6);
    ski.position.x = (s * SLED.skiStance) / 2;
  }
  return g;
}

/**
 * ONE SHADOW A PART, NOT ONE A PRIMITIVE. The model is a primitive per
 * material on each of its seven moving nodes (39 in all), and every one of
 * them was a draw into the sun's shadow map each frame on top of its draw in
 * the picture. Each node's opaque primitives are merged here into one
 * position-only CASTER hung on the node (so it moves and hides with it) and
 * the primitives stop casting: the same triangles in the same place, so the
 * same map, in a draw a node. Three walks a shadow caster into the picture
 * too, so the caster's draw range is opened for the shadow pass alone
 * (`onBeforeShadow` / `onAfterShadow`) and is empty in the picture, where it
 * draws no triangle and writes no pixel. A morphed mesh (the paddles) and
 * one a shadow is cut out of by a texture keep their own.
 */
export function mergeCasters(node: THREE.Object3D, made: THREE.Material[]): void {
  node.updateMatrix();
  const parts = new Map<
    string,
    { side: THREE.Side; shadow: THREE.Side | null; meshes: THREE.Mesh[] }
  >();
  for (const o of node.children) {
    if (!(o instanceof THREE.Mesh) || !o.castShadow || Array.isArray(o.material)) continue;
    const m = o.material as THREE.Material;
    const g = o.geometry as THREE.BufferGeometry;
    if (o.morphTargetInfluences?.length || m.alphaTest > 0 || m.alphaToCoverage) continue;
    if (!g.attributes.position || g.drawRange.count !== Infinity || g.drawRange.start !== 0)
      continue;
    // Three takes a caster's side off its material; a caster per kind of side.
    const key = `${m.side}:${m.shadowSide}`;
    const at = parts.get(key) ?? { side: m.side, shadow: m.shadowSide, meshes: [] };
    at.meshes.push(o);
    parts.set(key, at);
  }
  for (const { side, shadow, meshes } of parts.values()) {
    if (meshes.length < 2) continue;
    let verts = 0;
    let indices = 0;
    for (const o of meshes) {
      const g = o.geometry as THREE.BufferGeometry;
      verts += g.attributes.position.count;
      indices += g.index ? g.index.count : g.attributes.position.count;
    }
    const position = new Float32Array(verts * 3);
    const index = new Uint32Array(indices);
    const p = new THREE.Vector3();
    let v = 0;
    let i = 0;
    for (const o of meshes) {
      const g = o.geometry as THREE.BufferGeometry;
      o.updateMatrix();
      const from = g.attributes.position;
      for (let k = 0; k < from.count; k++) {
        p.fromBufferAttribute(from, k).applyMatrix4(o.matrix);
        position[(v + k) * 3] = p.x;
        position[(v + k) * 3 + 1] = p.y;
        position[(v + k) * 3 + 2] = p.z;
      }
      if (g.index) for (let k = 0; k < g.index.count; k++) index[i++] = v + g.index.getX(k);
      else for (let k = 0; k < from.count; k++) index[i++] = v + k;
      v += from.count;
      o.castShadow = false;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
    geometry.setIndex(new THREE.BufferAttribute(index, 1));
    geometry.computeBoundingSphere();
    geometry.setDrawRange(0, 0);
    const material = new THREE.MeshBasicMaterial({ side, colorWrite: false, depthWrite: false });
    material.shadowSide = shadow;
    made.push(material);
    const caster = new THREE.Mesh(geometry, material);
    caster.name = `${node.name}-caster`;
    caster.castShadow = true;
    caster.onBeforeShadow = () => geometry.setDrawRange(0, Infinity);
    caster.onAfterShadow = () => geometry.setDrawRange(0, 0);
    node.add(caster);
  }
}

export function createSledView(haze: HazeUniforms): SledView {
  const group = new THREE.Group();
  group.name = "snowmobile";
  const machine = new THREE.Group();
  group.add(machine);
  // The model in the TRACE's frame, glTF-turned (nose on −z): a half turn
  // puts the nose on the engine's +z, and `SLED.trace` shifts the trace's
  // origin (the tunnel's end, on the snow) onto the body frame's.
  const frame = new THREE.Group();
  frame.position.set(0, -SLED.trace.y, -SLED.trace.z);
  machine.add(frame);
  const nodes: Partial<Record<keyof typeof SLED_NODES, THREE.Object3D>> = {};
  const rest = new Map<THREE.Object3D, { p: THREE.Vector3; q: THREE.Quaternion }>();
  let lugs: THREE.Mesh | null = null;
  let run = RUN_FALLBACK;
  const allMats: THREE.Material[] = [];
  const rackMats: { ski: THREE.MeshStandardMaterial[]; trim: THREE.MeshStandardMaterial[] } = {
    ski: [],
    trim: [],
  };
  const lampMats: THREE.MeshStandardMaterial[] = [];
  // The model's own small gauge on the hood, put away while the cockpit's
  // display stands in for it.
  const gauges: THREE.Object3D[] = [];
  let dressed: { body: number; trim: number } | null = null;
  let disposed = false;

  // THE HEADLAMP's glow over the lens, and the halo that calls him.
  const sprite = (colour: number, size: number): THREE.Sprite => {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glow(),
        color: colour,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    );
    s.scale.set(size, size, 1);
    s.renderOrder = 9;
    return s;
  };
  const lamps = SLED_LOOK.lamps;
  const lampGlow = [-1, 1].map((sx) => {
    const s = sprite(0xfff4dc, 0.55);
    s.position.set((sx * lamps.width) / 2, lamps.y - SLED.trace.y, lamps.z - SLED.trace.z + 0.06);
    machine.add(s);
    return s;
  });
  // THE COCKPIT, drawn close while the lens is his own eye over the bars.
  const cockpit = createSledCockpit(haze);
  machine.add(cockpit.group);
  const call = sprite(0x7fe0ff, 3.2);
  call.position.set(0, 1.5, 0);
  machine.add(call);

  const axisOf = (a: readonly number[], b: readonly number[]): THREE.Vector3 =>
    // A trace (z, y) pair to the glTF's frame: z forward is −z there.
    new THREE.Vector3(0, b[1] - a[1], -(b[0] - a[0])).normalize();
  const spindleAxis = axisOf(SLED_LOOK.spindle[0], SLED_LOOK.spindle[1]);
  const postAxis = axisOf(SLED_LOOK.post, [SLED_LOOK.grip[0] + 0.023, SLED_LOOK.grip[1] - 0.045]);

  const adopt = (root: THREE.Object3D): void => {
    root.traverse((o) => {
      for (const [key, name] of Object.entries(SLED_NODES) as [keyof typeof SLED_NODES, string][]) {
        if (o.name === name) {
          nodes[key] = o;
          rest.set(o, { p: o.position.clone(), q: o.quaternion.clone() });
        }
      }
      if (typeof o.userData.beltRunMetres === "number") run = o.userData.beltRunMetres;
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        if (o.name === SLED_NODES.lugs || o.parent?.name === SLED_NODES.lugs) {
          if (o.morphTargetInfluences && o.morphTargetInfluences.length > 0) lugs = o;
        }
        const list = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of list) {
          if (m instanceof THREE.MeshStandardMaterial) {
            hazeMaterial(m, haze, "sled");
            if (m.name === "rack_ski") rackMats.ski.push(m);
            if (m.name === "rack_trim") rackMats.trim.push(m);
            if (/lamp/i.test(m.name) && m.name !== "taillight") lampMats.push(m);
            if (m.name === "gauge") gauges.push(o);
          }
          allMats.push(m);
        }
      }
    });
    for (const key of Object.keys(SLED_NODES) as (keyof typeof SLED_NODES)[]) {
      const node = nodes[key];
      if (node) mergeCasters(node, allMats);
    }
    frame.add(root);
    if (dressed) paintRack(dressed.body, dressed.trim);
  };
  const paintRack = (body: number, trim: number): void => {
    for (const m of rackMats.ski) m.color.setHex(body);
    for (const m of rackMats.trim) m.color.setHex(trim);
  };

  const url = sledModelUrl();
  const ready = (url ? new GLTFLoader().loadAsync(url) : Promise.reject(new Error("no model")))
    .then((gltf) => {
      if (disposed) return;
      gltf.scene.rotation.y = Math.PI;
      adopt(gltf.scene);
    })
    .catch(() => {
      if (!disposed) {
        const g = standIn(haze);
        g.rotation.y = Math.PI;
        adopt(g);
      }
    });

  // Drawn between two steps on the RIDER'S own line (`interp.ts`), so the
  // boards he stands on never part from under him between frames.
  const track = createTrack();
  const at: Pose = { x: 0, y: 0, z: 0, q: { x: 0, y: 0, z: 0, w: 1 } };
  const q = new THREE.Quaternion();
  const turn = new THREE.Quaternion();
  let shown: { x: number; y: number; z: number; q: THREE.Quaternion } | null = null;
  let clock = 0;
  let belt = 0;

  /** A node put back where the model built it, then moved by `lift` m up
   * and turned by `angle` rad about `axis` (its own frame). */
  const pose = (
    node: THREE.Object3D | undefined,
    lift: number,
    axis: THREE.Vector3 | null,
    angle: number,
  ): void => {
    if (!node) return;
    const r = rest.get(node)!;
    node.position.copy(r.p);
    node.position.y += lift;
    node.quaternion.copy(r.q);
    if (axis && angle !== 0) node.quaternion.multiply(turn.setFromAxisAngle(axis, angle));
  };

  return {
    group,
    ready,
    update(state, alpha, dt, player, inCockpit = false) {
      const s: SledState | undefined = state.sled;
      group.visible = !!s;
      if (!s) return;
      const close = inCockpit && s.rider;
      clock += dt;
      observe(track, s, state.tick);
      sample(track, alpha, at);
      const { x, y, z } = at;
      q.set(at.q.x, at.q.y, at.q.z, at.q.w);
      machine.position.set(x, y, z);
      machine.quaternion.copy(q);
      shown = { x, y, z, q };
      // THE SKIS on their compression, turned about their spindles with
      // the bars (the engine's ski angle, nose to its +x positive — a turn
      // about the glTF's own up, the half turn commuting with it).
      // The model's left ski (its −x) is the body frame's +x side, the
      // engine's second (`skiComp[1]`): the half turn swaps them.
      pose(nodes.skiL, s.skiComp[1] - SKI_REST, spindleAxis, s.skiAngle);
      pose(nodes.skiR, s.skiComp[0] - SKI_REST, spindleAxis, s.skiAngle);
      pose(nodes.bars, 0, postAxis, s.skiAngle * 0.8);
      if (nodes.bars) nodes.bars.visible = !close;
      for (const o of gauges) o.visible = !close;
      cockpit.update(state, s, dt, close);
      // THE REAR SUSPENSION: swung up about the drive by the belt's
      // compression past its rest — the rear end rises toward the tunnel.
      pose(nodes.track, 0, null, 0);
      if (nodes.track) {
        const lift = Math.max(-0.12, Math.min(0.25, s.treadComp - TREAD_REST));
        nodes.track.rotateX(-lift / TRACK_ARM);
      }
      // THE PADDLES round the loop at the belt's speed.
      belt += s.treadSpeed * dt;
      if (lugs?.morphTargetInfluences) {
        lugs.morphTargetInfluences[0] = (((belt / run) % 1) + 1) % 1;
      }
      // THE RACK: the rider's pair on it while he rides.
      if (nodes.rack) nodes.rack.visible = s.rider;
      // THE LAMP while the engine runs; the call while it waits near him.
      const running = s.rider || s.rpm > 100;
      for (const l of lampGlow) l.visible = running;
      for (const m of lampMats) m.emissiveIntensity = running ? 1 : 0.05;
      const near = Math.hypot(player.x - s.x, player.z - s.z);
      const waiting = !s.rider && s.mode !== "down" && near < LIGHT_UP && near > 3;
      call.visible = waiting;
      (call.material as THREE.SpriteMaterial).opacity = 0.35 + 0.35 * Math.sin(clock * 4);
    },
    dressRack(body, trim) {
      dressed = { body, trim };
      paintRack(body, trim);
    },
    dressRider(outfit) {
      cockpit.dress(outfit);
    },
    drawn() {
      return shown;
    },
    dispose() {
      disposed = true;
      cockpit.dispose();
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
        if (o instanceof THREE.Sprite) o.material.dispose();
      });
      for (const m of allMats) m.dispose();
    },
  };
}
