// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// How CI's test shards are cut: by measured TIME, not by file count.
//
// Vitest's own `--shard` hashes each path and hands every slice the same
// NUMBER of files. That is fine while files cost about the same, and here
// they do not: four files build and ski whole mountains for most of a
// minute each while half the suite is over in a few milliseconds, so a hash
// that drops two of the heavy ones on one runner doubles that runner's time
// and the run waits on it. This packs the files instead — heaviest first,
// each onto the lightest shard so far (longest-processing-time, a greedy
// bin packer) — over the weights below, so every runner gets about the same
// seconds of work and no shard holds more than one of the heavy files while
// another holds none. Within a shard the heaviest file starts first, so the
// long one is never the file left running alone at the end.
//
// The weights are seconds a file took on a CI shard, rounded — the time on
// its `✓ tests/<file> (N tests) <ms>ms` line in the job's log, which is the
// time on a runner busy with three other files, the one that matters here —
// and they only steer the balance: a stale weight costs wall time on one
// runner, never a test. But only a little while it is near: a heavy file
// missing from the table counts as `DEFAULT_WEIGHT`, is started LAST, and
// leaves its runner running it alone at the end (one such file cost a run
// two and a half minutes). The cheap files are left out on purpose.
// Re-measure off a CI run when a file gets much heavier, a heavy one is
// added or split, or a shard's time strays far from the others'.
//
// The packing must come out the same on every runner, since each one cuts
// the whole list and keeps only its own slice: the files are put in path
// order before they are packed and every tie breaks on the path.
import { relative } from "node:path";
import { BaseSequencer, type TestSpecification } from "vitest/node";

/** Seconds a file takes, measured. Files under a second and a half are left
 * to `DEFAULT_WEIGHT`. */
