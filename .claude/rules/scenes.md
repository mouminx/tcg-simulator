---
paths:
  - "src/scenes/**"
  - "src/components/SceneBackdrop.jsx"
  - "src/game/graphics.js"
---

<!-- Path-scoped rule: loads only when Claude touches the files above. Split out of a single
     3,335-line CLAUDE.md, which was ~45k tokens in every session before any work began. -->

# Scenes

WebGL scene backdrops and the three.js gotchas that produced hours of wrong diagnosis.

> Cross-cutting invariants (scroll ownership, the CSS ordering trap, the save shape, the gold
> seam, card identity, performance) live in the root `CLAUDE.md`, which is always loaded.

## Scene Backdrops

Optional WebGL backdrops behind certain views. `three` is the largest dependency in the
project, so the whole subsystem is built to be **absent** rather than degraded.

```text
src/components/SceneBackdrop.jsx   host; decides whether to mount anything at all
src/scenes/backdrop.js             the ONLY module importing three; renderer + loop
src/scenes/wildernessScene.js      conifer forest, day/night cycle       (Wilderness)
src/scenes/cavernScene.js          worked mine shaft, forge-lit          (Foundry)
src/scenes/splashScene.js          title card
```

### How a view gets one

`BACKDROP_SCENES` in `App.jsx` maps a view to a scene id:

```js
const BACKDROP_SCENES = {
  [VIEWS.WILDERNESS]: 'wilderness',
  [VIEWS.FOUNDRY]: 'cavern',
};
```

A mapped view also gets the `app--scene` class, which makes that view's panels
translucent so the scene reads through them.

### Layers, and why the fallback is never "nothing"

`SceneBackdrop` always renders a **CSS gradient** keyed to the scene, and only lays a
canvas over it when the tier allows:

| Situation | Result |
|---|---|
| quality low / medium | gradient only — three is never downloaded |
| quality high | gradient + canvas, three loaded via dynamic `import()` |
| high but GL refused | gradient only |

A **veil** sits on top of both to keep UI contrast predictable regardless of what the scene
is doing underneath. Its opacity is per-scene and matters more than it looks: the wilderness
is a lit sunset and can lose half its brightness, while the cavern is dark to begin with —
the wilderness veil applied to the cavern took it to a mean luminance of 17 against the
wilderness's 41, which is present in a screenshot and invisible in practice.

### The builder contract

Each scene exports `build(THREE)` and returns:

```js
{ scene, camera, update(elapsedSeconds), dispose(),
  bloom?: { strength, radius, threshold },        // opt in to UnrealBloomPass
  toneMapping?: { type, exposure } }              // opt in to tone mapping
```

`camera` may be perspective **or** orthographic. An orthographic camera has no `aspect` — its
frustum is set by explicit edges — so it must carry `camera.userData.viewHeight`, the world
height it wants in view. `resize()` in `backdrop.js` rebuilds `left/right/top/bottom` from
that and the viewport aspect, which is what keeps pixels square. Forget it and the scene
stretches on every window that is not the size you developed at.

`THREE` is **passed in, never imported** by a scene module — that is what keeps three out
of the main bundle. `bloom` and `toneMapping` are opt-in per scene so one scene's needs
cannot silently change another's look.

The loop runs at a capped 30 fps, pauses on `visibilitychange`, and anchors elapsed time
across pauses so a cycle does not jump on resume.

### `failIfMajorPerformanceCaveat: true` must stay

In `backdrop.js`. It makes the context request **fail** on a software rasteriser instead of
handing back a renderer that would run at single-digit fps — which is precisely the
school-Chrome case this work started from, and is not detectable by sniffing CPU or memory.
`mountBackdrop` returns `null` and the gradient stands in.

Note for anyone capturing headlessly: this flag is exactly what turns SwiftShader away, so
a headless browser cannot mount a scene without temporarily relaxing it. Revert it.

### Orthographic bird's-eye, and what it drags along with it

