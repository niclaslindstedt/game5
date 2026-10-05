---
title: A rider on a machine needs the machine's ladder, and a run that starts on it must cut, not fly
date: 2026-10-05
scope: pwa/src/game/camera-sled.ts, pwa/src/game/camera.ts, pwa/src/game/machines.ts
concepts: [camera, snowmobile, bolted, handover, lab]
---

"The camera is inside the snowmobile" was the skier's TIPS row (0.62 m under
his centre, 0.55 m ahead) bolted to a rider standing on the boards, which is
inside the hood. Rows sized for a body a metre tall cannot frame a machine
three metres long, so the snowmobile has its own ladder (`SLED_RIGS`) framed
off the machine as drawn (the lens on the same pose as the hood, so a bolted
lens never parts from it), and the lens flies from one ladder to the other
on getting on and off. The lab (`make sled ARGS=--sheet=lenses`) looked right
before the built app did: a ride begun on the boards flew in from the
skier's ladder on its first frame, and the app's shot lands inside that
flight. A change of ladder on a run's first frame must CUT. Judge it in the
app too (`screenshots --surface sled --camera tips --video low` — the default
tier draws no terrain in headless SwiftShader).
