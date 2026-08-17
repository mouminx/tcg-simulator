---
paths:
  - "src/assets/**"
  - "scripts/optimize-assets.mjs"
  - "src/game/cardArt.js"
  - "src/game/resourceArt.js"
---

<!-- Path-scoped rule: loads only when Claude touches the files above. Split out of a single
     3,335-line CLAUDE.md, which was ~45k tokens in every session before any work began. -->

# Assets

Art sizing, the WebP pipeline, and where originals live.

> Cross-cutting invariants (scroll ownership, the CSS ordering trap, the save shape, the gold
> seam, card identity, performance) live in the root `CLAUDE.md`, which is always loaded.

## Asset Notes

**All raster art is WebP.** There are no PNGs under `src/assets/`. Anything that
globs or imports art must use `.webp`.

Important asset folders:

- `src/assets/class-cards/`        768x1152 card art (detail)
- `src/assets/class-cards-thumb/`  320x480 card art (thumb)
- `src/assets/elements/`           384px square icons
- `src/assets/ores/`               384px square icons
- `src/assets/ingots/`             384px long edge
- `src/assets/resources/`          384px square icons
- `src/assets/crafted/`            384px square crafted-item icons
- `src/assets/tools/`              384px square tool icons
- `src/assets/cards/charms/`       384px square icons
- `src/assets/rarity-gems/`        SVG
- `src/assets/tier-stars/`         SVG

### Asset pipeline

`npm run optimize-assets` (`scripts/optimize-assets.mjs`) reads originals from
`src/assets-original/` (gitignored) and writes sized WebP into `src/assets/`.
It always reads originals, never its own output, so it is safe to re-run with
different targets. Sizes are derived from the largest size each asset renders at,
doubled for 2x DPR:

- card art at 330px in the viewer modal → 768x1152 detail
- card art at 132px in the binder cell → 320x480 thumb
- square icons at ~110px in sidebars → 384px long edge

`npm run extract-colors` samples the optimized WebPs (not the source PNGs) and regenerates
`src/game/cardColors.js`. Class-card filenames do not need numeric variant suffixes; one image in a
class folder is a valid one-variant art set.

`src/assets-original/` is not in git. To regenerate it, `git checkout` an older
commit's `src/assets` or re-export from source art.

### Two card art sizes

`src/game/cardArt.js` exports `CLASS_ART` (detail), `CLASS_ART_THUMB`, and
`getClassArt(classType, artVariant, detail)`. `CardFace` takes an `artDetail` prop
defaulting to `'thumb'`. Only three call sites pass `'full'`: the Collection viewer
modal, `HoverCardPreview`, and the pack-reveal `center-card`. Everything else is
110-160px and the thumb is ample. This matters — the binder renders 32 cards at
once, and thumbs are 0.59 MiB decoded against 3.38 MiB for detail.

### Removed

`src/assets/cards/{common,uncommon,rare,epic}` held 296 MB of legacy creature art
that no live code referenced. It and the dead `CARD_ART` glob in `cardArt.js` are
gone. Recoverable from git history if ever needed.

Known filename oddity:

- `blooming quitessence.webp` is misspelled in assets and handled in code

Coin reward art:

- `few coins.webp`
- `lots of coins.webp`

---