**Wilderness and Foundry are both angled orthographic bird's-eye.** The splash scene is
deliberately still perspective — it is a title card, not a place.

Switching projection is not a camera swap. Four things had to change with it, and each was
invisible until the view moved:

- **Content distribution follows the frustum.** The forest placed everything in a *wedge*
  (`spread = 130 + depth * 330`) because a perspective frustum widens with depth, so a wedge
  is exactly what fills the frame. An orthographic frustum is a box, and that same wedge
  renders as a triangular clearing with bare ground at the near corners. Trees, grass, bushes
  and rocks now share one rectangle — `AREA_X` / `AREA_Z_NEAR` / `AREA_Z_FAR`, with `depthAt(z)`
  supplying the haze and thinning that `depth` used to.
- **`FogExp2` stops working the way you expect.** It attenuates by *absolute distance from the
  camera*. An orthographic rig stands well back from its target — the standoff is a free
  parameter that only fog and clipping notice — so every surface sits at a similar distance
  and the whole frame fogs uniformly. At the cavern's original density the result was a flat
  brown veil with no depth information in it at all. The cavern now uses **ranged
  `THREE.Fog`** (`FOG_NEAR` / `FOG_FAR`); the wilderness kept `FogExp2` but cut its densities
  by a third and pulled the standoff from 210 to 150.
- **Elevation angle decides whether you see the ground.** The forest at 38 degrees looked
  *through* the rows: the canopy occluded the floor completely and it read as a flat side-on
  wall of trees. 52 degrees, with the tree count down from 260 to 185, shows the ground —
  which is half the point.
- **Detail sized for one viewing angle can be wrong at another.** Grass was 1600 thin
  9-unit cones. Correct from a camera standing in the field; from above, 1600 vertical
  scratches over the ground. They are squat tufts now (`BLADE_H` 4.5, radius 0.85, less wind
  sway), which is what a clump of growth looks like from overhead.

Both veils were re-tuned **in opposite directions** afterwards, measured against the UI
rather than guessed: the wilderness got heavier (it now shows far more sunlit ground) and the
cavern lighter. See the veil note above — this is exactly the job it exists to do.

### Splash scene notes

Layered ridge silhouettes behind the title and the main menu. Three things decide whether it
reads as mountains or as moorland:

- **Peaks, not sines.** The profile is a set of overlapping triangular summits with randomised
  height and half-width (`makePeaks` / `peakProfile`), giving sharp tops and deep saddles. Two
  summed sines give evenly spaced rounded humps, which is a moor.
- **Peak size is specified in WORLD units, not as a fraction of ridge width.** Sizing them
  relatively made them scale with the ridge: a 1700-unit ridge got 250-unit-wide summits against
  a 76-unit rise — a hill. Steepness is the whole effect, so it is set independently of width.
- **Ridge widths are sized to the visible frame plus parallax margin.** The old 1700-unit ridges
  put only two or three summits on screen, so the range read as a couple of broad humps.

Each ridge is positioned by `baseY` / `saddleY` / `summitY` — where its silhouette should land in
frame — rather than by an abstract amplitude, and the profile is normalised against its own
maximum so `summitY` means what it says whatever the random peaks came out as. An earlier version
scaled displacement as a fraction of body height; because the profile maximum varies, the near
ridge's summits reached 469 units and filled the frame with flat dark purple, which looked
exactly like an empty scene.

Summits step **down** toward the viewer, which is how a real range reads — far peaks sit highest
in frame. Rows are displaced in proportion to their height up the plane, not just the top edge,
which is what leaves room for a snowline; with a single row there is nowhere to put one and the
mountains look like cut paper. Material colour is white and the vertex colours carry the hue,
for the usual reason.

The sky's bands are compressed toward the horizon. Spread evenly, the warm dawn colour sat at the
bottom of the sphere, entirely behind the ridges — so the sky read as flat night with the one
thing that made it dawn permanently hidden.

