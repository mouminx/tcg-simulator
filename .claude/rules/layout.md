---
paths:
  - "src/App.css"
  - "src/App.jsx"
---

<!-- Path-scoped rule: loads only when Claude touches the files above. Split out of a single
     3,335-line CLAUDE.md, which was ~45k tokens in every session before any work began. -->

# Layout

The shell layout contract: who owns scrolling, the dock gutter, short-viewport fitting, and the CSS ordering traps that keep recurring.

> Cross-cutting invariants (scroll ownership, the CSS ordering trap, the save shape, the gold
> seam, card identity, performance) live in the root `CLAUDE.md`, which is always loaded.

## Layout / Scrolling

**The window never scrolls.** `html`, `body` and `#root` are all `height: 100%; overflow:
hidden`, and `.app` is a fixed-height flex column. Everything below is about who owns
scrolling instead.

```text
html/body/#root  overflow: hidden
+- .app          height: 100vh, flex column, overflow: hidden
   +- .header    flex: 0 0 auto
   +- .tab-bar   flex: 0 0 auto
   +- .main      flex: 1, min-height: 0, overflow-y: auto   <- default scroll owner
      +- .main--fit  overflow: hidden                       <- converted views
```

`FIT_VIEWS` in `App.jsx` lists the views laid out to fit exactly — Shop, Collection,
Foundry, Wilderness. Those get `.main--fit` and manage their own internal scroll regions.
**Any view not in that set keeps the pane's own scroll**, so what used to be a page scroll
is now a pane scroll — same behaviour, no regression. Arcana, Lab, Market and Expedition are
all in that category. (Shop now covers what used to be the Summon page too, and being in
`FIT_VIEWS` is why its columns each have to own their scrolling — the pane gives them none.)

### Three things that bite in this layout

1. **`flex: 0 0 auto` on the header and tab bar.** Without it they are shrinkable flex
   children, and any view whose content overflows *compresses the masthead* instead of
   overflowing. The symptom looks exactly like a scrolled page.
2. **`min-height: 0` on every flex/grid child in the chain.** A flex child will not shrink
   below its content size without it, so the pane grows and the shell scrolls anyway.
3. **`align-items: start` on a grid defeats all of it.** `.collection-shell` had it, so its
   row sized to content and `.collection-main`'s `overflow: auto` never engaged. It now
   uses an explicit `grid-template-rows: minmax(0, 1fr)` with `align-items: stretch`.

### The dock gutter

`--dock-gutter` is the Hand fan's visible height. Two things consume it: `.main`'s bottom padding, and
`.inventory-panel`'s `bottom` inset.

**It is DERIVED IN CSS, not a constant — and that is a bug fix.** It was a hard `14rem` (232px), which cost
the same on a 1366×768 laptop as on a 4K display. Measured there: header + nav + that band left **436px of
usable content height, 57% of the screen**, and the Collection binder overflowed its pane by 201px, the
Foundry's mine slots by 67px and its queue by 186px. That is the reported "large horizontal rect spanning
the bottom that cuts off half the screen-space".

