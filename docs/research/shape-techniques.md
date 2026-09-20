# Procedural shape families and real-time deformation at 135 px

What form families a small overlay creature can be built from, how to
deform them cheaply, and where TresJS helps versus gets in the way.

Markers: **[CODE]** read from installed source under `node_modules/`.
**[BENCH]** measured here on Node 26.2 / M4 Pro, pure JS, no GPU — derate
by a speculative 2–4× for a Windows PC under Dota + x264 (**[LORE]**).
**[MATH]** standard formula. **[WEB]** vendor source, OBS/CEF build files
or npm tarballs read by a research pass. **[LORE]** untested. Installed:
`three@0.186.0`, `@tresjs/core@5.9.0`, `@tresjs/cientos@5.9.0`,
`three-custom-shader-material@6.4.0` (transitive via cientos), `gsap`;
**no** post-processing package. **[CODE]**

---

## 1. Shape families

| family | constructor | free params | animates |
| --- | --- | --- | --- |
| superquadric | none — build on a grid | `ε1, ε2`, 3 radii | **smooth** |
| supershape | `<Superformula>` **[CODE]** | `n1,n2,n3` ×2; `m` ×2 | **smooth** in `n`, **pops** in `m` |
| torus | `TorusGeometry` | radius, tube | **smooth** |
| torus knot | `TorusKnotGeometry` | radius, tube; `p,q` | **pops** in `p,q` (integers) |
| capsule | `CapsuleGeometry` | radius, length | **smooth** (length→0 = sphere) |
| rounded box | `RoundedBoxGeometry`, `<RoundedBox>` | size, corner radius | smooth but **rebuilds** |
| metaballs | `MarchingCubes`, `<MarchingCubes>` **[CODE]** | ball pos/strength/subtract | **smooth, incl. topology** |
| convex hull | `ConvexGeometry` | a point set | **pops** unless points pinned to a sphere |
| lathe / loft | `LatheGeometry`, `LoftGeometry` | profile, `phiLength`, sections | **smooth** |
| L-system | hand-rolled | depth (**pops**), angle, ratio | mixed |

**Superquadric** **[MATH]**, signed powers `c(θ,ε)=sign(cos θ)|cos θ|^ε`
and `s(θ,ε)=sign(sin θ)|sin θ|^ε`, `η ∈ [−π/2,π/2]`, `ω ∈ [−π,π]`:

```
x = a · c(η, ε1) · c(ω, ε2)
y = b · c(η, ε1) · s(ω, ε2)
z = c · s(η, ε1)
```

`1,1` ellipsoid · `→0,→0` box · `1,→0` cylinder · `2,2` octahedron ·
`>2` concave, pinched, star. Uniform (η,ω) sampling bunches vertices near
ε→0, so corners go faceted — sample denser, or own the look.

**Supershape** **[MATH]**
`r(φ) = ( |cos(mφ/4)/a|^n2 + |sin(mφ/4)/b|^n3 )^(−1/n1)`; the 3D form is
the spherical product of two such curves. **cientos already ships it**
**[CODE]**: `numArmsA` (= m), `expA` = `[n1,n2,n3]`, `numArmsB`, `expB`,
`widthSegments`/`heightSegments` (32×32), `color`. It hardcodes
`a = b = 1`, builds the grid once and **writes positions in place** on
exponent change; default material `MeshBasicMaterial`, replaceable via
the slot. `n1,n2,n3` cover sphere, gear, starfish, spike-ball, pinched
blob, rounded cube. `m` pops: non-integer `m` leaves the curve unclosed
after 2π while the grid still wraps its indices, so a crease sweeps the
body. **Highest value-per-effort: one component, already in the tree.**

- **Torus** earns its line because **it has a hole** — a
  low-spatial-frequency silhouette feature that survives downscale and
  compression (`shape-motion-perception.md`), and the cheapest way to
  stop looking like a ball. Knot `p,q` are topology, not a channel.