export const SHARD_WEIGHTS: Readonly<Record<string, number>> = {
  "tests/ski_routes_test.ts": 255,
  "tests/resort_test.ts": 230,
  "tests/weather_test.ts": 205,
  "tests/mapgen_test.ts": 204,
  "tests/lift_ride_test.ts": 183,
  "tests/birds_test.ts": 176,
  "tests/civilians_test.ts": 165,
  "tests/switch_test.ts": 164,
  "tests/replay_test.ts": 148,
  "tests/afterski_test.ts": 137,
  "tests/bike_park_regions_test.ts": 128,
  "tests/analysis_test.ts": 127,
  "tests/race_maps_test.ts": 124,
  "tests/cabins_test.ts": 123,
  "tests/race_maps_speedski_test.ts": 123,
  "tests/race_maps_superg_test.ts": 117,
  "tests/junctions_test.ts": 113,
  "tests/spectators_test.ts": 110,
  "tests/lift_links_test.ts": 108,
  "tests/race_maps_downhill_test.ts": 106,
  "tests/query_test.ts": 105,
  "tests/trick_maps_test.ts": 102,
  "tests/race_maps_skicross_test.ts": 101,
  "tests/resort_buildings_test.ts": 100,
  "tests/bike_anim_test.ts": 99,
  "tests/lifts_test.ts": 92,
  "tests/board_press_test.ts": 91,
  "tests/enthusiasts_test.ts": 91,
  "tests/far_ranges_test.ts": 80,
  "tests/route_sign_test.ts": 77,
  "tests/free_ride_card_test.ts": 75,
  "tests/bike_ride_test.ts": 72,
  "tests/race_maps_giantslalom_test.ts": 72,
  "tests/real_faces_test.ts": 71,
  "tests/chute_test.ts": 68,
  "tests/simulation_test.ts": 67,
  "tests/stop_hand_test.ts": 66,
  "tests/halfpipe_test.ts": 64,
  "tests/challenges_test.ts": 61,
  "tests/slopestyle_hud_test.ts": 61,
  "tests/technique_test.ts": 61,
  "tests/village_streets_test.ts": 61,
  "tests/course_solids_test.ts": 60,
  "tests/jump_hills_large_test.ts": 60,
  "tests/tricks_test.ts": 59,
  "tests/run_names_test.ts": 59,
  "tests/board_test.ts": 58,
  "tests/map_progress_test.ts": 55,
  "tests/para_wind_test.ts": 54,
  "tests/building_walls_test.ts": 53,
  "tests/aerials_hud_test.ts": 49,
  "tests/bike_park_test.ts": 48,
  "tests/moguls_hud_test.ts": 48,
  "tests/benchmark_test.ts": 48,
  "tests/sky_clock_test.ts": 46,
  "tests/halfpipe_hud_test.ts": 45,
  "tests/rocks_test.ts": 45,
  "tests/trick_ramps_test.ts": 43,
  "tests/world_render_test.ts": 43,
  "tests/ski_jump_test.ts": 42,
  "tests/panorama_test.ts": 41,
  "tests/rock_ground_test.ts": 41,
  "tests/grimbear_test.ts": 39,
  "tests/fires_look_test.ts": 39,
  "tests/attempt_alone_test.ts": 39,
  "tests/hockey_stop_test.ts": 38,
  "tests/outfit_test.ts": 37,
  "tests/moguls_test.ts": 36,
  "tests/real_houses_test.ts": 35,
  "tests/bike_hit_test.ts": 35,
  "tests/fires_test.ts": 35,
  "tests/jump_hills_test.ts": 32,
  "tests/region_test.ts": 32,
  "tests/giant_slalom_test.ts": 31,
  "tests/airstrip_test.ts": 31,
  "tests/generator_version_test.ts": 30,
  "tests/daring_bot_test.ts": 30,
  "tests/board_bot_test.ts": 29,
  "tests/wingsuit_test.ts": 28,
  "tests/real_water_village_test.ts": 28,
  "tests/para_test.ts": 28,
  "tests/crowd_test.ts": 27,
  "tests/board_lift_test.ts": 26,
  "tests/ski_cross_test.ts": 26,
  "tests/sled_test.ts": 25,
  "tests/balloon_test.ts": 24,
  "tests/minimap_test.ts": 24,
  "tests/air_bounds_test.ts": 23,
  "tests/avalanche_test.ts": 22,
  "tests/revert_test.ts": 22,
  "tests/impact_forecast_test.ts": 22,
  "tests/jump_audio_test.ts": 21,
  "tests/jury_test.ts": 21,
  "tests/altitude_test.ts": 20,
  "tests/sled_fire_test.ts": 20,
  "tests/injury_lab_test.ts": 20,
  "tests/traffic_test.ts": 20,
  "tests/aerials_test.ts": 19,
  "tests/rescue_flight_test.ts": 19,
  "tests/slopestyle_test.ts": 18,
  "tests/cloud_field_test.ts": 18,
  "tests/town_test.ts": 17,
  "tests/downhill_test.ts": 17,
  "tests/wingsuit_craft_test.ts": 17,
  "tests/chair_hands_test.ts": 16,
  "tests/air_temp_test.ts": 15,
  "tests/input_plane_test.ts": 15,
  "tests/plane_test.ts": 15,
  "tests/venue_mesh_test.ts": 15,
  "tests/ghost_test.ts": 14,
  "tests/speed_ski_test.ts": 13,
  "tests/bike_audio_test.ts": 13,
  "tests/super_g_test.ts": 13,
  "tests/wingsuit_look_test.ts": 13,
  "tests/cliff_drop_test.ts": 12,
  "tests/terrain_wedges_test.ts": 11,
  "tests/hud_test.ts": 10,
  "tests/landing_test.ts": 10,
  "tests/spray_flight_test.ts": 10,
  "tests/lift_turns_test.ts": 10,
  "tests/summer_ground_test.ts": 10,
  "tests/drawn_solids_test.ts": 9,
  "tests/speed_ski_hud_test.ts": 9,
  "tests/sled_tips_test.ts": 9,
  "tests/avalanche_rescue_test.ts": 8,
  "tests/lift_board_test.ts": 8,
  "tests/building_doors_test.ts": 7,
  "tests/mishaps_test.ts": 6,
  "tests/crash_test.ts": 6,
  "tests/para_acro_test.ts": 6,
  "tests/weather_front_test.ts": 6,
  "tests/heli_test.ts": 6,
  "tests/bike_freeride_test.ts": 6,
  "tests/free_seeds_test.ts": 6,
  "tests/groomer_test.ts": 6,
  "tests/cloud_volume_test.ts": 5,
  "tests/replay_keep_test.ts": 5,
  "tests/free_ride_test.ts": 5,
  "tests/cinema_camera_test.ts": 5,
  "tests/determinism_test.ts": 5,
  "tests/skis_under_test.ts": 5,
  "tests/heli_grip_test.ts": 5,
  "tests/replay_gore_test.ts": 5,
  "tests/bike_test.ts": 4,
  "tests/fall_lab_test.ts": 4,
  "tests/wingsuit_card_test.ts": 4,
  "tests/avalanche_look_test.ts": 4,
  "tests/snow_guns_test.ts": 4,
  "tests/handling_test.ts": 4,
  "tests/sfw_test.ts": 4,
  "tests/cable_cut_test.ts": 4,
  "tests/chair_jump_test.ts": 4,
  "tests/heli_wreck_test.ts": 4,
  "tests/beast_hit_test.ts": 4,
  "tests/village_buildings_test.ts": 4,
  "tests/catalog_test.ts": 4,
  "tests/cable_test.ts": 4,
  "tests/resume_run_test.ts": 4,
  "tests/challenge_book_test.ts": 3,
  "tests/skier_test.ts": 3,
  "tests/lift_skis_test.ts": 3,
  "tests/snow_buildup_test.ts": 3,
  "tests/spray_test.ts": 3,
  "tests/body_test.ts": 3,
  "tests/buzz_test.ts": 3,
  "tests/sled_landing_test.ts": 3,
  "tests/cross_gate_test.ts": 3,
  "tests/wordmark_test.ts": 3,
  "tests/dog_walkers_test.ts": 3,
  "tests/board_drive_test.ts": 2,
  "tests/camera_skijump_test.ts": 2,
  "tests/plane_hud_test.ts": 2,
  "tests/flight_test.ts": 2,
  "tests/player_model_test.ts": 2,
  "tests/bike_tangle_test.ts": 2,
  "tests/posts_test.ts": 2,
  "tests/rivals_test.ts": 2,
  "tests/summer_people_test.ts": 2,
  "tests/air_test.ts": 2,
  "tests/ski_jump_contest_test.ts": 2,
  "tests/stats_test.ts": 2,
  "tests/riders_test.ts": 2,
  "tests/board_tricks_test.ts": 2,
  "tests/deform_field_test.ts": 2,
  "tests/machine_pick_test.ts": 2,
  "tests/board_range_test.ts": 2,
  "tests/civilian_figure_test.ts": 2,
  "tests/gore_test.ts": 2,
  "tests/jib_test.ts": 2,
  "tests/poleless_test.ts": 2,
  "tests/snow_age_test.ts": 2,
  "tests/village_cuts_test.ts": 2,
};

