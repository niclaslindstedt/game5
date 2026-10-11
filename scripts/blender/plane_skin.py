# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE TRACED SKIN the jump plane's builder (`plane.py`) lays its fuselage
# and its sliding door in: one parametric surface, sampled on rows, with
# every window, seam, doorway and livery line on it a FIELD whose zero
# contour is traced and laid into the mesh as constrained edges (a
# constrained Delaunay triangulation in the surface's own (station, angle)
# plane) — crisp outlines at any triangle budget, each region its own
# material slot (slot -1 a HOLE: no faces), the normals the surface's own so
# a coarse cut still shades smooth. The same method `heli.py` builds its
# cabin with, stated here apart so the plane's builder stays one subject;
# `heli.py` is left as it is (its model is stamped off its own text).

import math

import bpy
import numpy as np
from mathutils import Vector, geometry

import lib


def pchip(knots):
    """A monotone cubic through `knots` (x, y): no overshoot between them."""
    knots = sorted(knots)
    xs = np.array([k[0] for k in knots], float)
    ys = np.array([k[1] for k in knots], float)
    h, d = np.diff(xs), np.diff(ys) / np.diff(xs)
    m = np.zeros_like(ys)
    for i in range(1, len(xs) - 1):
        if d[i - 1] * d[i] > 0:
            w1, w2 = 2 * h[i] + h[i - 1], h[i] + 2 * h[i - 1]
            m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])

    def f(x):
        x = np.clip(np.asarray(x, float), xs[0], xs[-1])
        i = np.clip(np.searchsorted(xs, x) - 1, 0, len(xs) - 2)
        t = (x - xs[i]) / h[i]
        t2, t3 = t * t, t * t * t
        return ((2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i]
                + (3 * t2 - 2 * t3) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1])
    return f