- **Metaballs.** Field is a `Float32Array(res³)` **[CODE]**. cientos
  `<MarchingCubes>` takes `resolution` (28), `maxPolyCount`, `enableUvs`,
  `enableColors`, and runs `update(); reset();` **unconditionally** in
  `onBeforeRender` — no dirty gate. Each `<MarchingCube>` child reads
  **its own world position** per frame and calls `addBall(...)`, so the
  field animates via ordinary `<TresGroup>` transforms. **The only family
  where a topology change is itself smooth.** Cost **[BENCH]**, 4 balls:
  res 16 → 0.039 ms · 24 → 0.131 · 28 → 0.187 · 32 → 0.284 · 48 → 0.998
  · 64 → 2.320. `O(res³)`; stay ≤32. Re-uploads the whole vertex buffer
  per frame; visibly stepped at low res **[LORE]**.
- **Convex hull.** Rebuild is cheap — **0.027–0.039 ms for 24–120
  points** **[BENCH]** — but moving points does *not* give a continuous
  surface: face combinatorics jump when a point crosses the boundary.
  **Recipe: pin every point to a sphere, drive only radii.**
- **Lathe / loft.** `phiLength < 2π` opens the body into a shell, then
  single-sided, so use `side: DoubleSide`: opaque, crisp, no alpha.
  **`LoftGeometry` is new in 0.186** **[CODE]**: equal-count sections
  free to change shape, size and orientation — a build-time FFD for a
  worm whose section goes circle → star.
- **Subdivision.** three ships **no** Catmull-Clark or Loop subdivider;
  `addons/modifiers` has only `Simplify`, `Tessellate`, `EdgeSplit`,
  `Curve` **[CODE]**. Skip it — though `TessellateModifier` helps **once
  at build time**, giving a shatter more vertices.
- **L-systems.** Depth pops; the standard fix is to grow the newest
  generation from zero length. `milestones` maps onto depth almost
  perfectly. Highest authoring effort here. (Also available:
  `ParametricGeometry` for any `(u,v) → xyz`, and `PolyhedronGeometry`'s
  `detail` — **integer, pops** — used by the current visuals.)

---

## 2. Deformation techniques

**All of these work on Chromium 127** (they need only WebGL2), and none
rebuilds geometry per frame except **implicit remeshing (marching cubes,
§1)**, at 0.19 ms at res 28. Costs below are per frame at our size.

- **CPU per-vertex** (what `VisualAngular.vue` does). **[BENCH]**
  ms/frame: icosa detail=3 (960 verts) loop **0.002**, its
  `computeVertexNormals()` **0.023**; superformula 32×32 loop **0.101**,
  normals **0.084**; 64×64 loop **0.370**, normals **0.355**. Write into
  `attr.array`, set `needsUpdate`. **`computeVertexNormals` costs 10× the
  displacement loop** — and is often deletable: under `#ifdef
  FLAT_SHADED`, three's `normal_fragment_begin` derives flat normals in
  the **fragment** shader from `dFdx/dFdy(vViewPosition)`, ignoring the
  `normal` attribute **[CODE]**.
- **Morph targets.** Set `mesh.morphTargetInfluences[i]`; three blends in
  the vertex shader from a `DataArrayTexture`. Requires **identical
  vertex count and order** across targets — always achievable from a
  shared grid. The right tool for "N canonical body shapes, continuously
  blended", and there is no cientos helper.
- **Skeletal skinning.** ~0 GPU cost, but authoring weights for a
  procedural blob is miserable and it deforms a **fixed** shape. Skip.
- **Vertex shaders — three routes.** (a) `ShaderMaterial` from scratch:
  total control, write your own lighting — given the flat opaque look,
  going fully unlit is legitimate. (b) `onBeforeCompile` injecting at
  `#include <begin_vertex>`, what cientos `MeshWobbleMaterial` does
  **[CODE]**: keeps three's lighting, fragile across version bumps. (c)
  **`three-custom-shader-material@6.4.0` — already in `node_modules`**
  via cientos, as `<CustomShaderMaterial :base-material :vertex-shader
  :uniforms>` **[CODE]**: write `csm_Position`, keep standard lighting.
  **Recommended.**
