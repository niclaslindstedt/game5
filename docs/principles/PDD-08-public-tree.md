---
token: PDD-08
version: 1
title: Everything in the tree is written for a stranger
source: AGENTS.md "How work is done here"
---

## Rule

Code, comments, docs, skills, lessons, fragments, commits and PR text contain nothing private: no personal details, ids, tokens, home paths, remarks about a person, or context that only makes sense inside one conversation. Identifiers come from the environment. Research is restated as facts and numbers in our own words.

## Why

The repository is public; anyone can read every line.

## Prevents

Leaked credentials and identifiers, and text that is meaningless or embarrassing to the next reader.

## Exceptions

The published app's own identity in `pwa/src/identity.ts`.

## History

- v1 (2026-10-17): adopted from the repository's public-tree rules.
