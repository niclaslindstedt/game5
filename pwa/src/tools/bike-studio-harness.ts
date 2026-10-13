// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIKE STUDIO's page (`scripts/bike-studio.mjs`): the downhill bike and
// its rider in a plain studio — no mountain, no engine run — so a change to
// the bike's build or the rider's stance is seen in seconds, and set beside
// PHOTOGRAPHS of the class it is matched to. Three sheets:
//
//   bike     the bike alone from every side: the drive side and the brake
//            side square on (orthographic, to scale), the front and rear
//            three-quarters, head on and from above
//   rider    the bike and its rider through the moments a ride has him in
//            (the attack stance, pedalling, braking with his weight back,
//            the crouch before a pop, the air, leant into a turn each way,
//            sat), each from the drive side and a three-quarter
//   refs     each local REFERENCE photograph the driver was pointed at
//            (`--refs DIR`, never committed) beside the bike as the same
//            lens would see it — and, where its axles are marked in the
//            calibration (`refs.json`), drawn over it to the photograph's
//            own scale, so the silhouettes can be laid one on the other
//
// The rider is the game's own dressed figure laid on the bike by the game's
// own hand (`skier-bike.ts`'s `riderPose`), off a pose the page makes up for
// each moment (`BikePose`, the engine's shape).

import * as THREE from "three";
import { BIKE, BIKE_BB, type BikePose } from "@engine";

import { buildPhotoBike } from "../game/bike-build.ts";
import { REAR_REST, frontAxle } from "../game/bike-look.ts";
import { poseBike, type BikeNodes } from "../game/bike-view.ts";
import { riderPose } from "../game/skier-bike.ts";
import { createSkier } from "../game/skier-figure.ts";
import { SLOT_DRESS } from "../game/skis-body.ts";
import type { BodyFrame } from "../game/skier-ragdoll.ts";
import type { SkierDress } from "../game/skier-dress.ts";
import { bikeKit } from "../game/outfit.ts";
import { addBikeShoes } from "../game/bike-shoes.ts";
import { bootsOn, buildWalkBoots } from "../game/town-boots.ts";

type Frame = { view: string; caption: string; png: string };
type Ref = {
  /** The photograph's file in the refs folder. */
  file: string;
  /** Which side it shows: "drive", "brake", or a lens of the studio's. */
  view: string;
  /** The rear and front axles' centres in the photograph, px — marks the
   * side views are drawn over it by. */
  axles?: [[number, number], [number, number]];
  /** The moment the rider is posed in (`rider` sheet's names). */
  pose?: string;
  /** No rider on it. */
  bare?: boolean;
};

declare global {
  interface Window {
    __studio?: { ready: Promise<string>; sheet(): Promise<{ frames: Frame[] }> };
  }
}

const params = new URLSearchParams(location.search);
const sheetAsked = params.get("sheet") ?? "bike";
const W = Number(params.get("w") ?? 900);
const H = Number(params.get("h") ?? 600);
const look = "photo";
const kit = params.get("kit") ?? "0";
const onlyViews = (params.get("views") ?? "").split(",").filter(Boolean);