- **The shader gotcha:** the CPU never learns about GPU-side
  displacement, so bounding spheres go stale and **frustum culling can
  make the creature vanish near a screen edge**; with one object,
  `mesh.frustumCulled = false` fixes it free.
- **Noise.** `SimplexNoise` is in `addons/math` **[CODE]**; on the GPU
  you paste ~100 lines of GLSL. 3D simplex is ~20–40 ALU ops, curl needs
  3–6 evaluations — both free at 1–4k vertices. **The cheapest way to
  make any family above feel alive rather than mathematical.** Per
  `shape-motion-perception.md`: `arousal` → frequency and amplitude,
  `valence` → octave mix.
- **Lattice / FFD.** Nothing in three; for **one** creature a
  hand-written bend + twist + taper (three uniforms) buys ~90% of a
  general FFD at ~5% of the effort.
- **SDF raymarching.** One quad; all shape in the fragment shader. Cost
  is **pixels × steps**, and we have 18,225 px at dpr 1 — even 64 steps
  is ~1.2 M iterations/frame, nothing for a GPU that runs Dota. Buys
  `smin` blending (smooth topology change), exact silhouettes, no
  geometry, no rebuilds, one draw call. Costs: all GLSL, and the
  declarative layer does nothing for you.

**Tension with ADR-0003, settle before investing.** A raymarcher's output
is a **soft coverage mask** at the silhouette: thresholding
(`if (d > eps) discard;`) gives jagged edges at 135 px, smoothstepping
gives partial alpha. But **MSAA on the existing visuals already produces
partial alpha at edges**, so the real question is whether ADR-0003 bans
*large soft-alpha regions* or *any* fraction at all. **[LORE]**

---

## 3. What TresJS can and cannot do

- **Everything in `THREE.*` is available declaratively** via the
  catalogue; `useTres().extend({})` registers your own **[CODE]**.
- **`:args` changes are a full reconstruction.** Tres constructs a new
  instance and copies every writable property descriptor onto the
  existing node **[CODE]**. Identity survives, but you pay a construction
  and make garbage — at 0.06 ms per rebuild **[BENCH]**, **driving
  `:args` at 60 fps is a GC-pressure, not a throughput, decision.**
- **Custom `BufferGeometry`.** Declarative works, including `attach`
  (`<TresBufferAttribute attach="attributes-position" />`), and a
  `<TresBufferGeometry>` child's props go through `setAttribute(name, new
  BufferAttribute(...value))` **[CODE]**. But for anything mutated per
  frame, **build it imperatively in `setup` and bind `<TresMesh
  :geometry="geom">`** — stable identity, direct writes into
  `attr.array`, as cientos `Superformula` does.
- **Custom `ShaderMaterial`** works as `<TresShaderMaterial
  :vertex-shader :fragment-shader :uniforms>`. **This is where the
  declarative layer actually gets in the way:** per-frame uniform values
  must *not* be reactive — pass uniforms once, mutate
  `material.uniforms.uX.value` inside `useLoop().onBeforeRender`. A
  `computed` uniforms object defeats three's caching.
- **NodeMaterial / TSL / WebGPU.** `three/tsl` and `three/webgpu` exist
  in 0.186; Tres 5.9 types `RendererOptions.renderer?: (ctx) =>
  TresRenderer` (`WebGLRenderer | Renderer`) and exports
  `isWebGPURenderer` **[CODE]**, so `<TresCanvas :renderer="() => new
  WebGPURenderer(...)">` is supported and typed. It degrades safely: a
  `WebGLBackend` fallback catches both "no `navigator.gpu`" and "no
  adapter", and TSL compiles to GLSL ES 3.00 **[WEB]**. Caveats: the
  fallback is **async**; no storage buffers or subgroup nodes;
  `three.webgpu.js` is **2.28 MB vs 663 KB** **[CODE]**.