def sstep(a, b, x):
    t = np.clip((np.asarray(x, float) - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def rint(fs, r):
    """The intersection of inside-positive fields, its corners rounded to `r`."""
    d = [r - f for f in fs]
    q = np.sqrt(sum(np.maximum(di, 0) ** 2 for di in d))
    return -(q + np.minimum(np.maximum.reduce(d), 0) - r)


def contours(F, ys, ths):
    """The zero contours of `F` (rows the stations `ys`, columns the angles
    `ths`, periodic) as polylines of (y, angle), each a marching square's
    crossings chained."""
    Nt = F.shape[1]
    Fp = np.concatenate([F, F[:, :1]], axis=1)
    thp = np.append(ths, 2 * math.pi)
    ins = Fp > 0
    A, B, C, D = ins[:-1, :-1], ins[:-1, 1:], ins[1:, 1:], ins[1:, :-1]
    code = A.astype(int) + 2 * B + 4 * C + 8 * D
    pts, segs = {}, []

    def key(e):
        return (e[0], e[1], e[2] % Nt) if e[0] == "v" else e

    def point(e):
        k = key(e)
        if k not in pts:
            kind, i, j = e
            if kind == "h":
                f0, f1 = Fp[i, j], Fp[i, j + 1]
                pts[k] = (ys[i], thp[j] + f0 / (f0 - f1) * (thp[j + 1] - thp[j]))
            else:
                f0, f1 = Fp[i, j], Fp[i + 1, j]
                pts[k] = (ys[i] + f0 / (f0 - f1) * (ys[i + 1] - ys[i]), thp[j])
        return k

    for i, j in np.argwhere((code > 0) & (code < 15)):
        corners = (A[i, j], B[i, j], C[i, j], D[i, j])
        edges = (("h", i, j), ("v", i, j + 1), ("h", i + 1, j), ("v", i, j))
        cut = [e for n, e in enumerate(edges) if corners[n] != corners[(n + 1) % 4]]
        if len(cut) == 2:
            pairs = [cut]
        elif corners[0] == (Fp[i:i + 2, j:j + 2].mean() > 0):
            pairs = [(edges[0], edges[1]), (edges[2], edges[3])]
        else:
            pairs = [(edges[3], edges[0]), (edges[1], edges[2])]
        for e0, e1 in pairs:
            segs.append((point(e0), point(e1)))
    adj = {}
    for n, (e0, e1) in enumerate(segs):
        adj.setdefault(e0, []).append(n)
        adj.setdefault(e1, []).append(n)
    used = [False] * len(segs)
    lines = []
    for n0 in range(len(segs)):
        if used[n0]:
            continue
        used[n0] = True
        chain = list(segs[n0])
        for _ in (0, 1):
            while True:
                nxt = [m for m in adj[chain[-1]] if not used[m]]
                if not nxt:
                    break
                used[nxt[0]] = True
                e0, e1 = segs[nxt[0]]
                chain.append(e1 if e0 == chain[-1] else e0)
            chain.reverse()
        lines.append([pts[k] for k in chain])
    return lines


def split_seam(poly):
    """A polyline cut where it crosses the angle's seam (the belly's centre
    line), each piece ended on the seam."""
    out, cur = [], [poly[0]]
    for p, q in zip(poly, poly[1:]):
        if abs(q[1] - p[1]) > math.pi:
            qu = q[1] + (2 * math.pi if q[1] < p[1] else -2 * math.pi)
            edge_ = 2 * math.pi if qu > p[1] else 0.0
            yb = p[0] + (edge_ - p[1]) / (qu - p[1]) * (q[0] - p[0])
            cur.append((yb, edge_))
            out.append(cur)
            cur = [(yb, 2 * math.pi - edge_), q]
        else:
            cur.append(q)
    out.append(cur)
    return out


def simplify(pts, tol, seg, rad):
    """Douglas-Peucker to `tol` m, then no span longer than `seg` m (the
    angle measured as an arc of the radius `rad(y)`)."""
    P = np.array([(p[0], p[1] * rad(p[0])) for p in pts])
    keep = np.zeros(len(P), bool)
    keep[0] = keep[-1] = True
    stack = [(0, len(P) - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        ab, rel = P[j] - P[i], P[i + 1:j] - P[i]
        L = math.hypot(*ab)
        dist = (np.hypot(rel[:, 0], rel[:, 1]) if L < 1e-12
                else np.abs(ab[0] * rel[:, 1] - ab[1] * rel[:, 0]) / L)
        k = int(np.argmax(dist))
        if dist[k] > tol:
            keep[i + 1 + k] = True
            stack += [(i, i + 1 + k), (i + 1 + k, j)]
    kept = P[keep]
    out = [kept[0]]
    for a, b in zip(kept, kept[1:]):
        n = max(1, math.ceil(math.hypot(*(b - a)) / seg))
        out += [a + (b - a) * (k / n) for k in range(1, n + 1)]
    return out


def normals_of(skin, y, th, eps=1e-4):
    """The surface's outward normals at (y, th), its ends' poles along y."""
    a = np.stack(skin(y + 0 * th, th + eps)) - np.stack(skin(y + 0 * th, th - eps))
    b = np.stack(skin(y + eps, th)) - np.stack(skin(y - eps, th))
    n = np.cross(b.T, a.T)
    length = np.linalg.norm(n, axis=1)
    pole = length < 1e-10
    n[pole] = np.where((y[pole] > np.median(y))[:, None], [0, 1, 0], [0, -1, 0])
    length[pole] = 1
    return n / length[:, None]


def trace(name, skin, regions, y0, y1, rows, Q, mats, r0=0.7, fine=0.006, angles=1024,
          offset=0.0, rad=None):
    """The surface `skin(y, th)` from station `y0` to `y1` as one mesh: the
    rows at the stations `rows` (each ring as fine as `Q["sp"]` m), every
    outline of `regions(X, Y, Z)` — a list of (slot, priority, field) —
    laid in as constrained edges, every triangle given the slot of its
    highest positive field (slot 0 where none is; -1 is left out), every
    vertex the surface's own normal, the whole pushed `offset` m out along
    it (a panel standing proud of the skin). The triangulation's plane
    measures the angle as an arc of `rad(y)` (the section's own size; `r0`
    everywhere when none is given), so a triangle there is about the
    shape it is on the skin even where the section shrinks to a point."""
    if rad is None:
        rad = lambda y: r0 + 0 * np.asarray(y, float)
    ys = np.arange(y0, y1 + 1e-9, fine)
    ths = np.linspace(0, 2 * math.pi, angles, endpoint=False)
    X, Y, Z = skin(ys[:, None], ths[None, :])
    polys = []
    for _, _, F in regions(X, Y, Z):
        for line in contours(F, ys, ths):
            for piece in split_seam(line):
                if len(piece) > 2 or (len(piece) == 2 and piece[0] != piece[1]):
                    polys.append(simplify(piece, Q["tol"], Q["seg"], rad))
    verts = []
    for yr in rows:
        t = np.linspace(0, 2 * math.pi, 73)
        x, _, z = skin(np.full_like(t, yr), t)
        perim = float(np.sum(np.hypot(np.diff(x), np.diff(z))))
        n = max(8, math.ceil(perim / Q["sp"]))
        R = float(rad(yr))
        verts += [Vector((yr, 2 * math.pi * k / n * R)) for k in range(n + 1)]
    edges = []
    for p in polys:
        base = len(verts)
        verts += [Vector((float(q[0]), float(q[1]))) for q in p]
        edges += [(base + k, base + k + 1) for k in range(len(p) - 1)]
    out_v, _, out_f, *_ = geometry.delaunay_2d_cdt(verts, edges, [], 0, 1e-6)

    py = np.array([v.x for v in out_v])
    pt = np.array([v.y for v in out_v]) / rad(py)
    x, _, z = skin(py, pt)
    p3 = np.stack([x, np.broadcast_to(py, x.shape), z], axis=1)
    nrm = normals_of(skin, py, pt)
    p3 = p3 + nrm * offset
    index, merged, first, remap = {}, [], [], []
    for n, p in enumerate(p3):
        k = tuple(np.round(p * 2e4).astype(int))
        if k not in index:
            index[k] = len(merged)
            merged.append(p)
            first.append(n)
        remap.append(index[k])
    faces, cy, ct = [], [], []
    for f in out_f:
        a, b, c = f
        cross = (py[b] - py[a]) * (pt[c] - pt[a]) - (pt[b] - pt[a]) * (py[c] - py[a])
        tri = [remap[a], remap[b], remap[c]] if cross > 0 else [remap[a], remap[c], remap[b]]
        if len(set(tri)) < 3:
            continue
        faces.append(tri)
        cy.append((py[a] + py[b] + py[c]) / 3)
        ct.append((pt[a] + pt[b] + pt[c]) / 3)
    cx, cyy, cz = skin(np.array(cy), np.array(ct))
    slot = np.zeros(len(faces), int)
    best = np.full(len(faces), -1e9)
    for s, prio, F in regions(cx, cyy, cz):
        win = (F > 0) & (prio > best)
        slot[win], best[win] = s, prio
    keep = slot >= 0
    faces = [f for f, k in zip(faces, keep) if k]
    slot = slot[keep]
    used = sorted({v for f in faces for v in f})
    renum = {v: i for i, v in enumerate(used)}
    faces = [[renum[v] for v in f] for f in faces]
    first = np.array(first)[used]
    normals = nrm[first]
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(merged[v]) for v in used], [], faces)
    for m in mats:
        me.materials.append(m)
    me.polygons.foreach_set("material_index", slot.tolist())
    me.polygons.foreach_set("use_smooth", [True] * len(faces))
    me.update()
    me.normals_split_custom_set_from_vertices([tuple(n) for n in normals])
    return lib.link(bpy.data.objects.new(name, me))