**Nothing moves in this scene but the camera.** It used to carry its own field of rising motes as
well as the DOM rune stream, and two unrelated drifts crossing each other read as noise rather
than as one effect. The screen's only particles are the diagonal stream in SplashScreen.jsx.

### Cavern scene notes

A cave is defined by what is lit, so the priorities are close to the inverse of the forest:

- **An open-roofed arc built from `shaftPoint` over an (angle, z) grid**, not a cylinder. The
  roof is cut away between `ARC_START` and `ARC_END` so a camera above can see in at all — a
  tunnel viewed from inside has nothing to offer a bird's-eye view. `shaftRadius(z)` and
  `wallOffset(angle, z)` are shared by the shell, the ore, the spurs, the floor and the
  surrounding surface, so every feature agrees on where the rock is.
- **The surrounding rock surface is what makes it read as a mine.** Two strips running out
  from the open lips (`rimPoint`, `SURFACE_OUT`). Without them the cutaway floats in haze with
  flat fog in the corners of the frame; with them, the same geometry is a trench driven into
  solid rock. `SURFACE_SEGS` is 50 rather than a handful because the strip reuses `LEN_SEGS`
  rows to match the rim exactly — at 7 columns the facets were 1.9 x 13.6 units, and flat
  shading turned those ribbons into a corduroy texture that read as rope.
- **A non-attenuating top fill exists for a layout reason.** The surface is beyond every
  lamp's reach and renders at a third of the trench's brightness. Fine for a picture — but
  the UI panels cover the middle where the lit trench is, so the regions a player sees
  through are the dark corners. A `DirectionalLight` lifts them without touching the lamps'
  falloff.
- **The floor is width-matched to the shaft** via `floorHalfWidth`. It began as a fixed
  76-wide plane, which overhung the rock; because the shell renders `BackSide`, that apron
  was plainly visible outside the tunnel as a large flat surface.
- **Three lamps receding** (forge, hung mid-shaft lamp, far lantern). Two left an unlit gap
  in the middle, and unlit rock reads as absence rather than distance.
- **Ore is lit by baked proximity** to those lamps (`lightReach`), not uniformly. Ore uses
  an unlit material so it survives the dark; applied uniformly it read as confetti hanging
  in mid-air, because a bright speck in front of black rock has nothing to belong to.
- **The shell is flat-shaded** — the rock exception the forest already makes for boulders —
  and carries a facet-scale noise term. Without a term at facet scale the fire-lit wall was
  one smooth gradient.

---

## three.js gotchas that produced hours of wrong diagnosis

All three make geometry render *black*, which looks identical to a lighting problem:

- **Lights are physically based** (three >= r155). `PointLight.intensity` is in candela and
  falls off as `1/d^decay`. The cavern's fire began at `2.6`, which delivered `0.015` to a
  wall 20 units away — the entire shaft rendered black. It needs ~`210`. Directional and
  hemisphere lights do not attenuate, which is why the wilderness scene never hit this.
- **`instanceColor` and vertex colours MULTIPLY the material colour.** Supplying a dark rock
  tone in both places squares it: `0x463d35 x 0x2f2a25` is about 0.2% reflectance. Where
  per-instance or per-vertex colour carries the real hue, **the material must be white**;
  where it carries variation, it must be a multiplier centred on 1.0. Note colours are
  converted to *linear* space, so components land near 0.03-0.08, not the ~0.28 an
  sRGB-shaped normalisation would assume.
- **Fog is applied after lighting and dominates an enclosed scene.** In the cavern, fog
  covers most of the frame, so `FOG_COLOR` effectively *is* the mid-tone. At near-black
  everything past ~40 units collapsed and raising ambient fivefold barely moved the
  histogram.

When a scene looks wrong, **raycast the pixel** before adjusting anything. The cavern's
"featureless smooth wall" turned out to be the fire's glow **sprite** — sprite scale is in
world units, and at 20 units across, 18 units from the camera, one additive quad covered a
third of the frame and hid everything behind it. Two rounds of lighting and shading changes
went into a surface that was not there.

---
