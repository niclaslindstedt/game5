<!-- Title must be a conventional-commit subject (it becomes the squash
     commit on main): feat(engine): let the skis float on deep powder -->

## What & why

<!-- What changes, and what it does for the player or the project. -->

## Linked issue

<!-- Closes #… (if any). -->

## Test plan

<!-- How you verified it: commands run, scenarios ridden, screenshots for
     visual changes. For ski / snow / generator changes paste the
     `make sim` table BEFORE and AFTER, and the `make ride` / `make level`
     pictures where they apply. -->

## Checklist

- [ ] `make test`, `make lint`, `make fmt-check` pass locally
- [ ] Tests added/updated for behavior changes
- [ ] `make sim` before/after included (ski, snow or generator changes)
- [ ] Changeset fragment in `.changes/unreleased/` (or `no-changelog` applies)
- [ ] Docs updated per AGENTS.md → Documentation sync points
- [ ] PR title is a conventional-commit subject