// ---------------------------------------------------------------- scene
const canvas = document.getElementById("stage") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd9dde2);
scene.add(new THREE.HemisphereLight(0xf2f6fb, 0x7d756a, 1.5));
const sun = new THREE.DirectionalLight(0xfff3e0, 2.6);
sun.position.set(-3, 6, 2.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -2.5;
sun.shadow.camera.right = sun.shadow.camera.top = 2.5;
sun.shadow.bias = -0.0003;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight(0xdbe6ff, 0.8);
fill.position.set(4, 2, -3);
scene.add(fill);
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(30, 48),
  new THREE.MeshStandardMaterial({ color: 0xbfb8ac, roughness: 0.95 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// The bike's centre of mass over the floor: the bottom bracket at its
// static height.
const COM_Y = 0.355 - BIKE_BB.y;
const plain = (p: THREE.MeshStandardMaterialParameters): THREE.Material =>
  new THREE.MeshStandardMaterial(p);

function makeBike(): { root: THREE.Object3D; nodes: BikeNodes } {
  return buildPhotoBike(plain);
}

function shadows(o: THREE.Object3D): void {
  o.traverse((m) => {
    if (m instanceof THREE.Mesh) m.castShadow = m.receiveShadow = true;
  });
}

const bike = makeBike();
shadows(bike.root);
bike.root.position.set(0, COM_Y, 0);
scene.add(bike.root);

// ---------------------------------------------------------------- rider
const own = SLOT_DRESS[Number(kit) || 0];
const dress: SkierDress = { ...own, outfit: bikeKit(own.outfit) };
const figure = createSkier(dress, <M extends THREE.Material>(m: M) => m);
shadows(figure.group);
const riderRoot = new THREE.Group();
riderRoot.add(figure.group);
const keep = (g: THREE.BufferGeometry): THREE.BufferGeometry => g;
const feet = buildWalkBoots(
  { boot: { length: 0.3, height: 0.2 } },
  plain({ color: 0x111111 }),
  plain({}),
  keep,
);
for (const f of feet) figure.group.add(f);
addBikeShoes(feet, 0.2, plain, keep).show(true);
scene.add(riderRoot);

/** A moment's pose, made up as the engine would have it. */
type Moment = { name: string; pose: Partial<BikePose>; tilt?: number };
const STAND = BIKE.rider.stand;
const rest = (): BikePose =>
  ({
    mode: "ridden",
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    q: { x: 0, y: 0, z: 0, w: 1 },
    frontSpin: 0,
    rearSpin: 0,
    steer: 0,
    fork: 0.05,
    shock: 0.06,
    forkShare: 0.25,
    shockShare: 0.3,
    crank: 0,
    pedalling: false,
    front: 0,
    rear: 0,
    rider: { x: 0, y: STAND.y, z: STAND.z },
    shift: 0,
    crouch: 0,
    lean: 0,
    onIt: true,
    walking: null,
    airborne: false,
    airTime: 0,
  }) as BikePose;
const MOMENTS: Moment[] = [
  { name: "attack", pose: {} },
  {
    name: "pedal",
    pose: { crank: 0.8, pedalling: true, rider: { x: 0, y: STAND.y + 0.02, z: STAND.z + 0.03 } },
  },
  {
    name: "pedal2",
    pose: { crank: 2.4, pedalling: true, rider: { x: 0, y: STAND.y + 0.02, z: STAND.z + 0.03 } },
  },
  {
    name: "brake",
    pose: {
      front: 1,
      rear: 1,
      shift: 1,
      fork: 0.12,
      forkShare: 0.6,
      rider: { x: 0, y: STAND.y - 0.08, z: STAND.z - 0.24 },
    },
  },
  {
    name: "crouch",
    pose: {
      crouch: 1,
      fork: 0.1,
      shock: 0.12,
      rider: { x: 0, y: STAND.y - 0.1, z: STAND.z - 0.06 },
    },
  },
  {
    name: "air",
    pose: {
      airborne: true,
      airTime: 0.4,
      fork: 0,
      shock: 0,
      forkShare: 0,
      shockShare: 0,
      rider: { x: 0, y: STAND.y + 0.05, z: STAND.z - 0.04 },
    },
  },
  {
    name: "lean-l",
    pose: {
      roll: -0.6,
      steer: -0.12,
      lean: -0.6,
      rider: { x: -0.08, y: STAND.y - 0.05, z: STAND.z },
    },
    tilt: -0.6,
  },
  {
    name: "lean-r",
    pose: { roll: 0.6, steer: 0.12, lean: 0.6, rider: { x: 0.08, y: STAND.y - 0.05, z: STAND.z } },
    tilt: 0.6,
  },
  {
    name: "land",
    pose: {
      fork: 0.17,
      shock: 0.17,
      forkShare: 0.85,
      shockShare: 0.85,
      crouch: 0.6,
      shift: 0.4,
      rider: { x: 0, y: STAND.y - 0.09, z: STAND.z - 0.1 },
    },
  },
];
const momentOf = (name: string): Moment => MOMENTS.find((m) => m.name === name) ?? MOMENTS[0];

const frame: BodyFrame = {
  origin: { x: 0, y: 0, z: 0 },
  x: { x: 1, y: 0, z: 0 },
  y: { x: 0, y: 1, z: 0 },
  z: { x: 0, y: 0, z: 1 },
};
const basis = new THREE.Matrix4();
const qTilt = new THREE.Quaternion();

/** Lay the bike and its rider at moment `m` (`bare` hides him). */
function lay(m: Moment, bare: boolean): void {
  const pose = { ...rest(), ...m.pose } as BikePose;
  // The bike leant about its contact line: turned about +z through the
  // floor, its centre of mass swung with it.
  qTilt.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -(m.tilt ?? 0));
  const lift = pose.airborne ? 0.45 : 0;
  bike.root.quaternion.copy(qTilt);
  bike.root.position.set(0, lift, 0).add(new THREE.Vector3(0, COM_Y, 0).applyQuaternion(qTilt));
  poseBike(bike.nodes, pose);
  riderRoot.visible = !bare;
  if (bare) return;
  // His root: his centre of mass on the bike's attitude.
  const r = pose.rider;
  riderRoot.quaternion.copy(qTilt);
  riderRoot.position
    .set(BIKE_BB.x + r.x, BIKE_BB.y + r.y, BIKE_BB.z + r.z)
    .applyQuaternion(qTilt)
    .add(bike.root.position);
  const p = riderPose(pose)(0, frame);
  figure.group.position.set(frame.origin.x, frame.origin.y, frame.origin.z);
  basis.makeBasis(
    new THREE.Vector3(frame.x.x, frame.x.y, frame.x.z),
    new THREE.Vector3(frame.y.x, frame.y.y, frame.y.z),
    new THREE.Vector3(frame.z.x, frame.z.y, frame.z.z),
  );
  figure.group.quaternion.setFromRotationMatrix(basis);
  figure.sprawl(p);
  bootsOn(feet, p, true, 0);
}

// ---------------------------------------------------------------- lenses
/** The bike's middle, where the lenses aim. */
const MID = new THREE.Vector3(0, 0.75, -0.02);
const persp = new THREE.PerspectiveCamera(24, W / H, 0.05, 100);
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 100);

/** A lens on a sphere about the bike: `yaw` deg from the drive side (−x,
 * 0) round toward the front (90), `elev` deg up. */
function around(yaw: number, elev: number, dist = 5.2, at = MID): THREE.Camera {
  const a = (yaw * Math.PI) / 180;
  const e = (elev * Math.PI) / 180;
  persp.aspect = W / H;
  persp.position
    .set(-Math.cos(a) * Math.cos(e) * dist, Math.sin(e) * dist, Math.sin(a) * Math.cos(e) * dist)
    .add(at);
  persp.up.set(0, 1, 0);
  persp.lookAt(at);
  persp.updateProjectionMatrix();
  return persp;
}

/** A square-on side lens to scale: `drive` from −x, else from +x; the
 * frame `span` m tall. */
function side(drive: boolean, span = 1.9): THREE.Camera {
  const k = span / 2;
  ortho.left = (-k * W) / H;
  ortho.right = (k * W) / H;
  ortho.top = k;
  ortho.bottom = -k;
  ortho.position.set(drive ? -6 : 6, MID.y + 0.05, MID.z);
  ortho.up.set(0, 1, 0);
  ortho.lookAt(MID.x, MID.y + 0.05, MID.z);
  ortho.updateProjectionMatrix();
  return ortho;
}

/** A side lens that puts the axles at rest where `axles` marks them in a
 * `w × h` photograph. */
function onAxles(
  drive: boolean,
  axles: [[number, number], [number, number]],
  w: number,
  h: number,
): THREE.Camera {
  const rearW = new THREE.Vector3(0, REAR_REST.y, REAR_REST.z).add(
    new THREE.Vector3(0, BIKE_BB.y + COM_Y, BIKE_BB.z),
  );
  const fa = frontAxle(0, 0.05);
  const frontW = new THREE.Vector3(0, fa.y + BIKE_BB.y + COM_Y, fa.z + BIKE_BB.z);
  const forward = new THREE.Vector3(drive ? 1 : -1, 0, 0);
  const right0 = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
  const up0 = new THREE.Vector3(0, 1, 0);
  const dw = frontW.clone().sub(rearW);
  const [[x1, y1], [x2, y2]] = axles;
  const dp = { x: x2 - x1, y: -(y2 - y1) };
  const s = Math.hypot(dp.x, dp.y) / Math.hypot(dw.dot(right0), dw.dot(up0));
  const theta = Math.atan2(dp.y, dp.x) - Math.atan2(dw.dot(up0), dw.dot(right0));
  const phi = -theta;
  const right = right0.clone().multiplyScalar(Math.cos(phi)).addScaledVector(up0, Math.sin(phi));
  const up = right0.clone().multiplyScalar(-Math.sin(phi)).addScaledVector(up0, Math.cos(phi));
  const u = (x1 - w / 2) / s;
  const vv = (h / 2 - y1) / s;
  const c = rearW
    .clone()
    .addScaledVector(right, -u)
    .addScaledVector(up, -vv)
    .addScaledVector(forward, -6);
  ortho.left = -w / 2 / s;
  ortho.right = w / 2 / s;
  ortho.top = h / 2 / s;
  ortho.bottom = -h / 2 / s;
  ortho.position.copy(c);
  ortho.up.copy(up);
  ortho.lookAt(c.clone().add(forward));
  ortho.updateProjectionMatrix();
  return ortho;
}

const LENSES: Record<string, () => THREE.Camera> = {
  drive: () => side(true),
  brake: () => side(false),
  "front-3q": () => around(50, 12),
  "rear-3q": () => around(-40, 14),
  "brake-3q": () => around(130, 10),
  front: () => around(90, 6, 6),
  top: () => around(0, 80, 4.5),
  low: () => around(30, 2, 4.2, new THREE.Vector3(0, 0.55, 0)),
};

function shoot(cam: THREE.Camera, w = W, h = H): string {
  renderer.setSize(w, h);
  if (cam instanceof THREE.PerspectiveCamera) {
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  }
  renderer.render(scene, cam);
  return canvas.toDataURL("image/png");
}

// ---------------------------------------------------------------- sheets
const host = document.getElementById("sheet") as HTMLDivElement;
function lay_out(frames: Frame[], cols: number, extra: HTMLElement[] = []): void {
  host.innerHTML = "";
  host.style.gridTemplateColumns = `repeat(${cols}, auto)`;
  for (const e of extra) host.appendChild(e);
  for (const f of frames) {
    const cell = document.createElement("figure");
    const img = document.createElement("img");
    img.src = f.png;
    img.style.width = `${Math.round(W * 0.5)}px`;
    cell.appendChild(img);
    const cap = document.createElement("figcaption");
    cap.textContent = f.caption;
    cell.appendChild(cap);
    host.appendChild(cell);
  }
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

async function refsSheet(): Promise<Frame[]> {
  const res = await fetch("refs/refs.json");
  if (!res.ok)
    throw new Error("no refs/refs.json — point the driver at a folder with one (--refs DIR)");
  const refs = (await res.json()) as Ref[];
  const out: Frame[] = [];
  for (const r of refs) {
    const photo = await loadImage(`refs/${r.file}`);
    const w = photo.naturalWidth;
    const h = photo.naturalHeight;
    lay(momentOf(r.pose ?? "attack"), !!r.bare);
    const drive = r.view !== "brake";
    const cam =
      r.axles && (r.view === "drive" || r.view === "brake")
        ? onAxles(drive, r.axles, w, h)
        : (LENSES[r.view] ?? LENSES.drive)();
    const ours = shoot(cam, w, h);
    // Ours over the photograph at half strength, where the axles agree.
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d") as CanvasRenderingContext2D;
    g.drawImage(photo, 0, 0);
    if (r.axles) {
      g.globalAlpha = 0.5;
      g.drawImage(await loadImage(ours), 0, 0);
    }
    const tag = r.file.replace(/\.[a-z]+$/i, "");
    out.push({ view: `${tag}-photo`, caption: `${tag} photograph`, png: c.toDataURL("image/png") });
    if (r.axles) {
      g.globalAlpha = 1;
      g.drawImage(photo, 0, 0);
      out[out.length - 1].png = c.toDataURL("image/png");
      g.globalAlpha = 0.55;
      g.drawImage(await loadImage(ours), 0, 0);
      out.push({
        view: `${tag}-over`,
        caption: `${tag} ours over it`,
        png: c.toDataURL("image/png"),
      });
    }
    out.push({
      view: `${tag}-ours`,
      caption: `${tag} ours (${r.view}, ${r.pose ?? "attack"})`,
      png: ours,
    });
  }
  return out;
}

async function sheet(): Promise<{ frames: Frame[] }> {
  const frames: Frame[] = [];
  if (sheetAsked === "bike") {
    lay(MOMENTS[0], true);
    for (const [name, lens] of Object.entries(LENSES)) {
      if (onlyViews.length && !onlyViews.includes(name)) continue;
      frames.push({ view: name, caption: `${look} bike — ${name}`, png: shoot(lens()) });
    }
    lay_out(frames, 3);
  } else if (sheetAsked === "rider") {
    const lenses = onlyViews.length ? onlyViews : ["drive", "front-3q"];
    for (const m of MOMENTS) {
      for (const l of lenses) {
        lay(m, false);
        frames.push({
          view: `${m.name}-${l}`,
          caption: `${m.name} — ${l}`,
          png: shoot(LENSES[l]()),
        });
      }
    }
    lay_out(frames, lenses.length * 2);
  } else if (sheetAsked === "refs") {
    frames.push(...(await refsSheet()));
    lay_out(frames, 3);
  }
  return { frames };
}

let tris = 0;
bike.root.traverse((o) => {
  if (o instanceof THREE.Mesh)
    tris +=
      (o.geometry.index ? o.geometry.index.count : o.geometry.getAttribute("position").count) / 3;
});
window.__studio = {
  ready: Promise.resolve(`${look} bike, ${Math.round(tris)} triangles`),
  sheet,
};
