---
title: A wait loop on `pgrep -f <script>` never ends, and `pkill -f chrome` kills the shell that ran it — watch a PID or a file
date: 2026-10-05
concepts: [tooling, probes, shell]
---

`until ! pgrep -f previews/perf/x.mjs; do sleep 3; done` matches its OWN command line, which holds the pattern, so the loop never exits; four such monitors sat waiting on a probe that had already finished. `pkill -f chrome` likewise matched the bash command it was typed in and killed it (exit 144) before the next command ran. Wait on the probe's PID (`kill -0 $pid`) or on the file it writes, and stop a browser by the PID its driver printed. And never pipe a long probe through `| tail`: nothing prints until the probe exits, and a probe killed on a timeout prints nothing at all. Append to a log file as you go instead.
