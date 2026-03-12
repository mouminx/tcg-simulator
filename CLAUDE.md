# TCG Simulator — Claude Code Context

React + Vite collectible card game simulator. No backend — all state in localStorage.

---

## Stack

- **React 18** + **Vite 5** — functional components throughout, no class components
- **CSS only** — no CSS-in-JS, no Tailwind; all styles in `src/App.css` (~4,400 lines)
- **No state library** — all state lives in `App.jsx`, passed down as props
- **sharp** (devDep) — Node-only, used by `scripts/extract-card-colors.mjs`

---

## Project Structure

```
src/
  App.jsx              Main state, navigation, all handlers
  App.css              All styles (4,400+ lines)
  game/
    cards.js           Rarities, packs, tiers, tags, openPack(), fusion, grading, imprinting
    cardArt.js         Vite glob image imports + CARD_ART_POSITION overrides
    cardColors.js      Auto-generated: card name → pre-computed avg art color (run extract-colors)
  components/
    CardFace.jsx       Card rendering: 3D tilt, holo, grade badge, sell overlay
    Collection.jsx     Grid + infinite scroll, filters, lasso select, card viewer modal
    Packs.jsx          Pack grid with infinite scroll
    PackCard.jsx       Reusable pack display with 3D tilt
    PackOpening.jsx    Sequential card reveal animation
    UnpackPage.jsx     Pack carousel + opening flow orchestration
    Shop.jsx           Pack shop with buy animations
    Lab.jsx            Fusion, grading, imprinting tabs
    FusionAnimation.jsx Orbital card → slam → result animation
    Market.jsx         Legendary/mythic slot-based trading with live price ticks
    FXEditor.jsx       Dev tool for designing card visual effects
  assets/cards/
    common/            38 PNGs
    uncommon/          36 PNGs
    rare/              35 PNGs
    epic/              (empty, ready for future art)
scripts/
  extract-card-colors.mjs   Reads all PNGs → writes src/game/cardColors.js
```

---

## Key Commands

```bash
npm run dev              # Local dev server
npm run build            # Production build
npm run extract-colors   # Regenerate cardColors.js after adding new art
```

**Run `extract-colors` whenever new PNG art is added to `src/assets/cards/`.**

---

## Game Data (src/game/cards.js)

### Rarities
| Rarity    | Weight | Value Range      | Color     |
|-----------|--------|------------------|-----------|
| common    | 55     | $0.10 – $1.00    | #6b7280   |
| uncommon  | 25     | $1.00 – $4.00    | #22c55e   |
| rare      | 12     | $4.00 – $18.00   | #3b82f6   |
| epic      | 5      | $18.00 – $65.00  | #a855f7   |
| legendary | 1      | $65.00 – $200.00 | #f59e0b   |
| mythic    | 0.5    | $200.00 – $500.00| #ec4899   |

### Tiers
| Tier | Weight | Value Multiplier |
|------|--------|-----------------|
| 1    | 45     | 1.0×            |
| 2    | 28     | 1.4×            |
| 3    | 16     | 2.0×            |
| 4    | 8      | 3.2×            |
| 5    | 3      | 5.5×            |

### Tags (14% base chance per card)
| Tag          | Multiplier | Weight |
|--------------|-----------|--------|
| holo         | 1.45×     | 35     |
| foil         | 1.25×     | 30     |
| reverse      | 1.30×     | 15     |
| shadow       | 1.80×     | 8      |
| nexus        | 2.10×     | 6      |
| prismatic    | 1.75×     | 4      |
| firstEdition | 3.50×     | 2      |

### Fusion Recipes
| From → To         | Cards | Cost    | Base Rate |
|-------------------|-------|---------|-----------|
| common → uncommon | 3     | $3.00   | 75%       |
| uncommon → rare   | 4     | $8.00   | 55%       |
| rare → epic       | 5     | $20.00  | 30%       |
| epic → legendary  | 6     | $60.00  | 18%       |
| legendary → mythic| 7     | $150.00 | 6%        |

FuseScore carries forward: each 1 fuseScore adds 1.5% success chance (cap 95%), 2% imprint success, and biases tag inheritance toward duplicates.

### Grading
Base costs (doubles per regrading attempt): common $3 / uncommon $8 / rare $20 / epic $50 / legendary $125 / mythic $300.
Grade 1–10, bell-curve distribution. Floor increases with rarity.

### Imprinting
Adds a tag to an untagged card. Destroys card on failure.
Base costs: holo $25 / foil $20 / reverse $22 / shadow $45 / nexus $65 / prismatic $55 / 1st Ed $130.
Multiplied by rarity: ×1 / ×1.6 / ×2.8 / ×5 / ×9 / ×18.

### Pack Types (23 total)
- **Core Set** (5 cards): Dusk, Iron, Arcane, Void, Primordial
- **Horizon Set** (10 cards): Dawn, Steel, Mystic, Abyss, Eternal
- **Vault Collection** (20 cards): Bastion, Aurum, Nexus
- **Tag Editions** (15 cards, 1.2× tag chance boost): Chromatic (holo), Sterling (foil), Mirror (reverse), Umbra (shadow), Rift (nexus), Spectrum (prismatic)

Void/Abyss, Primordial/Eternal, and Vault packs have significantly reduced legendary/mythic weights compared to base packs.

