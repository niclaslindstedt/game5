---
type: Changed
---

The ground is cheaper to draw on phones. Its shader no longer throws pixels away to hide where two rings of the mountain's mesh overlap; the coarser ring now tucks under the finer one instead, so a phone's GPU can skip every pixel of the mountain hidden behind a nearer one. The snow inside a room or a dug pit is still cut away, by a second version of the shader used only while one stands. The ground's mesh also reads sixteen fewer heights a vertex. The picture is unchanged, and the benchmark's breakdown now counts the ground's triangles as drawn rather than twice over.
