// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ELEVATION MODEL'S TILES — fetched, kept and read, for the scripts
// that bake real ground: `real-faces.mjs` (the faces, off the 30 m model)
// and `far-faces.mjs` (the country round them, off the 90 m one).
//
// The model is Copernicus DEM — GLO-30 (1 arc second, `arcsec: 1`) or
// GLO-90 (3 arc seconds, `arcsec: 3`) — one 1°×1° tiled, deflated float32
// GeoTIFF a tile, named by its south-west corner. A tile over open sea is
// not published; it is remembered as missing and read as the sea, 0 m.
// © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018,
// provided under COPERNICUS by the European Union and ESA
// (`docs/real-faces.md`).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import process from "node:process";

const BUCKETS = {
  1: { url: "https://copernicus-dem-30m.s3.amazonaws.com", code: "10" },
  3: { url: "https://copernicus-dem-90m.s3.amazonaws.com", code: "30" },
};

/** The tile a point falls in, by its south-west corner's name. */
export function tileName(lat, lon) {
  const la = Math.floor(lat);
  const lo = Math.floor(lon);
  const ns = la >= 0 ? `N${String(la).padStart(2, "0")}` : `S${String(-la).padStart(2, "0")}`;
  const ew = lo >= 0 ? `E${String(lo).padStart(3, "0")}` : `W${String(-lo).padStart(3, "0")}`;
  return { name: `${ns}_00_${ew}_00`, la, lo };
}

/** A tiled, deflated, float32 GeoTIFF with the floating-point predictor —
 * the shape every tile of the model comes in — read a tile at a time. */
export function openTiff(file) {
  const buf = readFileSync(file);
  const le = buf.toString("latin1", 0, 2) === "II";
  if (!le) throw new Error(`${file}: big-endian TIFF`);
  const u16 = (o) => buf.readUInt16LE(o);
  const u32 = (o) => buf.readUInt32LE(o);
  const ifd = u32(4);
  const count = u16(ifd);
  const tags = new Map();
  for (let i = 0; i < count; i++) {
    const e = ifd + 2 + i * 12;
    const tag = u16(e);
    const type = u16(e + 2);
    const n = u32(e + 4);
    const size = type === 3 ? 2 : type === 16 ? 8 : 4;
    const at = n * size <= 4 ? e + 8 : u32(e + 8);
    const values = [];
    for (let k = 0; k < n; k++) {
      const o = at + k * size;
      values.push(size === 2 ? u16(o) : size === 8 ? Number(buf.readBigUInt64LE(o)) : u32(o));
    }
    tags.set(tag, values);
  }
  const width = tags.get(256)[0];
  const height = tags.get(257)[0];
  const tw = tags.get(322)[0];
  const th = tags.get(323)[0];
  const offsets = tags.get(324);
  const counts = tags.get(325);
  if (tags.get(259)[0] !== 8 || tags.get(317)?.[0] !== 3) {
    throw new Error(`${file}: not a deflated tile with the floating-point predictor`);
  }
  const across = Math.ceil(width / tw);
  const kept = new Map();
  const tile = (i) => {
    let t = kept.get(i);
    if (t) return t;
    const raw = inflateSync(buf.subarray(offsets[i], offsets[i] + counts[i]));
    t = new Float32Array(tw * th);
    const row = new Uint8Array(tw * 4);
    const view = new DataView(row.buffer);
    for (let r = 0; r < th; r++) {
      const src = raw.subarray(r * tw * 4, (r + 1) * tw * 4);
      // Undo the byte differencing, then gather each sample's bytes back out
      // of their four planes (most significant first).
      let acc = 0;
      const undiff = new Uint8Array(tw * 4);
      for (let k = 0; k < tw * 4; k++) undiff[k] = acc = (acc + src[k]) & 0xff;
      for (let c = 0; c < tw; c++) {
        row[c * 4] = undiff[c];
        row[c * 4 + 1] = undiff[tw + c];
        row[c * 4 + 2] = undiff[2 * tw + c];
        row[c * 4 + 3] = undiff[3 * tw + c];
        t[r * tw + c] = view.getFloat32(c * 4, false);
      }
    }
    kept.set(i, t);
    return t;
  };
  const at = (r, c) => {
    const rr = Math.min(height - 1, Math.max(0, r));
    const cc = Math.min(width - 1, Math.max(0, c));
    return tile(Math.floor(rr / th) * across + Math.floor(cc / tw))[(rr % th) * tw + (cc % tw)];
  };
  return { width, height, at };
}

/** The model at `arcsec` (1 or 3), its tiles kept in `cache`. */
export function createDem({ cache, arcsec }) {
  const bucket = BUCKETS[arcsec];
  const keyOf = (name) => `Copernicus_DSM_COG_${bucket.code}_${name}_DEM`;
  const fileOf = (name) => join(cache, `${name}.tif`);
  const noneOf = (name) => join(cache, `${name}.none`);

  /** Fetch a tile not yet kept (a tile over open sea is remembered as none). */
  async function fetchTile(name) {
    if (existsSync(fileOf(name)) || existsSync(noneOf(name))) return;
    const key = keyOf(name);
    const url = `${bucket.url}/${key}/${key}.tif`;
    process.stdout.write(`fetching ${name}… `);
    const res = await fetch(url);
    mkdirSync(cache, { recursive: true });
    if (res.status === 404 || res.status === 403) {
      writeFileSync(noneOf(name), "");
      console.log("none (sea)");
      return;
    }
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    writeFileSync(fileOf(name), Buffer.from(await res.arrayBuffer()));
    console.log("kept");
  }

  const tiffs = new Map();
  function tiffOf(name) {
    if (tiffs.has(name)) return tiffs.get(name);
    let t = null;
    if (existsSync(fileOf(name))) t = openTiff(fileOf(name));
    else if (!existsSync(noneOf(name)))
      throw new Error(`${fileOf(name)} missing: run with --fetch`);
    tiffs.set(name, t);
    return t;
  }

  /** The model's height at a point, bilinear between its samples (0 over a
   * tile of open sea). */
  function heightAt(lat, lon) {
    const { name, la, lo } = tileName(lat, lon);
    const t = tiffOf(name);
    if (!t) return 0;
    const r = (la + 1 - lat) * t.height - 0.5;
    const c = (lon - lo) * t.width - 0.5;
    const r0 = Math.floor(r);
    const c0 = Math.floor(c);
    const fr = r - r0;
    const fc = c - c0;
    const a = t.at(r0, c0) * (1 - fc) + t.at(r0, c0 + 1) * fc;
    const b = t.at(r0 + 1, c0) * (1 - fc) + t.at(r0 + 1, c0 + 1) * fc;
    return a * (1 - fr) + b * fr;
  }

  return { tileName, fetchTile, heightAt };
}
