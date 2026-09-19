# OBS Browser Source performance for a WebGL/TresJS stream overlay

Research date: 2026-09-19. Target: Nuxt + TresJS overlay in OBS Browser Source on the same machine
that runs Dota 2 and the encoder. **Source tiers:** **[FACT-CODE]** = read from obs-browser /
obs-studio source at `master`; **[FACT-DOC]** = OBS official docs/blog/KB, CEF API docs,
Khronos/Chromium official; **[COMMUNITY]** = forum/issue reports, not maintainer-confirmed — treat
as hypothesis.

Versions at time of writing: latest stable **OBS 32.2.2** (2026-08-14). OBS 31 and 32 ship
**CEF 127 / Chromium 127** ([31.0 release notes](https://obsproject.com/blog/obs-studio-31-0-release-notes)).
CEF **150 / Chromium 150** is merged for **OBS 33.0**
([obs-studio#13900](https://github.com/obsproject/obs-studio/pull/13900),
[obs-browser#523](https://github.com/obsproject/obs-browser/pull/523)). That version jump
matters — see §7.

## 1. Hardware-accelerated WebGL: yes, conditionally

**[FACT-CODE]** Two render paths exist, selected by the global `BrowserHWAccel` setting
(Settings → Advanced → *Enable Browser Source Hardware Acceleration*, default **on**), in
`obs-browser-plugin.cpp` / `browser-client.cpp`:

- **Shared-texture path** (`hwaccel == true`): `windowInfo.shared_texture_enabled = true`; CEF
  hands OBS a GPU texture handle via `OnAcceleratedPaint` — NT shared handle (Windows),
  `IOSurface` (macOS), DMA-BUF (Linux). **Zero CPU copy**, and it early-outs when the handle is
  unchanged (`if (shared_handle == bs->last_handle) return;`).
- **Software path** (`hwaccel == false` or unsupported): `OnPaint` gets a CPU BGRA buffer and does
  `gs_texture_set_image(bs->texture, buffer, width * 4, false)` — **a full-surface upload every
  frame**. The CEF dirty-`RectList` argument is *ignored*.

**Conditions for the hardware path** [FACT-CODE, `check_hwaccel_support()`]: build defines
`ENABLE_BROWSER_SHARED_TEXTURE` (true for official Win/macOS/Linux builds);
`gs_shared_texture_available()` succeeds (Windows) / all DRM formats supported (Linux); Windows
device blacklist `Intel`, `Microsoft`, `Radeon HD 8850M`, `Radeon HD 7660` applied when
`adapterCount >= 2 || !is_intel(deviceId)`; on Linux **any** driver whose `GL_VERSION` contains
`NVIDIA` is blacklisted outright. OBS and `obs-browser-page` must be on the **same GPU adapter** —
the multi-GPU laptop case is the documented failure
([OBS Wiki: Laptop Troubleshooting](https://obsproject.com/wiki/Laptop-Troubleshooting)).

**Correction to a widespread community belief.** Turning off browser hardware acceleration does
**not** pass `--disable-gpu`. [FACT-CODE, `browser-app.cpp` `OnBeforeCommandLineProcessing`] the
only GPU-related switch added is `disable-gpu-compositing`, and only
`if (!shared_texture_available && !enableGPU && type.empty())`. So the Chromium **GPU process
still exists and WebGL is still GPU-rasterized**; what is disabled is GPU *compositing* of the
final surface, which forces the readback-to-CPU `OnPaint` path. The rest of the appended switches:
`disable-blink-features=DocumentPictureInPictureAPI`, `autoplay-policy=no-user-gesture-required`,
`disable-extensions`, `hide-crash-restore-bubble`, a `disable-features=…` list, plus
`use-mock-keychain` (macOS) / `ozone-platform` (Linux). Notably **absent**:
`--disable-background-timer-throttling`, `--disable-renderer-backgrounding`,
`--enable-unsafe-swiftshader`.

**SwiftShader fallback.** [FACT-DOC] Chromium removed the automatic SwiftShader WebGL fallback in
**Chrome 137** ([Intent to Remove](https://groups.google.com/a/chromium.org/g/blink-dev/c/yhFguWS_3pM),
[Chromium docs](https://chromium.googlesource.com/chromium/src/+/main/docs/gpu/swiftshader.md));
after removal *"WebGL context creation will fail instead of falling back to SwiftShader."*
Chromium 127 (OBS 31/32) is **below** that, so today a WebGL page silently falls back to CPU
rasterization if the GPU path dies. On **OBS 33 (Chromium 150)** it will instead **fail to create
the context**. obs-browser passes no `--enable-unsafe-swiftshader`.

**Practical cost of software fallback:** no published OBS-specific benchmark exists. What *is*
derivable from the code is the per-frame upload (arithmetic, not a benchmark): 1920×1080×4 B =
**7.91 MiB/frame → ~497 MB/s at 60 fps** (plus CEF's own GPU→CPU readback) vs. 400×300×4 B =
**469 KiB/frame → ~28.8 MB/s**. ~17× difference.

## 2. How the FPS setting actually works

This is the most misunderstood part, and the code is unambiguous
([`obs-browser-source.cpp`](https://github.com/obsproject/obs-browser/blob/master/obs-browser-source.cpp)).
Two regimes, chosen by the **"Use custom frame rate"** checkbox (`fps_custom`, default `false`;
`fps` default 30, range 1–60, width/height range 1–8192):

### `fps_custom = false` (default) — OBS drives the browser, lock-step

Browser created with `external_begin_frame_enabled = true` and `windowless_frame_rate = 0`.
`BrowserSource::Tick()` (once per OBS video frame) sets `reset_frame = true`;
`BrowserSource::Render()` calls `SignalBeginFrame()` → `SendExternalBeginFrame()`. Consequences:

1. The browser produces **exactly one frame per OBS output frame**. Your page's rAF is driven by
   OBS's clock, not a free-running 60 Hz timer. Set OBS output to 60 fps → rAF ticks at 60 Hz.
2. `SignalBeginFrame()` is called from **`Render()`**, which only runs when the source is actually
   rendered in a visible scene/preview/projector. A source nobody renders gets **no begin-frames →
   rAF stops** ([obs-browser#307](https://github.com/obsproject/obs-browser/issues/307), open).
3. A source rendered in two places (program + Studio Mode preview + multiview) gets multiple
   `Render()` calls per frame. Only the first consumes `reset_frame`, so frame *production* stays
   1×, but OBS's GPU composite cost multiplies.

### `fps_custom = true` — CEF free-runs on its own timer

```cpp
cefBrowserSettings.windowless_frame_rate = fps;  // 1..60
```

[FACT-DOC, [CEF `cef_browser_settings_t`](https://cef-builds.spotifycdn.com/docs/150.0/structcef__browser__settings__t.html)]:
*"The maximum rate in frames per second (fps) that CefRenderHandler::OnPaint will be called for a
windowless browser. The actual fps may be lower if the browser cannot generate frames at the
requested rate. The minimum value is 1 and the default value is 30."*

This decouples browser rendering from OBS's tick → **beat frequency / judder** whenever
`fps != output fps`. It is the right knob only when you deliberately want *fewer* browser frames
than output frames (e.g. a 10 fps stats panel).

### The other three checkboxes

| Setting | Key | Behaviour [FACT-CODE] |
|---|---|---|
| Control audio via OBS | `reroute_audio` | `SetAudioMuted(true)` on the CEF browser + `obs_source_set_audio_active(source, true)`; audio is pulled into OBS's mixer instead of the OS device. No render-path effect. |
| Shutdown source when not visible | `shutdown` | `SetShowing(false)` calls `DestroyBrowser()` — the whole CEF browser is torn down and recreated on show. Reclaims all its memory. **Side effect: `obsSourceVisibleChanged` is never dispatched** (it's in the `else` branch). |
| Refresh browser when scene becomes active | `restart_when_active` | A page **reload** only. Does *not* destroy the browser or free the process. |

When `shutdown` is off and the source is hidden, obs-browser calls `CefBrowserHost::WasHidden(true)`
— the code comment says plainly *"This stops rendering"*. Note [obs-browser#412]: a source visible
in the **Studio Mode preview** counts as showing, so it never shuts down there.

**JS events** [FACT-DOC, [README](https://github.com/obsproject/obs-browser#available-events)]:
`obsSourceVisibleChanged` (`{visible}` — rendered anywhere: program, preview, projector, multiview,
properties dialog) and `obsSourceActiveChanged` (`{active}` — program/output path specifically).
`SetActive` does **not** call `WasHidden`, so it's a pure notification.

## 3. What costs the most — ranked

**No published, reproducible benchmark of an OBS browser-source overlay exists** — no maintainer
measurements, no reputable third-party suite. The ranking below derives from the obs-browser code
path plus general Chromium rendering behaviour. Reasoned, not measured; verify with §6.

1. **Software-rendering mode (hwaccel off/blacklisted)** — dominates everything else. Full-surface
   GPU→CPU readback plus full-surface CPU→GPU upload per frame (§1). Check this first.
2. **Surface area × frame rate** — the software upload is O(w·h) with dirty rects ignored
   [FACT-CODE]. In hardware mode this collapses to ~0 (handle passing), but the compositor still
   allocates and blends full-size layers. The biggest thing you control.
3. **`backdrop-filter` / large-radius `filter: blur()` over a big area** — a separate compositor
   pass reading back the area beneath, re-run every frame the content changes
   ([GPU Accelerated Compositing in Chrome](https://www.chromium.org/developers/design-documents/gpu-accelerated-compositing-in-chrome/)).
   For a full-screen edge effect, the likeliest hotspot after #1–2.
4. **Compositing-layer count / `will-change` on full-screen elements** — each layer costs roughly
   `w × h × DPR² × 4` bytes of VRAM plus per-frame management (~7.9 MiB full-screen at 1080p).
   Cheap if it only transforms, expensive if it repaints.
5. **WebGL draw calls / shader cost** — for a 400×300 TresJS scene with a few meshes and three
   lights, minor on any GPU that runs Dota 2. Not your bottleneck unless the canvas is large or
   you add post-processing.
6. **Large `box-shadow` / `text-shadow` spreads** — raster cost proportional to blurred area.
   [COMMUNITY] forum reports attribute roughly-doubled CPU vs. plain Chrome to
   glow/box-shadow/transparency
   ([thread](https://obsproject.com/forum/threads/browser-source-cpu-optimization.82406/)) — unverified.
7. **JS work per frame (GSAP, reactivity)** — matters only when it triggers layout/style recalc.
   Animating `transform`/`opacity` is cheap; `width`/`top`/`filter` is not.
8. **Plain DOM node count** — least significant at overlay scale.
9. **Large transparent areas *per se*** — see §4. Essentially free in hardware mode.

[COMMUNITY] Recurring unverified forum advice: strip dev-time livereload/HMR clients from overlays
(they poll and keep the renderer busy); static pages sit near 0–2% CPU, animated ones don't.

## 4. Full-screen transparent source vs. small source

**Does OBS composite the transparent area regardless? Yes.** [FACT-CODE, `BrowserSource::Render()`]
OBS draws the browser texture as a textured quad with
`gs_blend_function(GS_BLEND_ONE, GS_BLEND_INVSRCALPHA)` (premultiplied alpha) every frame the
source is visible; there is no empty-region skip. But one 1080p alpha-blended quad is trivial for
any GPU that runs Dota 2 — **that is not where the cost is.** The real costs scale with area and
live *inside CEF*:

- **Software mode:** strictly linear in `w·h`. 1920×1080 vs 400×300 is **17.3× the bytes per
  frame** (arithmetic from the `width * 4` stride upload, §1).
- **Hardware mode:** the per-frame handoff is ~free, but Chromium still allocates full-size layer
  textures and runs full-size compositor passes for any effect covering the area.

**One source or two?** Two sources — a small always-on canvas plus a full-screen effects source
**hidden between events** — is better, but only if the full-screen one is genuinely hidden: hiding
it stops `Render()` → no `SendExternalBeginFrame()` → **rAF stops and the renderer idles**
[FACT-CODE, corroborated by obs-browser#307]. Adding "Shutdown source when not visible" destroys
the browser outright, the strongest mitigation for §7's leak reports.

Costs of two sources: fixed per-browser overhead; **show latency** (a shutdown source must boot
Chromium and load the page — bad for a reactive kill-streak effect); cross-source state sync (you
have a WebSocket already). And `obsSourceVisibleChanged` **won't fire** when `shutdown` is on, so
it can't cue the animation.

**Middle ground:** one full-screen source, but keep the effects layer at `display: none` (not
`opacity: 0`) when idle so Chromium allocates no layer for it, and gate the 3D canvas's rAF (§5).

## 5. Reducing GPU contention with the game

### `power-preference="high-performance"` — this repo should change it

Current code: `app/components/BuddyScene.vue:12` → `<TresCanvas alpha power-preference="high-performance">`.

[FACT-DOC, [WebGL 1.0 spec](https://registry.khronos.org/webgl/specs/latest/1.0/)] `powerPreference`
*"Provides a hint to the user agent"*; *"this property is only a hint and a WebGL implementation
may choose to ignore it"*; *"This may influence which GPU is used in a system with multiple GPUs."*
It is a **GPU-selection hint, not a scheduling or priority knob** — it cannot make your context
preempt Dota 2, nor yield to it. The spec also warns implementations are *"very likely to decide
to lose background `high-performance` contexts"*, and an OBS overlay is hidden a lot.

[FACT-DOC, [Kenneth Russell, Chrome GPU team](https://groups.google.com/g/webgl-dev-list/c/ZDms8ZQGl3o)]
Chrome treated `default` as `high-performance` until Chrome 80, then defaulted to `low-power`; the
effect is on dual-GPU laptops, and switching GPUs *"causes the system to stutter for ~1 second."*
**Recommendation:** on a single-GPU desktop it buys nothing; on a dual-GPU laptop it forces the
discrete GPU — where Dota 2 already is, i.e. exactly the contention you're avoiding — and raises
context-loss risk when hidden. **Drop the attribute** or set `low-power`. [Inference from spec +
Chrome-team statements; no OBS/CEF-specific documentation on `powerPreference` under offscreen
rendering exists — unverified for CEF OSR.]

### The GPU knob that *is* documented

[FACT-DOC, posted by an OBS admin]
[OBS 24.0.3 GPU Priority Fix](https://obsproject.com/forum/threads/obs-studio-24-0-3-gpu-priority-fix-testing.111669/) —
Windows-only, addresses OBS losing framerate when a game consumes 95%+ of the GPU.
**Requires running OBS as Administrator** (disabled otherwise). Stated tradeoff: *"This may result
in a small reduction in performance of any games or other graphics applications running at the
same time."* This is **not** Settings → Advanced → *Process Priority*, which is CPU-only.
[FACT-DOC, [OBS KB: HAGS](https://obsproject.com/kb/hags)] Hardware-accelerated GPU scheduling
*"is currently known to cause performance and capture issues with OBS, games and overlay tools.
It is recommended that if you are having these issues you disable HAGS as a troubleshooting step."*
The "enable HAGS on RTX 40+" advice on blogs is **not** from obsproject.com.

### Other levers

- **Limit rAF / pause when idle** — the strongest lever you fully control. In the default
  `fps_custom = false` regime OBS already caps you at output fps; the win is *skipping work*, not
  frames. Stop the TresJS render loop when nothing is animating.
- **Hardware acceleration on/off while gaming:** [COMMUNITY] only — there is **no** OBS KB page or
  maintainer post recommending turning it off when gaming on the same GPU
  ([example](https://obsproject.com/forum/threads/why-does-disabling-browser-source-hardware-acceleration-work.166144/)).
  Per §1, turning it off moves work to **CPU + PCIe bandwidth**, also contended by the encoder.
  Measure, don't assume.
- **Counterintuitive data point:** [obs-browser#488](https://github.com/obsproject/obs-browser/issues/488)
  (open, 31.0.3/31.1.0-beta2) reports HW-accel frame-swap artifacts that scale with **CPU** load
  and *disappear when the GPU is saturated to 100%*. Suspect CPU scheduling first. Likely fixed by
  [obs-browser#531](https://github.com/obsproject/obs-browser/pull/531) (merged ~2026-09-01):
  since CEF M124 `OnAcceleratedPaint` textures come from an internal pool that *"cannot be cached
  and must be copied"*; obs-browser was caching the handle. Ships post-32.2.2.

## 6. How to actually measure it

### a) OBS Source Profiler — the right tool, but needs a plugin

[FACT-DOC, [libobs Source Profiler docs](https://docs.obsproject.com/reference-libobs-util-source-profiler)]
libobs exposes per-source profiling: `tick_avg`/`tick_max`, `render_avg`/`render_max`,
`render_gpu_avg`/`render_gpu_max`, `render_sum`/`render_gpu_sum` (sum across multiple renders in
one frame), `async_fps`. Sample window **5 seconds**. Quoted caveats: *"GPU timing is not supported
on macOS and is of limited accuracy due to variations in GPU load/clock speed"*; enabling it *"may
have a small performance penalty"* and GPU profiling *"may have a larger performance impact."*
[FACT-CODE] **OBS Studio's own UI does not expose this** — `frontend/data/locale/en-US.ini` at
master has only `CPUUsage`, `MemoryUsage`, `AverageTimeToRender`, `SkippedFrames`, `MissedFrames`,
`DroppedFrames`, `Bitrate`. Use the third-party Tools-menu dock
[exeldro/obs-source-profiler](https://github.com/exeldro/obs-source-profiler).

### b) Stats dock (built in)

Docks → Stats. The number that matters is **"Average time to render frame"**; at 60 fps the budget
is 16.6 ms and OBS's warning thresholds sit at 75%/100% of it. Baseline overlay-hidden vs.
overlay-shown, with Dota running both times. Also watch *Frames missed due to rendering lag* —
that's GPU contention showing directly.

### c) DevTools on the browser source

Launching OBS with `--remote-debugging-port=9222` and opening `http://localhost:9222` is the
documented route, but it is **known broken**:
[obs-studio#11576](https://github.com/obsproject/obs-studio/issues/11576) — works in 30.2.3, fails
from 31.0.0-rc1 with *"Debugging connection was closed. Reason: WebSocket disconnected"*; still
open, no maintainer fix
([forum report](https://obsproject.com/forum/threads/browser-source-remote-debugger-not-working-in-obs-31.182612/)).
**Use the built-in inspector instead:** obs-browser ships an `Inspect` context-menu entry
[FACT-CODE, `data/locale/en-US.ini`], opening CEF DevTools directly on the source — that's your
Performance-tab profiler. (Right-clicking *inside* the DevTools window has crash reports:
[#320](https://github.com/obsproject/obs-browser/issues/320),
[#321](https://github.com/obsproject/obs-browser/issues/321).)

### d) OBS log file + external

[FACT-CODE] obs-browser logs `[obs-browser]: Version %s` and
`[obs-browser]: CEF Version %i.%i.%i.%i (runtime), %s (compiled)` at startup. Grep for
`Blacklisted device detected` / `Blacklisted driver detected` — **that line is the definitive
answer to "am I in software mode?"** (Help → Log Files). Externally: Task Manager's
`obs-browser-page` CPU/GPU columns isolate browser work from OBS compositing, and on Windows
PresentMon on the game's frametimes with the overlay on vs. off is the only honest end-to-end
answer to "is it stealing FPS from Dota."

## 7. Gotchas

**Transparency / alpha correctness (open):**
- [obs-browser#469](https://github.com/obsproject/obs-browser/issues/469) — open, 30.2.3/31.0.0:
  semitransparent pixels render too dark, black fringing on text. [COMMUNITY] diagnosis:
  premultiplied RGBA treated as non-premultiplied.
  [obs-browser#533](https://github.com/obsproject/obs-browser/pull/533) — open PR: Chromium
  composites in *nonlinear* sRGB while OBS blends linearly.
  **Consequence:** soft glows, feathered edges and anti-aliased text over transparency may look
  darker/haloed in OBS than in Chrome. Prefer harder-edged alpha; check the real OBS output.
- [obs-browser#443](https://github.com/obsproject/obs-browser/issues/443) — CSS `mix-blend-mode`
  cannot blend with OBS layers *below* the source (architectural, not a bug). Any "screen"/"add"
  blend against the game feed must use an **OBS source blending mode**, not CSS.
- No issue exists reporting "transparent source goes solid black *because of* hardware
  acceleration" — that common claim is unsupported.

**Memory over long sessions:**
- [obs-studio#11549](https://github.com/obsproject/obs-studio/issues/11549) — **open**, 31.0.0-rc1,
  Win11. Minimal repro: *one* 1920×1080 browser source on a framerate-test page; dedicated GPU
  memory climbs steadily. No maintainer response. [COMMUNITY], but a trivial repro and directly on
  point for a 3+ hour stream of an animated WebGL overlay.
- [obs-browser#221](https://github.com/obsproject/obs-browser/issues/221) (closed) — CSS-animation
  memory growth was in the **main OBS process**, not `obs-browser-page`, i.e. texture/IPC side.
  [obs-browser#396](https://github.com/obsproject/obs-browser/pull/396) — a real leak, fixed.
- **Mitigation:** "Shutdown source when not visible" destroys the browser; "Refresh browser when
  scene becomes active" only reloads the page. No maintainer endorses either as a leak workaround.

**CEF/Chromium version ceiling:** OBS 31/32 = **Chromium 127** (mid-2024). Any web API that
shipped after Chromium 127 is unavailable — check everything you use against caniuse ≤ 127.
`DocumentPictureInPictureAPI` is explicitly disabled [FACT-CODE]. OBS 33 jumps to **Chromium 150**,
which also crosses the SwiftShader removal boundary (§1): **add `getContext('webgl2'|'webgl')`
null-handling now**, or the overlay hard-fails on OBS 33 machines without a working GPU path.

**Under load:** obs-browser#488 (§5) — artifacts scale with *CPU* contention, not GPU. Also, with
`fps_custom = false` your rAF cadence *is* OBS's cadence: if OBS misses render deadlines because
the game is hogging the GPU, the animation slows down with it rather than desyncing. Usually the
behaviour you want.

## What this means for a TresJS Dota overlay

1. **Verify you are in hardware mode first.** Grep the OBS log for `Blacklisted`. Keep *Enable
   Browser Source Hardware Acceleration* **on** unless measurement says otherwise — with it off,
   every 1080p frame costs ~7.91 MiB of CPU↔GPU traffic, contending with your encoder.
2. **Change `power-preference="high-performance"` in `app/components/BuddyScene.vue:12`** — drop
   the attribute or use `low-power`. It cannot give you GPU priority, it forces the discrete GPU on
   laptops (where Dota already is), and it makes your context a preferred victim for context loss
   when hidden.
3. **Leave "Use custom frame rate" unchecked.** The default external-begin-frame path locks the
   page to OBS's output clock — that *is* the "60fps feeling" at 60 fps output, with no judder from
   a mismatched timer. Only check it to deliberately run *slower* than output.
4. **Keep the 3D canvas backing store small** and let CSS scale it up. Displayed size is free;
   backing-store size is not.
5. **Gate the render loop.** Use TresJS manual rendering and stop rendering when the buddy is idle.
   Don't rely on OBS pausing you — it only pauses when the source is rendered nowhere at all.
6. **Full-screen edge effects: one source, `display: none` when idle.** Avoid a permanently-mounted
   full-screen `backdrop-filter`/`will-change` layer (~7.9 MiB of texture plus a full-screen
   compositor pass every frame). Two sources is defensible, but a shutdown source pays a Chromium
   cold start on show — wrong for reactive kill/death events.
7. **Budget against 16.6 ms.** Baseline "Average time to render frame" overlay-hidden vs.
   overlay-shown with Dota running; install
   [obs-source-profiler](https://github.com/exeldro/obs-source-profiler) for per-source
   `render_gpu_avg`. Don't count on `--remote-debugging-port` (broken since OBS 31) — right-click →
   **Inspect** instead.
8. **Design for Chromium 127 today, 150 tomorrow.** No post-127 web APIs; add a null-check +
   Canvas2D/CSS fallback for WebGL context creation before OBS 33 lands.
9. **Test alpha in OBS, not in Chrome** — soft glows and feathered edges hit the open
   premultiplied-sRGB bugs (#469/#533). Blending against the game feed must use OBS source blend
   modes; CSS `mix-blend-mode` cannot see OBS layers below.
10. **Watch VRAM over long sessions** (obs-studio#11549, open and unresolved). If it climbs, the
    only real mitigation is "Shutdown source when not visible" on sources you can tear down.
