---
name: eval-labs
description: "Use when the owner wants SEVERAL COMPETING IMPLEMENTATIONS of one goal (a player model, an effect, a building, a UI) and a judged winner: five agents build the same request five different ways, each in its own screenshot lab on shared scenes, a fresh judge ranks them side by side on one page, and the owner decides what merges or which style goes to another round. Owns the round's setup, the briefs, the output folder, the judging and the rules between rounds."
---

# Eval labs: five builds, one judge, the owner decides

An EVAL LAB is a contest over one goal. Five agents build it five clearly
different ways, each iterating its own build in a screenshot lab against the
SAME scenes; a sixth agent that built none of them judges all five; the
owner reads the verdict and decides. Nothing about the build itself lives
here — each candidate loads the skill that owns its subject (`skier`,
`skier-gear`, `buildings`, `visual-effects`, `blender-assets`, …) and the
lab rules of `lab-tooling`. This skill owns only the contest around them.

## Round setup

1. **The goal is the owner's request, verbatim.** Write down its hard
   requirements beside it (it reuses the existing animations, it is based
   on real references, it holds a frame budget, …) — the judge scores
   against those.
2. **Pick five clearly different approaches** — a style, a reference set or
   a technique each. Each agent gets ONE approach and is told the other
   four exist, so it does not drift toward them.
3. **Start five separate agents (threads), never reusing one.** Each brief
   carries:
   - the goal verbatim and its hard requirements;
   - its approach;
   - research its own real-world references online (studied, never
     committed or named — the router's rules on references hold);
   - build a screenshot eval lab with FIXED SHARED SCENES — the same
     scenes, cameras and moments for all five — and iterate in it until it
     reads;
   - post work-in-progress screenshots as it goes, as attachments or a
     published gallery page, never as bare file paths;
   - write to the shared folder under
     `eval-labs/<goal>/round<N>/<n-approach>/`: `SUMMARY.md` (the PR, the
     best shots, the method, the cost, the gaps) and `LESSONS.md` (what
     worked, what did not, pipeline tips, pitfalls);
   - open a PR, get its CI green, and do NOT merge or close it.
4. **Save the round's plan** — the threads, their PRs, the folders — to the
   project's memory, so a later session can find it cold.

## Judging

5. **When all five have reported, start a NEW, independent judge.** It:
   - reads every `SUMMARY.md` and `LESSONS.md`;
   - checks out each PR and renders the shared scenes ITSELF, never
     trusting a candidate's own pictures alone;
   - scores against the hard requirements: realism against the references,
     quality, compliance, integration with the game, cost (frame, size,
     triangles), CI;
   - publishes ONE page showing every candidate's work side by side on the
     same scenes;
   - reports the winner and a ranked list with one reason each;
   - never merges, closes or comments on a candidate's PR.
6. **Post the winner and the page's link to the owner.**

## The owner decides

7. The owner has the last word: merge a PR, or take a style into another
   round.
8. **Another round** is five NEW agents on the chosen style, each a
   different variant or reference set, briefed with ALL earlier
   `LESSONS.md`, `SUMMARY.md` and judges' verdicts, and the last judge's
   weak spots named as the round's targets. Then a NEW judge. Round 3, 4
   and on run the same way.

## Rules

- Nothing merges or closes until the owner picks.
- Fresh agents and a fresh judge every round; a judge never judged work it
  built.
- The same eval scenes across every candidate in a round.
- Drive anything animated (cloth, wind, flags, a cycle of the pose) off a
  clock the lab can advance, so a still screenshot shows the motion at a
  chosen moment instead of whatever the wall clock caught.
- A losing candidate's lesson that would help the winner is named in the
  verdict, so it can be carried over when the winner merges.
