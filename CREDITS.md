# Credits

Third-party assets used in Cards of Arcana, with their licences.

> **Keep this current.** Some licences below require attribution wherever the game is
> distributed — including a Steam store page or an in-game credits screen, not just this
> file. Establishing provenance retroactively is far harder than recording it now.

---

## Music

All five tracks by **Alexander Nakarada** (Serpent Sound Studios), released royalty-free.

| Track | In-game id | Source title |
|---|---|---|
| Blacksmith | `music.blacksmith` | *Royalty Free Medieval Music — Blacksmith* |
| Bonfire | `music.bonfire` | *Royalty Free Medieval Music — Bonfire* |
| Celebration | `music.celebration` | *Royalty Free Medieval Music — Celebration* |
| Entertainment | `music.entertainment` | *Royalty Free Medieval Music — Entertainment* |
| Marked | `music.marked` | *Royalty Free Medieval Music — Marked* |

- **Author:** Alexander Nakarada — <https://creatorchords.com> / <https://www.serpentsoundstudios.com>
- **Licence:** Nakarada's catalogue is generally released under **Creative Commons
  Attribution 4.0 (CC BY 4.0)**, which **requires visible credit**.

> **ACTION REQUIRED — verify before release.** Confirm the exact licence attached to each
> track on the page you downloaded it from, and record it here. Some of his catalogue has
> moved between CC BY 4.0 and other terms over time, and a few tracks are licensed
> differently. If any of these are CC BY, the attribution must appear somewhere a player can
> see it.

Suggested attribution line:

```
Music by Alexander Nakarada (creatorchords.com)
Licensed under Creative Commons BY Attribution 4.0
```

---

## Sound effects

Recorded or sourced by the project author. **Record provenance for anything not
self-recorded**, including CC0 material — CC0 needs no attribution but you still want to be
able to prove where it came from.

| Sound | In-game id | Source / licence |
|---|---|---|
| Card handling | `pool.cardFlip` | _unrecorded — fill in_ |
| Rapid cards | `pool.cardsRapid` | _unrecorded — fill in_ |
| Coin clinking | `reward.coin` | _unrecorded — fill in_ |
| Bush rustling | `wilderness.gatherComplete` | _unrecorded — fill in_ |
| Axe chopping | `wilderness.chop` | _unrecorded — fill in_ |
| Forest ambience | `ambient.wilderness` | _unrecorded — fill in_ |
| Forge ambience | `ambient.foundry` | _unrecorded — fill in_ |
| Page turn (pack opening) | `pool.pageTurn` | _unrecorded — fill in_ |
| Menu blips | `pool.uiBlip` | _unrecorded — fill in_ |
| Paper clicks (drawers) | `pool.uiPaper` | _unrecorded — fill in_ |

The `WAV_`-prefixed filenames of the last three (`WAV_pageturn_classic_01`,
`WAV_blip_snappy_32`, `WAV_click_paper_01`) look like they came from a commercial or
free UI sound pack rather than being self-recorded. **Find out which pack**, and record its
licence here — some permit game use only after purchase, and a few require credit.

Remaining sounds (`ui.hover`, `foundry.mineComplete`, `foundry.smeltComplete`,
`expedition.send`, `expedition.reveal`, `expedition.collect`) are **synthesised at runtime**
by `src/game/audio/audioSynth.js` — original, no third-party licence.

---

## Fonts

Self-hosted via `@fontsource`. All are open-licensed (SIL Open Font License 1.1).

**Three families only.** Fraunces, Cinzel, Crimson Pro and Inter were removed — the UI now reads as
one typographic system rather than four competing ones. Noto Sans Runic is not a fourth UI face: it
carries the runic codepoints the game draws and is applied only to spans holding nothing but runes.

| Font | Use |
|---|---|
| Uncial Antiqua | Wordmark, nothing else |
| Metamorphous | Navigation and menu chrome |
| Quattrocento (400/700) | Card titles, card info, prose, numbers, buttons — everything else |
| Noto Sans Runic | Rune glyphs only |

---

## Libraries

| Library | Licence |
|---|---|
| React | MIT |
| Vite | MIT |
| three.js | MIT |
