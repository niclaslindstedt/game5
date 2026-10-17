---
token: PDD-09
version: 1
title: A change is judged by its lab, before and after
source: OSS_GAME_SPEC §32.1; AGENTS.md "The labs"
---

## Rule

A change in a lab's subject runs that lab before and after and puts both in the PR. A new visual feature gets a screenshot lab to iterate in and is checked against real-world references before it is called done.

## Why

This game is tuned by measuring and looking; a description of a picture is not the picture, and a number without its before has no meaning.

## Prevents

Changes that read well in a diff and look or ski wrong in the game, and regressions nobody can see because no before was kept.

## Exceptions

A change with no lab in its subject, which says so in its PR.

## History

- v1 (2026-10-17): adopted from §32.1 and the review practice of asking every visual feature for a lab.
