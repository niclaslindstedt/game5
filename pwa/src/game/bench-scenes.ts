// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BENCHMARK'S SCENES: the same pinned race under the skies and from the
// lens a picture row is dearest in, so a price is not the late morning's
// alone. Each is a sky over the benchmark's map and, for the VISTA, the lens
// planted high across the basin (`bench-run.ts`'s `vistaOf`).
//
// - RACE: the plan's own — fair cumulus at 11h, the chase lens.
// - VISTA: the same sky from high on the basin's edge, where DISTANCE, the
//   far woods and the haze are dearest.
// - SUNSET: a clear sky with the sun on the horizon (`hourOfTime`), the low
//   light and the long shadows across the whole face.
// - NIGHT: a clear sky well after sunset — the stars, the moon, every
//   skier's headlamp and the floods, where LAMPS is priced at all.
// - SNOW: a steady fall at 11h — the flakes, the closed view, the new snow.
//
// Every scene is CALM, as the plan's sky is: the wind pushes every skier in
// the field, and the race must be the same race under every sky. DOM-free.

import {
  hourOfTime,
  type Level,
  type SkyOverride,
  type TimeOfDay,
  type WeatherKind,
} from "@engine";

import { BENCHMARK } from "./benchmark-plan.ts";

export type BenchSceneId = "race" | "vista" | "sunset" | "night" | "snow";

export type BenchScene = {
  id: BenchSceneId;
  weather: WeatherKind;
  /** The plan's hour, or a time of day read off the map's date and place. */
  time: number | TimeOfDay;
  /** The lens planted on the basin's edge rather than the chase. */
  vista: boolean;
};

const PLAN = BENCHMARK.sky;

/** Every scene, in the order ALL SCENES runs them. */
export const BENCH_SCENES: readonly BenchScene[] = [
  { id: "race", weather: PLAN.weather.kind, time: PLAN.hour, vista: false },
  { id: "vista", weather: PLAN.weather.kind, time: PLAN.hour, vista: true },
  { id: "sunset", weather: "clear", time: "sunset", vista: false },
  { id: "night", weather: "clear", time: "night", vista: false },
  { id: "snow", weather: "snow", time: PLAN.hour, vista: false },
];

export const BENCH_SCENE_IDS: readonly BenchSceneId[] = BENCH_SCENES.map((s) => s.id);

export function benchScene(id: BenchSceneId): BenchScene {
  return BENCH_SCENES.find((s) => s.id === id) ?? BENCH_SCENES[0];
}

export function isBenchScene(raw: string | null): raw is BenchSceneId {
  return (BENCH_SCENE_IDS as readonly (string | null)[]).includes(raw);
}

/** The hour a scene stands at on this map's date and latitude. */
export function sceneHour(scene: BenchScene, level: Level): number {
  return typeof scene.time === "number"
    ? scene.time
    : hourOfTime(level.sun.latitude, level.sun.dayOfYear, scene.time);
}

/** The sky the race is stood up under. */
export function sceneSky(scene: BenchScene, level: Level): SkyOverride {
  return { weather: { kind: scene.weather, wind: 0 }, hour: sceneHour(scene, level) };
}