It is now `calc(var(--station-card-h) * 0.82 + 2.2rem)` — the portion of a card resting above the screen
edge, plus room for the rune arc's crown and label. `--station-card-w` is itself `clamp(112px, 13.5vh,
170px)`, so **one knob moves the card and the band it needs together**, and a window resize is handled by
CSS with no re-render. `vh` rather than `vmin` because the pressure is vertical; width was never the problem.

Measured after: usable height 57% → 64% at 1366×768, 66% → 69% at 1512×982, and the Summon page's pane
scroll 196px → 140px (that page has since been folded into Shop — see **The Cards page**).

**The Hand is the one floating surface that reserves space instead of overlaying**, and that asymmetry is
deliberate. A right-edge drawer covers content only while it happens to be open, and only at one edge; the
fan spans the bottom of *every* view permanently, so anything running under it would be unreachable rather
than momentarily hidden.

### Short viewports

Measured at real MacBook resolutions, because a 768px-tall laptop is where every fixed pixel cost lands.
Figures are inner scroll with a LARGE collection queue (11–12 entries), which is the demanding case.

| View | 1366x768 | 1280x800 | 1440x900 |
|---|---|---|---|
| Collection | **no scrolling** | **no scrolling** | **no scrolling** |
| Cards (shop + altar) | **no page scroll** | **no page scroll** | **no page scroll** |
| Foundry — mine half | 178px | — | — |
| Wilderness — gathering half | 192px | — | — |
| Foundry — forge half | 256px | 263px | 234px |
| Wilderness — processing half | 265px | 145px | 96px |

For scale on how far this has come: the forge half was **1449px** and processing **1066px** before the row
selector; mine was **460px** and gathering **474px** before the page titles came off and the mine slot stopped
being square. None of the remaining figures are a missing tweak — see the two subsections below for why each
is arithmetic.

**The binder adapts its row count**, not its cell size — see `useBinderLayout` in Collection.jsx. Forcing
4 rows into 492px gives 71x103 cells, which is less readable than scrolling; 3 rows at ~120px is not.
`.collection-card-slot` also had to stop being a fixed 110x160 and fill its cell, or a shrunken cell left the
card overflowing it — that was the last ~25px of residual scroll.

**The mine and gathering slots are ALWAYS 2x2, and this half is allowed to scroll for it.** There was a
`max-height: 940px` breakpoint that switched to a single row of four so the half would fit; it is gone.

Four across does fit — and it is the wrong layout: it does not match how mining and gathering are played, and
four slots squeezed into one half are too small to read. So the arithmetic is accepted rather than solved: a
`.foundry-half` gets 395px at 1366x768 and a 2x2 grid of 270px slots needs 551px, which is ~390px of the mine
and gathering halves' inner scroll. Wider, readable slots with a scroll beat a layout that fits and cannot be
used.

**Do not reintroduce the breakpoint to reclaim that height.** It was tried, shipped, and rejected on exactly
this ground. If the height is wanted back, the answer is a shorter SLOT, not more columns.

At 1366x768 a socketed card is 112px in a 270px slot; at 1512x982, 133px in a 304px slot. There is room in
the slot for up to ~190px of card (`.foundry-mine-slot__card` caps at `max-width: 70%`), so the binding limit
is `--station-card-w`'s `13.5vh` — see the note on that variable for what raising it costs.

### One forge row and one processing bench at a time

`.forge-selector` in App.css, driven by `activeForgeRow` in Foundry.jsx and `activeProcessing` in
Wilderness.jsx. Three stacked forge rows needed **1844px** in a `.foundry-half` that gets **395px** at
1366x768 — 131px per row, less than one 112px rail tile — so no amount of card-shrinking could ever have
fitted them. Wilderness's processing rows share the row implementation and shared the problem.

**The remaining scroll is arithmetic, not a missing tweak.** One row is 558px against a 395px half, so even
a single row cannot fit. Closing it needs the ROW to get shorter, which is a design decision rather than a
fit fix: lay the process panel out horizontally (fuel / smelt / output side by side) instead of as three
stacked bands. That would also alter the **vertical merge connector**, which is the whole read of the
station, and it would change Wilderness too — the processing rows reuse `.foundry-forge-row`.

**The tabs carry each row's state, and that part is load-bearing.** Hiding two rows means a smelt that
finished on row II, with the player on row I, has nowhere to announce itself. Each tab shows:

| State | On the tab |
|---|---|
| no card | `Empty` |
| card, missing an input | `Needs coal` / `Needs ore` / `Needs ingredient` |
| all inputs satisfied | `Ready` |
| running | a percentage, plus a 2px progress fill along the bottom edge |
| output waiting | a loot diamond in the corner |

`needs` names ONE next action, ordered by what the player has to do first, rather than listing everything
missing. The diamond is **static, not animated** — the same rule the nav's loot diamond follows, because
`animation` is switched off entirely at low and medium quality and this is a gameplay signal.

- **Nothing auto-follows the selection.** A row finishing lights its tab and the player decides; moving the
  view under someone is worse than a tab they have to notice.
- **The selection is not persisted.** It is where the player happens to be looking, and restoring it would
  be indistinguishable from the game having switched rows by itself.
- **`forgeRowStatus` derives a row's state in one place.** It was computed twice — in `ForgeSmeltingRow` and
  again in the half's `forgeReadyCount` — with the `ingredientOk` / `oreRequired` chain written out both
  times. The selector needed a third copy, and a third copy of a four-condition readiness test is one that
  eventually disagrees with the ticker about whether a row is running.
- **`.forge-selector` carries a 12px right inset.** The Bag's tab rail overlays this half's right edge:
  measured a **constant 9px** of overhang from 1024px to 1440px, 3px at 1512px, clear above 1700px. Scoped
  to the selector rather than fixed on `.main`'s padding — that was tried and reverted, because the rail is
  viewport-anchored while `.main` is centred in a 1500px max-width, so a padding wide enough at one width
  overshoots at another and narrows every view for nothing. The row keeps the same 9px overhang; that is the
  pre-existing documented limit, and unlike a tab its right edge is panel padding rather than a click target.

The `foundry-action-row` under each half is **gone**, its summary folded into the half's existing header. It
cost 32px of a half with none to spare and said less than the selector now says per row.

### Foundry and Wilderness have no page title

Both used to open with a big centred "FOUNDRY" / "WILDERNESS" and an instruction line. Removed: the tab bar
already names the page, and each half carries its own heading and instruction ("The Mine" / "The Forge"), so
it was the third label saying the same thing. Worth **~60px** — the band was 46px plus the page's 14.4px gap —
handed straight to the halves, which is the scarcest space in the game. Arcana still renders a page title, so
`.foundry-header` / `.foundry-title` / `.foundry-subtitle` stay; `.wilderness-title` / `-subtitle` are gone.

At 1512x982 this took the **Wilderness processing half to no scroll at all**.

**On its own it did not make the collection queue visible, and the reason is worth knowing.** The mine slots
were square
(`aspect-ratio: 1`) and fluid-width, so a wider half makes them wider *and therefore taller* — 618px at
1512x982 against 551px at 1366x768. A bigger monitor gains 60px from this change and spends 67px of it on
bigger slots, which is why the loot row sits 237px below the fold at 1512 and 360px at 1366.

**`aspect-ratio: 1` is gone from `.foundry-mine-slot`, and that is what got the queue on screen.** A 270x270
slot held a 112x162 card beside the speed dial, so ~108px of every slot was empty — and because the slot was
square and fluid-width, a wider half made it taller. Height is now
`calc(var(--station-card-h) + 1.1rem)`: the card plus exactly the slot's own padding, with no spare band.

**The card did not shrink to pay for it** — still 133x192 at 1512x982 and 112x162 at 1366x768, verified
identical before and after. Only the dead space went. `test-stacked-rows` asserts both together, because
buying height by shrinking the card is the tempting wrong fix and has been explicitly rejected.

The last ~33px came from chrome, as one budget: `.foundry-half` gap 1.1 -> 0.7rem and bottom padding
1.5 -> 1rem, `.foundry-queue` gap 0.65 -> 0.45rem and padding 0.9 -> 0.6rem.

**At 1512x982 the mine's collection queue is fully on screen.** At 1366x768 the loot row is still ~130px
under: 2x2 slots plus a queue need ~620px in a 456px half, and closing that would mean shrinking something
that has to stay readable.

Also removed: the redundant "N slots mining" / "N slots gathering" line. The row renders **only when nothing
is running**, so the empty-state instruction (which is not inferable from an empty slot) survives and the
space is reclaimed exactly when there is loot to show.