- **Post-processing.** `@tresjs/post-processing` is **not** installed,
  and it is largely what we do not want (extra full-canvas passes; most
  of the catalogue is glow). For a hard contour — likely the biggest
  readability win at 135 px — cientos ships **`<Outline>`, an
  inverted-hull shader** (`thickness`, `screenspace`, `color`) and
  `<Edges>` **[CODE]**: opaque, crisp, no extra pass.
- **Morph influences:** no helper; bind the prop, mutate in the loop.
  **Instancing:** `<Instances>`/`<Merged>` **[CODE]**, but we have ~2
  draw calls, so this is hygiene, not performance. **Marching cubes and
  Superformula: both have helpers** (§1) — the most directly useful
  discovery here. **Also** **[CODE]**: `<RoundedBox>`, `<Levioso>`,
  `<MeshWobbleMaterial>`, `<Tube>`, `<Sampler>`, `<Fit>`, `<StatsGl>`.

**Drop to imperative for:** per-frame attribute writes, `onBeforeCompile`,
per-frame uniform mutation, geometry whose identity must persist. That is
*most* of the interesting work — but the drop is local to a `useLoop`
callback inside a declarative component. **Not a constraint.**

---

## 4. Platform reality check (OBS / Chromium)

Corrections to the premises this research started from **[WEB]**:

- **OBS 33 is not released.** Current stable is **32.2.2, still CEF 6533
  / Chromium 127**. CEF 7871 / Chromium 150 exists only on master, and
  that change also migrates Alloy → Chrome runtime. **Plan for 127.**
- **WebGL is *not* killed by disabling browser hardware acceleration.**
  Per `obs-browser-source-perf.md` §1, that appends only
  `--disable-gpu-compositing`; the GPU process survives and WebGL stays
  GPU-rasterized — what changes is a full-surface readback per frame. The
  real hazards are the device blacklists (Windows Intel + multi-adapter;
  *any* Linux NVIDIA), multi-GPU laptops, and a dead GPU process falling
  back to SwiftShader — silent on 127, but on 150 **context creation
  fails outright** (fallback removed in Chrome 137).
- **WebGPU is probably dead in obs-browser on Windows.** Its D3D12
  backend needs `dxil.dll` + `dxcompiler.dll`; CEF ships them but
  **OBS's `cmake/windows/helpers.cmake` does not install them** — the
  same omission that breaks WebGPU in CefSharp and JCEF. Inference, not
  an empirical test.
- **Build target.** `OffscreenCanvas` and workers are fine on 127, but
  "Baseline 2024" needs Chrome 130 and "Baseline 2025" needs 141, so pin
  `chrome >= 127`. Sharpest trap: **`Float16Array` is Chrome 135**.

---

## 5. Alternative tools

**No** to five of them. **Raw three.js** buys nothing — Tres is thin and
you already drop to imperative inside a component. **PixiJS** costs a
second renderer, and if you abandon 3D, Canvas2D is enough. **Lottie**
only lets you seek a frame, so **one** axis maps to a timeline and a
second does not map at all. **Spine** has a free runtime but a **paid
editor**, and is built around named animations. **WebGPU / TSL** is nicer
shader authoring plus compute we do not need, for a 2.28 MB build
**[CODE]** that §4 says likely cannot initialise in OBS on Windows.

**SVG + GSAP.** No GPU, DOM-based, CPU-cheap at 135 px with a handful of
paths, exact control over edges (`shape-rendering`). Path morphing needs
matched point counts; GSAP's MorphSVG solves that but is a **paid Club
plugin**. The contract already has `kind: 'dom'` for this. **Real
candidate** — animate `transform` only (`obs-browser-source-perf.md` §3).

