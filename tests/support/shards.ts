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
// The weights are seconds a file held its worker on a CI shard, rounded —
// its `shard-weight tests/<file> <s>` line at the end of the job's log
// (`shard-times.ts`), on a runner busy with other files, the time that
// matters here. Not the `✓ tests/<file> <ms>ms` line above it, which leaves
// out the import and the suite callbacks where most files build their maps.
// A shared file's time swings with whether it was the one in its worker to
// build the corpus of maps, so the table is the mean of two or more runs.
// They only steer the balance: a stale weight costs wall time on one
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
  "tests/ski_routes_test.ts": 345,
  "tests/switch_test.ts": 328,
  "tests/lift_ride_test.ts": 246,
  "tests/building_walls_test.ts": 240,
  "tests/mapgen_test.ts": 240,
  "tests/resort_test.ts": 229,
  "tests/weather_test.ts": 204,
  "tests/civilians_test.ts": 201,
  "tests/spectators_test.ts": 188,
  "tests/birds_test.ts": 178,
  "tests/lift_links_test.ts": 168,
  "tests/race_maps_skicross_test.ts": 138,
  "tests/replay_test.ts": 138,
  "tests/race_maps_speedski_test.ts": 135,
  "tests/lifts_test.ts": 134,
  "tests/analysis_test.ts": 133,
  "tests/junctions_test.ts": 130,
  "tests/race_maps_giantslalom_test.ts": 128,
  "tests/facade_test.ts": 127,
  "tests/race_maps_test.ts": 116,
  "tests/village_buildings_test.ts": 113,
  "tests/afterski_test.ts": 112,
  "tests/free_ride_card_test.ts": 112,
  "tests/race_maps_superg_test.ts": 107,
  "tests/village_cuts_test.ts": 106,
  "tests/stations_test.ts": 105,
  "tests/bike_park_regions_test.ts": 104,
  "tests/simulation_test.ts": 104,
  "tests/resort_buildings_test.ts": 103,
  "tests/trick_maps_test.ts": 102,
  "tests/race_maps_downhill_test.ts": 99,
  "tests/route_sign_test.ts": 99,
  "tests/stop_hand_test.ts": 98,
  "tests/real_faces_test.ts": 97,
  "tests/query_test.ts": 94,
  "tests/bike_anim_test.ts": 92,
  "tests/crowd_test.ts": 90,
  "tests/rocks_test.ts": 88,
  "tests/rating_test.ts": 79,
  "tests/far_ranges_test.ts": 78,
  "tests/enthusiasts_test.ts": 76,
  "tests/board_press_test.ts": 73,
  "tests/bike_ride_test.ts": 68,
  "tests/moguls_test.ts": 68,
  "tests/slopestyle_hud_test.ts": 68,
  "tests/cabins_test.ts": 66,
  "tests/jump_hills_large_test.ts": 66,
  "tests/sky_clock_test.ts": 64,
  "tests/airstrip_test.ts": 61,
  "tests/course_solids_test.ts": 60,
  "tests/benchmark_test.ts": 58,
  "tests/board_test.ts": 57,
  "tests/rock_ground_test.ts": 54,
  "tests/tricks_test.ts": 54,
  "tests/para_wind_test.ts": 53,
  "tests/board_bot_test.ts": 52,
  "tests/map_progress_test.ts": 52,
  "tests/village_streets_test.ts": 51,
  "tests/challenges_test.ts": 50,
  "tests/fires_test.ts": 50,
  "tests/aerials_hud_test.ts": 49,
  "tests/grimbear_test.ts": 49,
  "tests/run_names_test.ts": 48,
  "tests/bike_park_test.ts": 47,
  "tests/real_houses_test.ts": 46,
  "tests/wingsuit_test.ts": 46,
  "tests/sled_test.ts": 45,
  "tests/chute_test.ts": 42,
  "tests/halfpipe_hud_test.ts": 42,
  "tests/halfpipe_test.ts": 42,
  "tests/jump_hills_test.ts": 42,
  "tests/region_test.ts": 42,
  "tests/ski_jump_test.ts": 42,
  "tests/giant_slalom_test.ts": 41,
  "tests/attempt_alone_test.ts": 40,
  "tests/minimap_test.ts": 40,
  "tests/ski_cross_test.ts": 40,
  "tests/moguls_hud_test.ts": 39,
  "tests/slopestyle_test.ts": 39,
  "tests/world_render_test.ts": 39,
  "tests/rescue_plan_test.ts": 36,
  "tests/snow_buildup_test.ts": 36,
  "tests/technique_test.ts": 36,
  "tests/hockey_stop_test.ts": 35,
  "tests/bike_hit_test.ts": 34,
  "tests/panorama_test.ts": 34,
  "tests/speed_ski_test.ts": 34,
  "tests/aerials_test.ts": 33,
  "tests/daring_bot_test.ts": 32,
  "tests/jury_test.ts": 32,
  "tests/real_water_village_test.ts": 32,
  "tests/para_test.ts": 31,
  "tests/fire_people_test.ts": 30,
  "tests/outfit_test.ts": 30,
  "tests/building_doors_test.ts": 28,
  "tests/camera_skijump_test.ts": 28,
  "tests/cinema_camera_test.ts": 28,
  "tests/injury_lab_test.ts": 28,
  "tests/mishaps_test.ts": 28,
  "tests/speed_ski_hud_test.ts": 28,
  "tests/balloon_test.ts": 27,
  "tests/revert_test.ts": 27,
  "tests/bike_look_test.ts": 26,
  "tests/drawn_solids_test.ts": 26,
  "tests/generator_version_test.ts": 26,
  "tests/input_plane_test.ts": 26,
  "tests/summer_people_test.ts": 26,
  "tests/wingsuit_look_test.ts": 25,
  "tests/air_temp_test.ts": 24,
  "tests/bike_audio_test.ts": 24,
  "tests/bike_freeride_test.ts": 24,
  "tests/challenge_book_test.ts": 24,
  "tests/crowd_figure_test.ts": 24,
  "tests/downhill_test.ts": 24,
  "tests/altitude_test.ts": 22,
  "tests/board_lift_test.ts": 22,
  "tests/civilian_figure_test.ts": 22,
  "tests/heli_wreck_test.ts": 22,
  "tests/super_g_test.ts": 22,
  "tests/traffic_test.ts": 22,
  "tests/trick_ramps_test.ts": 22,
  "tests/dog_walkers_test.ts": 20,
  "tests/lift_skis_test.ts": 20,
  "tests/machine_pick_test.ts": 20,
  "tests/race_buildings_test.ts": 20,
  "tests/ski_jump_pose_test.ts": 20,
  "tests/strata_glsl_test.ts": 20,
  "tests/trees_test.ts": 20,
  "tests/wingsuit_craft_test.ts": 20,
  "tests/air_test.ts": 19,
  "tests/avalanche_test.ts": 19,
  "tests/jump_audio_test.ts": 19,
  "tests/rescue_flight_test.ts": 19,
  "tests/sled_fire_test.ts": 19,
  "tests/fires_look_test.ts": 18,
  "tests/ghost_test.ts": 18,
  "tests/heli_test.ts": 18,
  "tests/interiors_test.ts": 18,
  "tests/piste_lights_test.ts": 18,
  "tests/plane_test.ts": 18,
  "tests/ski_cross_hud_test.ts": 18,
  "tests/ski_jump_flight_test.ts": 18,
  "tests/ski_jump_hud_test.ts": 18,
  "tests/chair_jump_test.ts": 16,
  "tests/cloud_field_test.ts": 16,
  "tests/lift_turns_test.ts": 16,
  "tests/low_deck_test.ts": 16,
  "tests/replay_gore_test.ts": 16,
  "tests/ski_jump_look_test.ts": 16,
  "tests/snow_guns_test.ts": 16,
  "tests/venue_mesh_test.ts": 16,
  "tests/cable_test.ts": 14,
  "tests/chair_hands_test.ts": 14,
  "tests/contrail_plan_test.ts": 14,
  "tests/free_seeds_test.ts": 14,
  "tests/groomer_test.ts": 14,
  "tests/heli_grip_test.ts": 14,
  "tests/impact_forecast_test.ts": 14,
  "tests/para_acro_test.ts": 14,
  "tests/ski_jump_arena_test.ts": 14,
  "tests/terrain_wedges_test.ts": 14,
  "tests/town_test.ts": 14,
  "tests/landing_test.ts": 13,
  "tests/ski_jump_contest_test.ts": 13,
  "tests/cliff_drop_test.ts": 12,
  "tests/sfw_test.ts": 12,
  "tests/weather_front_test.ts": 12,
  "tests/cross_gate_test.ts": 11,
  "tests/hud_test.ts": 11,
  "tests/air_bounds_test.ts": 10,
  "tests/lift_board_test.ts": 10,
  "tests/posts_test.ts": 10,
  "tests/spray_flight_test.ts": 10,
  "tests/summer_ground_test.ts": 10,
  "tests/avalanche_rescue_test.ts": 8,
  "tests/cable_cut_test.ts": 8,
  "tests/free_ride_test.ts": 8,
  "tests/handling_test.ts": 8,
  "tests/sled_tips_test.ts": 8,
  "tests/wingsuit_card_test.ts": 8,
  "tests/fall_lab_test.ts": 7,
  "tests/replay_keep_test.ts": 7,
  "tests/catalog_test.ts": 6,
  "tests/cloud_volume_test.ts": 6,
  "tests/skis_under_test.ts": 6,
  "tests/crash_test.ts": 5,
  "tests/determinism_test.ts": 5,
  "tests/avalanche_look_test.ts": 4,
  "tests/bike_test.ts": 4,
  "tests/player_model_test.ts": 4,
  "tests/resume_run_test.ts": 4,
  "tests/rivals_test.ts": 4,
  "tests/trick_field_test.ts": 4,
  "tests/board_range_test.ts": 3,
  "tests/buzz_test.ts": 3,
  "tests/plane_hud_test.ts": 3,
  "tests/skier_test.ts": 3,
  "tests/sled_landing_test.ts": 3,
  "tests/atmosphere_test.ts": 2,
  "tests/audio_test.ts": 2,
  "tests/beast_hit_test.ts": 2,
  "tests/bike_steer_test.ts": 2,
  "tests/bike_tangle_test.ts": 2,
  "tests/board_drive_test.ts": 2,
  "tests/board_pose_test.ts": 2,
  "tests/board_tricks_test.ts": 2,
  "tests/body_test.ts": 2,
  "tests/cabin_shapes_test.ts": 2,
  "tests/chute_look_test.ts": 2,
  "tests/civilian_knock_test.ts": 2,
  "tests/course_test.ts": 2,
  "tests/deep_snow_test.ts": 2,
  "tests/deform_field_test.ts": 2,
  "tests/downhill_hud_test.ts": 2,
  "tests/drive_test.ts": 2,
  "tests/flight_test.ts": 2,
  "tests/gore_test.ts": 2,
  "tests/hurt_test.ts": 2,
  "tests/imports_test.ts": 2,
  "tests/jib_test.ts": 2,
  "tests/models_test.ts": 2,
  "tests/nets_test.ts": 2,
  "tests/poleless_test.ts": 2,
  "tests/ragdoll_test.ts": 2,
  "tests/rescue_test.ts": 2,
  "tests/riders_test.ts": 2,
  "tests/ski_stand_test.ts": 2,
  "tests/skier_legs_test.ts": 2,
  "tests/skier_pose_test.ts": 2,
  "tests/slalom_hud_test.ts": 2,
  "tests/slalom_test.ts": 2,
  "tests/snow_age_test.ts": 2,
  "tests/snowfall_test.ts": 2,
  "tests/spray_mass_test.ts": 2,
  "tests/spray_test.ts": 2,
  "tests/stats_test.ts": 2,
  "tests/terrain_shadow_test.ts": 2,
  "tests/thumb_glyphs_test.ts": 2,
  "tests/tree_cards_test.ts": 2,
  "tests/wordmark_test.ts": 2,
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
