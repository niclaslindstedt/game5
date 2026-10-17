# Principles

The rules that hold in every task in this repository, one file each, after [Principle Driven Development](https://principledriven.dev/). [`AGENTS.md`](../../AGENTS.md#principles) indexes them at its top so every session reads them first; [`OSS_GAME_SPEC.md`](../../OSS_GAME_SPEC.md) stays the full specification, and a principle names the section or test it comes from rather than restating the spec.

## A principle file

`PDD-NN-<slug>.md`, with front matter (`token`, `version`, `title`, `source`) and five sections in this order:

- **Rule**: the required choice, first, in a few sentences.
- **Why**: the outcome it protects.
- **Prevents**: the costly failure it exists to stop.
- **Exceptions**: where it does not apply, or "None".
- **History**: one line a version, the newest last.

## Citing one

Code, a test or a doc that depends on a principle cites its token at its current version where the dependency is: `// PDD-01@v1: the grimbear draws off a stream of its own.` A citation is a promise that the code was checked against that version of the rule.

## Changing one

A change of WORDING keeps the version. A change of MEANING bumps it (`version: 2`, a History line, the index in `AGENTS.md`), and `tests/principles_test.ts` then fails on every citation still pinned to the old version. Each is re-checked against the new rule and its pin moved — that list is the point of versioning.

## Adding one

A principle is earned: a rule already enforced by a test, or a correction made in review more than once. `skill-reflection` proposes one when a lesson keeps recurring across skills. Keep the list short; a rule that belongs to one subject is that subject's skill, not a principle.

`tests/principles_test.ts` holds the files' shape, the index in `AGENTS.md`, and every citation in the tree.