**Plain Canvas2D — the most underrated option here.** A per-frame
`beginPath()` over a superformula polar curve is ~30 lines: §1's
morphology in 2D, zero WebGL, perfect edge control, a cost rounding to
nothing at 135 px, immunity to every §4 hazard, and the natural fill for
the no-WebGL branch `BuddyStage.vue` probes for. **Consider one.**

### Rive

The one alternative deserving a real verdict; figures **measured from npm
tarballs at `@rive-app/*@2.42.2`** **[WEB]**.

**What it gets right.** State machines take continuous number inputs
natively: a **1D Blend State** mixes N timelines along one numeric axis,
and an **Additive Blend State** mixes over a base pose using **several
independent properties at once** — how you would express valence and
arousal together. From JS, grab `stateMachineInputs(name)` and assign
`.value`, or use the newer **data binding / View Models** layer, a typed
observable property graph (`vmi.number('valence').value = 0.4`) covering
colors, text and nested artboards. A better fit for a GSI-derived state
model than anything we would hand-roll. **But there is no 2D blend
space** — valence × arousal is two weighted pose layers, not bilinear.

Three things kill it, in descending severity:

1. **Antialiased partial alpha is inherent and cannot be turned off.**
   `@rive-app/canvas` fills paths through Canvas2D, which Chromium always
   antialiases with no disable switch, so every curved edge arrives in
   OBS as partially-transparent pixels. `@rive-app/webgl2` is worse: its
   context is `alpha: true, premultipliedAlpha: true` with analytic AA by
   design. The only mitigation is a per-frame readback and alpha
   threshold, which defeats the renderer. **Head-on with ADR-0003.**
2. **GUI-only authoring, and export needs a paid plan.** No programmatic
   authoring path exists; Rive's own codegen tool only *parses* files.
   The editor is free, but **exporting a runtime `.riv` needs the Cadet
   plan at $9/seat/month**, so the creature becomes an opaque binary in a
   repo where visuals are code-authored. (Pricing matrix plus third-party
   reporting — confirm.)
3. **~850 KB gzipped, almost all WASM** (53 KB JS + 795 KB WASM; `webgl2`
   53 + 894). By default the runtime **fetches `rive.wasm` from unpkg at
   load**, so an OBS scene load hits the network unless you self-host it
   via `RuntimeLoader.setWasmUrl()` or use the inlined `*-single` builds.

If adopted anyway, use `@rive-app/canvas` (or `canvas-advanced-single`:
23 KB JS, inlined WASM, manual frame control). **Verdict: no** — it
solves the continuous-parameter problem better than we will, and loses on
the constraint already load-bearing here.

---

## 6. Smooth morphing between forms

**Shared topology is the whole game.** Two forms generated from the same
`(u,v)` grid with the same vertex count and order lerp smoothly by
construction, morph targets do it on the GPU for free, and every
parametric family in §1 can be generated onto one common grid. So:
**define one canonical grid (say 48×24 = 1152 verts), express every form
as `(u,v,params) → xyz` on it, and lerp** — which makes each new form
~50 lines and continuous state a non-problem for most of the menu.

**What breaks: genus.** A sphere grid cannot become a torus — pinching
the waist to zero reads as a pinch, not a hole opening — nor grow a limb.
**For genuine topology change you need marching cubes or an SDF.** **SDF
blending (smooth minimum)**, `k` the blend radius, merges two primitives
into one body continuously — the clean way to split and rejoin, and the
same idea underlies the marching-cubes field.

```glsl
float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}
```

- **Superformula `m`.** `n1/n2/n3` lerp smoothly; `m` does not (§1). Pick
  2–4 values and cross-fade between two meshes. Opacity being off the
  table, **cross-fade by scale** — or hide the step inside an event
  flourish, where a discontinuity reads as a reaction.
- **Vertex correspondence.** For arbitrary meshes this is
  cross-parameterization, a research problem — **do not attempt it**, and
  never morph a `TorusGeometry` into an `IcosahedronGeometry`.