### New Player Boost
First 3 pack openings get a 10× multiplier on legendary/mythic weights. Tracked via `packsOpened` in state + localStorage.

---

## App State & localStorage

**localStorage key:** `tcg-sim` — version 6. Mismatched version discards save.

```js
{
  balance:      number,
  collection:   Card[],        // { id, name, rarity, tier, tag, value, grade?, gradeAttempts?, fuseScore? }
  packs:        Pack[],        // { id, packTypeId }
  market:       { legendarySlots: 0–5, mythicSlots: 0–5 },
  packsOpened:  number,
  version:      6
}
```

**Views:** SHOP → UNPACK → COLLECTION → LAB → MARKET

---

## Card Face Design

Card dimensions: **110×160px** in collection grid, **220×320px** default viewer, **315×456px** mobile viewer.

**Layout (top → bottom):**
1. Card name (top-left, small, truncates)
2. Art window (aspect-ratio 3/2.2, `loading="lazy"`)
3. Tag pills row: rarity (colored), tier (T1/T2/T3...), special tag if present
4. Grade badge — absolute top-right (color-coded: gem/high/mid/low)
5. Fuse badge — absolute bottom-left (⊕N)
6. Sell overlay — appears in sell mode
7. Holo layers (foil/glare/sparkle) — only when `holo` prop is true

**Card background:** Pre-computed average art color from `CARD_COLORS[card.name]` (darkened 50%). Falls back to `rarity.color`.
**Borders:** Both the card outer border and art window frame use a consistent gold `#c8a43a`.

**3D tilt:** CSS variables `--rx/--ry/--mx/--my/--hyp` driven by mouse/touch position.
Touch: 180ms hold activates tilt, 6px scroll movement cancels it.

**Holo layers** (only when `holo=true`, i.e. card viewer):
- Foil: uncommon+ — rainbow gradient overlay
- Glare: all holo — diagonal shine
- Sparkle: epic+ — dot pattern

**Tier overlays** (always visible, CSS-only):
- T1: subtle diagonal stripes
- T2: crosshatch
- T3: diamonds + hover shine sweep
- T4: glitter + hover rays
- T5: dense glitter + pulsing glow border

---

## Art System

**Adding new art:**
1. Drop PNG into `src/assets/cards/{rarity}/` — filename must match card name (e.g., `River Eel.png`)
2. Run `npm run extract-colors` to regenerate `cardColors.js`
3. Optionally add an entry to `CARD_ART_POSITION` in `src/game/cardArt.js` to shift the crop focus

`CARD_ART_POSITION` format: `'Card Name': 'center 20%'`
Lower % = creature appears lower in frame (anchors toward top of image).

---

## Collection Infinite Scroll

Renders 20 cards initially, loads 20 more when a sentinel element enters viewport (500px ahead).
`IntersectionObserver` uses a `fired` guard to prevent cascade re-fires.
Filter/sort changes reset to 20 and scroll to top (`window.scrollTo(0, 0)`).

---

## Mobile Performance Optimizations

- **Background animation disabled** (`@media (hover: none)`) — static gradient instead of `liquid-bg` repaint
- **`transform-style: flat`** on card-face-inner (mobile) — removes GPU compositing layer per card
- **`content-visibility: auto`** on `.collection-card-slot` — skips layout/paint for off-screen cards
- **`loading="lazy"` + `decoding="async"`** on card art images
- **Hover animations disabled** via `@media (hover: none)` — card twirl, tier shines, tag VFX, pack rays
- **`overscroll-behavior-y: none`** on html/body — prevents rubber-band snap triggering nav taps
- **`@media (prefers-reduced-motion: reduce)`** — collapses all animations

---

## CSS Architecture Notes

- `--glow-color` CSS variable set per card via inline style; used for hover drop-shadow
- Art window and card borders both use hard-coded gold `#c8a43a` (not dynamic)
- Holo card tilt overrides the card-twirl animation with `animation: none !important`
- `.no-twirl` class suppresses twirl in select mode
- Z-index stack within card-face-front: tier-overlay(1) → art(1) → holo layers(2–4) → text/badges(8–10)
- `position: relative` required on elements that need z-index inside absolute holo layers
- Grade badge has its own `position: absolute; z-index: 10` — do NOT add it to the `position: relative` group or it will lose its absolute positioning

---

## Known Patterns / Gotchas

- **Read before Edit** — always read a file before editing or the Edit tool will fail
- **`forwardRef` + merged ref** in CardFace — `wrapRef` (internal) merged with forwarded `ref`
- **Canvas taint** — `handleArtLoad` canvas approach was replaced by pre-computed `cardColors.js`; do not re-introduce runtime canvas reads
- **setState during render** — do not call `setVisibleCount` during render body; use `useEffect` (was a previous bug causing scroll jumps)
- **IntersectionObserver cascade** — always use a local `fired` flag in the observer callback to prevent multiple fires per effect lifecycle
- **Touch `e.preventDefault()`** in `handleTouchEnd` on PackCard — suppresses the synthetic click that would open a pack after a tilt gesture
- **SAVE_VERSION** — increment this in `App.jsx` when the save schema changes; old saves are discarded
- **`sharp` is devDep only** — not imported in any src/ file, only used by `scripts/extract-card-colors.mjs`
