// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHICH GENERATOR BUILT THIS MAP — the world generator's versions, and the
// contract that lets a campaign map outlive a change to the rules.
//
// The problem this exists for: a map is generated fresh from its seed, so
// the rules ARE the map. Move a gate spacing, a kicker's height band, a
// draw in the seeded stream, and seed 38 stops being the map that was
// rated, timed and named — silently, everywhere, at once. The campaign is
// the one part of the game where that is not acceptable: its maps were
// CURATED, and a ladder that re-rolls under its own rungs is a ladder
// nobody chose — and every best time and every medal on it is a result on
// a piste that no longer exists.
//
// So a campaign map names the version it was curated under, and that
// version keeps building it. Nothing else does: the free ride, the menu's
// backdrop, every lab, every sweep and every test take
// `CURRENT_GENERATOR_VERSION` and move with the rules, which is the whole
// point of having a generator.
//
// THE CONTRACT, in four lines:
//
//   1. A change that moves what a seed builds gets a NEW version — a row
//      here, with a note saying what moved.
//   2. The old row keeps the old behaviour, through a TRAIT read at the one
//      place the behaviour differs (see `GeneratorTraits` below).
//   3. A campaign map moves to the new version DELIBERATELY: re-rated,
//      re-timed, re-named if the piste no longer earns its name — the
//      `campaign-levels.ts` header says how. Bumping every map in one commit
//      because the suite went red is the exact move this exists to prevent.
//   4. A version no campaign map names any more is DELETED — the row, and
//      every trait branch that only existed for it.
//      `tests/generator_version_test.ts` refuses to let one linger.
//
// Rule 4 is the half people forget, and it is what keeps this from becoming
// a museum of every generator the game ever had. Backward compatibility is
// owed to the committed maps and to nothing else.
//
// HOW A RE-ROLL IS NOTICED. The generator has no way to know its output
// moved, so the campaign carries a DIGEST of every map it pins
// (`levelDigest`, `digest.ts`) and the suite rebuilds each one and compares.
// A red `generator_version_test` is then one of two things with opposite
// fixes: a map deliberately moved (a new seed — the digest was meant to
// change: re-curate and write the new one down), or the RULES moving under
// a map that did not (add a version here, keep the old behaviour on the old
// row, and leave the map's digest alone).

/** A generator version — a whole number that only ever counts up. */
export type GeneratorVersion = number;

/** One version of the generator: what it is, and every way it differs from
 * the current rules.
 *
 * `version` and `note` are the whole of the current row, which has nothing
 * to be different from. A LEGACY trait is added here as an OPTIONAL field
 * the moment a change first re-rolls a pinned map —
 * `{ narrowKickers?: boolean }`, `{ gateSpacing?: Band }` — set on the old
 * rows and absent from the current one, so the code reads
 *
 *     const traits = generatorTraits(opts.version);
 *     const spacing = traits.gateSpacing ?? R.checkpoint.spacing;
 *
 * at the ONE place the behaviour differs and nowhere else. Absent means
 * "build it the way the rules say", which is what makes the current row's
 * branch the one the reader sees first.
 *
 * A trait is never a dial. Dials are `GenerateOptions` and a skier turns
 * them on a free ride; a trait is a fossil kept alive for as long as a
 * curated map stands on it, and it goes in the ground with its version. */
export type GeneratorTraits = {
  version: GeneratorVersion;
  /** One line on what this version of the generator is. On a legacy row,
   * what the version AFTER it changed — which is what tells the next
   * session whether the row is still earning its keep. */
  note: string;
  /** BEFORE THE RESORTS (v1): a map is one piste down a face of one fall
   * line's profile (R2–R24), no lifts and no other run on it — and, being
   * from before the grades and the turned face too, it is built on the
   * rule book's own numbers (the UNGRADED row of `grades.ts`, whatever
   * grade it is asked for: no grade dealt, no drop laid, no `Level.grade`
   * published) down a face due north (no `Level.sun.facing`). The trick
   * maps and the benchmark stand on it. From the resorts on every map is a ski area
   * (R25–R28) raced on one course of it. */
  singlePiste?: boolean;
};

/** Every version the generator can still build, oldest first.
 *
 * The last row is the rules as they stand in this tree; everything above it
 * is a fossil, alive only because a campaign map still names it. */
export const GENERATOR_VERSIONS: readonly GeneratorTraits[] = [
  {
    version: 1,
    note:
      "The generator as Fall Line launched with it (R1–R22): one ungraded piste down one " +
      "face, the fall line due north. v4 builds every map as a whole ski area — a massif, " +
      "its lifts, a network of runs each built to a PISTE GRADE (R23) with the drops " +
      "across a black (R24), the face turned to the sun (R15) and transport lanes merging " +
      "down to a village (R25–R28) — raced on one course down it; this row builds one " +
      "piste on the ungraded rules with the face due north.",
    singlePiste: true,
  },
  {
    version: 4,
    note:
      "The resorts with their stations: every map a ski area on one massif — its lifts, " +
      "its runs of every colour and its transport lanes merging down to the village " +
      "(R25–R27) — raced on one COURSE down that network (R28), the woods thick low down " +
      "and thinning through the ecotone to the tree line (R14); every gondola's and " +
      "chair's top stands on a level pad cut into the slope, its downhill edge a lip onto " +
      "the face and a chair's unload ramp on it, every station stands beside the runs, " +
      "never on one, and no drag lift crosses a piste (R26).",
  },
];

/** What a map is built by unless something pins it to an older set of
 * rules. Every entry point that is not a campaign map lands here. */
export const CURRENT_GENERATOR_VERSION: GeneratorVersion =
  GENERATOR_VERSIONS[GENERATOR_VERSIONS.length - 1].version;

/** The versions this build can still be asked for — the check a campaign
 * map's row is held to, and the list a test walks. */
export const GENERATOR_VERSION_IDS: readonly GeneratorVersion[] = GENERATOR_VERSIONS.map(
  (row) => row.version,
);

export function isGeneratorVersion(value: unknown): value is GeneratorVersion {
  return typeof value === "number" && GENERATOR_VERSION_IDS.includes(value);
}

/** The rules a version builds by. A version this build has never heard of —
 * a stale link, a save from a tree where the row still existed — is the
 * CURRENT one rather than an error: the map will not be the one that save
 * remembers, and there is no version of this code that could make it be. */
export function generatorTraits(version: GeneratorVersion | undefined): GeneratorTraits {
  return (
    GENERATOR_VERSIONS.find((row) => row.version === version) ??
    GENERATOR_VERSIONS[GENERATOR_VERSIONS.length - 1]
  );
}