- **Normals pop even when positions do not**, making flat facets
  flicker. With `flatShading: true` this is free and derivative-based
  (§2); with smooth shading, **lerp the `normal` attribute**.

---

## 7. Performance

What costs anything inside the scene, ranked: **(1) marching cubes, and
only marching cubes** — `O(res³)`, 0.19 ms at 28 up to 2.3 at 64
**[BENCH]**, plus a full vertex-buffer re-upload and allocation every
frame; **(2) `computeVertexNormals`**, 10× the displacement loop it
follows and often deletable outright (§2); **(3) GC pressure from
per-frame allocation** — not measurable in ms, but a `new Float32Array`
each frame produces collection pauses that read as stutter, which is more
real than any throughput number here; **(4) geometry rebuilds via
`:args`**, 0.06 ms each and relevant only as item 3.

**Where the limits are not:** draw calls (we have 1–5; the threshold is
in the hundreds); fill rate (18,225 px at dpr 1 — you could afford a
genuinely expensive fragment shader, which is why raymarching is viable);
shader complexity, same reason; vertex counts below ~4k.

**The real limits are outside the scene.** Per
`obs-browser-source-perf.md` §3 the dominant costs — software rendering,
surface area × frame rate, `backdrop-filter`, layer count — all live
above the canvas. **At 135 px the budget is perceptual, not
computational.** Spend it on silhouette distinctiveness.

---

## Recommended for this project

Eight combinations that should each read as a genuinely different
creature. Effort is rough, and **[LORE]**.

1. **Supershape body — `<Superformula>`, exponents from affect.** `n2/n3`
   from valence (round ↔ spiked), `n1` plus noise from arousal. Already
   installed; keep `m` fixed per preset. *~1 day.* **Start here.**
2. **Metaball colony — `<MarchingCubes :resolution="28">`, 3–5
   `<MarchingCube>` children on animated orbits.** Arousal pulls the
   balls apart until the body splits; calm merges them. The only option
   that makes topology change itself expressive. *~1 day.*
3. **Ring — a torus, with a hole in the silhouette.** Continuous
   `radius`/`tube`, twisted by a vertex shader via
   `<CustomShaderMaterial>`. Lowest spatial frequency here, so it should
   survive downscale best. *~0.5 day.*
4. **Segmented worm — `LoftGeometry`, or instanced capsules along a
   `<CatmullRomCurve3>` spine.** Arousal drives a wave down the spine,
   valence the cross-section roundness. A different body plan, and motion
   is our strongest animacy cue. *~1.5 days.*
5. **Crystal — `ConvexGeometry` over points pinned to a sphere, radii
   from valence.** Flat shading plus cientos `<Outline>`; combinatorics
   stay stable, so it animates smoothly. The angular/threat pole. *~1 day.*
6. **Canvas2D superformula — `kind: 'dom'`, no WebGL at all.** The #1
   polar curve filled as a 2D path. Crispest possible edges, no shader,
   immune to every hazard in §4. *~0.5 day.* Cheapest and most robust.
7. **Shared-grid morpher — one 48×24 grid, four superquadric form
   functions, GPU morph targets.** Infrastructure, not a visual: after
   it, a new form is ~50 lines and morphing is free. *~2 days.*
8. **SDF raymarch blob — one quad, `smin` over 2–3 primitives, curl
   noise.** Highest ceiling and highest risk — all GLSL, and the
   silhouette-AA versus ADR-0003 question (§2) must be settled first.
   *~2–3 days.*

**Not recommended:** skeletal skinning (wrong shape of problem),
subdivision (nothing ships), WebGPU/TSL (§4), Rive (§5), Lottie and Spine
(wrong input model or paid tooling).

**Free fix found while measuring:** `VisualAngular.vue` calls
`computeVertexNormals()` every frame while setting `flat-shading: true`.
Under `FLAT_SHADED` three derives normals in the fragment shader and
ignores the attribute **[CODE]**, so that call is ~0.023 ms/frame of pure
waste — delete it.