/** What a file the table does not name is taken to cost: the import alone
 * is most of a second on a busy runner. */
export const DEFAULT_WEIGHT = 1;

export function weightOf(path: string): number {
  return SHARD_WEIGHTS[path] ?? DEFAULT_WEIGHT;
}

/** Heaviest first; a tie on the path, so the order is the same everywhere. */
function heaviestFirst(a: string, b: string): number {
  return weightOf(b) - weightOf(a) || (a < b ? -1 : a > b ? 1 : 0);
}

/** The repo-relative paths cut into `count` shards of about equal weight,
 * each shard's files heaviest first. Every path lands in exactly one. */
export function packShards(paths: readonly string[], count: number): string[][] {
  const shards = Array.from({ length: count }, () => ({ weight: 0, paths: [] as string[] }));
  for (const path of [...paths].sort(heaviestFirst)) {
    let lightest = shards[0];
    for (const shard of shards) if (shard.weight < lightest.weight) lightest = shard;
    lightest.weight += weightOf(path);
    lightest.paths.push(path);
  }
  return shards.map((shard) => shard.paths);
}

/** Vitest's sequencer with the shard cut by `packShards` and every run's
 * files started heaviest first. */
export class WeightedSequencer extends BaseSequencer {
  private pathOf(spec: TestSpecification): string {
    return relative(this.ctx.config.root, spec.moduleId).replaceAll("\\", "/");
  }

  override async shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const shard = this.ctx.config.shard;
    if (!shard) return files;
    const byPath = new Map(files.map((spec) => [this.pathOf(spec), spec]));
    const mine = packShards([...byPath.keys()], shard.count)[shard.index - 1] ?? [];
    return mine.map((path) => byPath.get(path)!);
  }

  override async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    return [...files].sort((a, b) => heaviestFirst(this.pathOf(a), this.pathOf(b)));
  }
}
