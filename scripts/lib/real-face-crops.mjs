// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REAL FACES' CROPS — where each of the twenty faces sits on the globe
// and how a map point is turned to a globe point and back. Shared by the
// elevation bake (`scripts/real-faces.mjs`) and the hints bake
// (`scripts/real-hints.mjs`), which must read one crop the same way.

/** The map's side, m. */
export const SIZE = 4000;

/** Every face: its region (R21), the country it lies in (ISO 3166-1
 * alpha-2 — the start card files a face under it, nothing finer), the middle it was searched round (°),
 * and the crop the search kept — the window's middle east and north of it
 * (m), the bearing its fall line runs down the map on (° clockwise from
 * north) and how many real metres a metre of the map is. */
export const FACES = [
  {
    id: "alpine-1",
    region: "alpine",
    country: "FR",
    lat: 45.297,
    lon: 6.585,
    east: -1200,
    north: -1800,
    bearing: -4,
    scale: 1.0,
  },
  {
    id: "alpine-2",
    region: "alpine",
    country: "FR",
    lat: 45.4,
    lon: 6.618,
    east: 450,
    north: -300,
    bearing: 42,
    scale: 0.9,
  },
  {
    id: "alpine-3",
    region: "alpine",
    country: "FR",
    lat: 45.452,
    lon: 6.9,
    east: -450,
    north: -1500,
    bearing: 28,
    scale: 0.9,
  },
  {
    id: "alpine-4",
    region: "alpine",
    country: "FR",
    lat: 45.442,
    lon: 6.965,
    east: -1800,
    north: 1800,
    bearing: 68,
    scale: 0.9,
  },
  {
    id: "alpine-5",
    region: "alpine",
    country: "FR",
    lat: 45.5,
    lon: 6.68,
    east: -1500,
    north: 1050,
    bearing: 6,
    scale: 1.1,
  },
  {
    id: "alpine-6",
    region: "alpine",
    country: "FR",
    lat: 45.105,
    lon: 6.085,
    east: 450,
    north: -1050,
    bearing: 226,
    scale: 0.9,
  },
  {
    id: "alpine-7",
    region: "alpine",
    country: "CH",
    lat: 46.015,
    lon: 7.77,
    east: 750,
    north: 1800,
    bearing: 288,
    scale: 0.9,
  },
  {
    id: "alpine-8",
    region: "alpine",
    country: "CH",
    lat: 46.093,
    lon: 7.245,
    east: 0,
    north: -1800,
    bearing: 226,
    scale: 0.9,
  },
  {
    id: "alpine-9",
    region: "alpine",
    country: "AT",
    lat: 47.14,
    lon: 10.24,
    east: 750,
    north: 0,
    bearing: 148,
    scale: 1.0,
  },
  {
    id: "alpine-10",
    region: "alpine",
    country: "AT",
    lat: 46.995,
    lon: 10.305,
    east: 1500,
    north: 1800,
    bearing: 270,
    scale: 1.1,
  },
  {
    id: "alpine-11",
    region: "alpine",
    country: "AT",
    lat: 46.958,
    lon: 10.985,
    east: 0,
    north: -300,
    bearing: 52,
    scale: 0.9,
  },
  {
    id: "continental-1",
    region: "continental",
    country: "US",
    lat: 39.62,
    lon: -106.365,
    east: -300,
    north: 750,
    bearing: -6,
    scale: 0.9,
  },
  {
    id: "continental-2",
    region: "continental",
    country: "US",
    lat: 39.475,
    lon: -106.075,
    east: -1050,
    north: 1500,
    bearing: 70,
    scale: 1.12,
  },
  {
    id: "continental-3",
    region: "continental",
    country: "US",
    lat: 40.64,
    lon: -111.53,
    east: 450,
    north: 1050,
    bearing: 28,
    scale: 1.0,
  },
  {
    id: "continental-4",
    region: "continental",
    country: "US",
    lat: 39.17,
    lon: -106.82,
    east: 1050,
    north: -750,
    bearing: 32,
    scale: 0.9,
  },
  {
    id: "maritime-1",
    region: "maritime",
    country: "CA",
    lat: 50.085,
    lon: -122.95,
    east: -1800,
    north: 450,
    bearing: 316,
    scale: 1.0,
  },
  {
    id: "maritime-2",
    region: "maritime",
    country: "JP",
    lat: 42.865,
    lon: 140.68,
    east: 0,
    north: -1500,
    bearing: 148,
    scale: 0.9,
  },
  {
    id: "maritime-3",
    region: "maritime",
    country: "JP",
    lat: 36.7,
    lon: 137.815,
    east: 1800,
    north: -300,
    bearing: 94,
    scale: 1.0,
  },
  {
    id: "fell-1",
    region: "fell",
    country: "SE",
    lat: 63.418,
    lon: 13.085,
    east: -450,
    north: -750,
    bearing: 192,
    scale: 0.9,
  },
  {
    id: "fell-2",
    region: "fell",
    country: "NO",
    lat: 60.86,
    lon: 8.45,
    east: 1500,
    north: 300,
    bearing: 60,
    scale: 0.9,
  },
];

/** Metres a degree of longitude spans at a face's latitude. */
const eastOf = (face) => 111320 * Math.cos((face.lat * Math.PI) / 180);

/** Where the map point (`x`, `z`) of a face is on the globe, (lat, lon). */
export function globeAt(face, x, z) {
  const th = (face.bearing * Math.PI) / 180;
  const dx = (x - SIZE / 2) * face.scale;
  const dz = (z - SIZE / 2) * face.scale;
  // +z down the fall line (the bearing), +x to its right.
  const e = face.east + dx * Math.cos(th) + dz * Math.sin(th);
  const n = face.north - dx * Math.sin(th) + dz * Math.cos(th);
  const kx = eastOf(face);
  return [face.lat + n / 111320, face.lon + e / kx];
}

/** Where the globe point (`lat`, `lon`) falls on a face's map, [x, z], m —
 * `globeAt` turned back. */
export function mapAt(face, lat, lon) {
  const th = (face.bearing * Math.PI) / 180;
  const e = (lon - face.lon) * eastOf(face) - face.east;
  const n = (lat - face.lat) * 111320 - face.north;
  const dx = e * Math.cos(th) - n * Math.sin(th);
  const dz = e * Math.sin(th) + n * Math.cos(th);
  return [SIZE / 2 + dx / face.scale, SIZE / 2 + dz / face.scale];
}
