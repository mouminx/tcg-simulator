import { useState, useRef, useEffect } from 'react';
import { RARITIES, TIERS, TAGS, CARD_AFFIXES, fmtStr } from '../game/cards';
import Gold from './Gold';
import CardFace from './CardFace';
import { CARD_SOURCE_MIME } from './CardPocket';
import { audioEngine } from '../game/audio/audioEngine';
import { SOUND_IDS } from '../game/audio/audioLibrary';
import HoverCardPreview, { buildHoverCardPreview } from './HoverCardPreview';
import commonGem from '../assets/rarity-gems/common.svg';
import uncommonGem from '../assets/rarity-gems/uncommon.svg';
import rareGem from '../assets/rarity-gems/rare.svg';
import epicGem from '../assets/rarity-gems/epic.svg';
import legendaryGem from '../assets/rarity-gems/legendary.svg';
import mythicGem from '../assets/rarity-gems/mythic.svg';

const RARITY_ORDER   = Object.keys(RARITIES);
const TIER_ORDER     = Object.keys(TIERS).map(Number);
const TAG_ORDER      = Object.keys(TAGS);
const AFFIX_ORDER    = Object.keys(CARD_AFFIXES);
/**
 * ── The binder adapts its ROW COUNT to the viewport, and that is a bug fix ──
 *
 * It was a fixed 4x4 (16 per page, 32 per spread) at a fixed 132x192 cell, which needs **847px of usable
 * height**. A 1366x768 laptop has 492px after the header, nav and Hand band — so 416px of the binder sat
 * behind an inner scroll, which is what "had to scroll around to see the entire collection book" was.
 *
 * Shrinking the cells to fit 4 rows there gives 71x103 — small enough that the art and nameplate stop being
 * readable, which is worse than scrolling. So the ROWS give way instead: 4 rows where there is room, 3 or 2
 * where there is not, with the cell kept at a legible size and capped at the original 132x192 so a tall
 * display does not inflate it.
 *
 * The trade is fewer cards per spread on a small screen — more page turns, but every card legible and
 * nothing hidden. Columns stay at 4: the pressure is vertical, and the binder already has width to spare.
 */
const BINDER_COLUMNS   = 4;
const BINDER_CELL_H_MAX = 192;
const BINDER_CELL_H_MIN = 112;   // matches the station-card floor; below this the nameplate stops being readable
const BINDER_GAP        = 7;
/**
 * Everything in the binder's height that is not grid: the page's own padding and gap, its page number, and
 * the spread's frame and shadow. Measured empirically — a first estimate of 58 left a consistent ~40px of
 * residual scroll at every viewport. Part of that was this constant and part was `.collection-card-slot`
 * carrying a fixed 160px height that outgrew a shrunken cell; with the slot filling its cell the honest
 * figure is 98, arrived at by measuring the residual rather than estimating the parts. At 1366x768 that
 * lands three rows within a pixel or two of the cell floor, which is why the floor is 112 (the same as the
 * station card's) and not 120 — a rounder number there would have cost a whole row.
 */
const BINDER_CHROME     = 98;

/**
 * Picks the largest row count whose cell still clears `BINDER_CELL_H_MIN`, from the height actually
 * available — measured, not inferred from a breakpoint, because the Hand band and the header both move.
 *
 * Observing the container is safe from a feedback loop: `.collection-shell` sizes its row with
 * `minmax(0, 1fr)`, so `.collection-main`'s height comes from the pane rather than from this content. The
 * equality guard makes that structural rather than a hope.
 */
function useBinderLayout(ref) {
  const [layout, setLayout] = useState({ rows: 4, cellH: BINDER_CELL_H_MAX });

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => {
      const available = el.clientHeight - BINDER_CHROME;
      let next = null;
      for (const rows of [4, 3, 2]) {
        const cellH = (available - BINDER_GAP * (rows - 1)) / rows;
        if (cellH >= BINDER_CELL_H_MIN) {
          next = { rows, cellH: Math.min(BINDER_CELL_H_MAX, Math.floor(cellH)) };
          break;
        }
      }
      // Nothing clears the minimum — a very short window. Two rows at whatever is left beats hiding cards.
      if (!next) {
        next = { rows: 2, cellH: Math.max(84, Math.floor((available - BINDER_GAP) / 2)) };
      }
      setLayout(prev => (prev.rows === next.rows && prev.cellH === next.cellH ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return layout;
}

const RARITY_GEMS = {
  common: commonGem,
  uncommon: uncommonGem,
  rare: rareGem,
  epic: epicGem,
  legendary: legendaryGem,
  mythic: mythicGem,
};

export default function Collection({ cards, onSell, pocket = [], lockedCardIds = [], onPocketAdd }) {
  const pocketSet = new Set((pocket ?? []).map(card => String(card.id)));
  const lockedSet = new Set((lockedCardIds ?? []).map(id => String(id)));
  const isPocketedCardId = cardId => pocketSet.has(String(cardId));
  const isLockedCardId = cardId => lockedSet.has(String(cardId));
  const [search, setSearch] = useState('');
  const [filterRarity, setFilterRarity] = useState(null);
  const [filterTier, setFilterTier] = useState(null);
  const [filterTag, setFilterTag] = useState(null);
  const [filterAffix, setFilterAffix] = useState(null);
  const [sortBy, setSortBy] = useState('price-desc');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sellingIds, setSellingIds] = useState(new Set());
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [dragRect, setDragRect] = useState(null);
  const [viewingCard, setViewingCard] = useState(null);
  const [hoverPreview, setHoverPreview] = useState(null);
  // Measured to decide how many binder rows fit. See useBinderLayout.
  const binderAreaRef = useRef(null);
  const [spreadIndex,   setSpreadIndex]   = useState(0);
  const [leftDisplay,   setLeftDisplay]   = useState(0); // index driving the left page render
  const [rightDisplay,  setRightDisplay]  = useState(0); // index driving the right page render
  const [flipState,     setFlipState]     = useState(null); // { dir: 'next'|'prev', frontCards, backCards }

  const FLIP_MS        = 520;
  const FLIP_EARLY_MS  = 50;           // departing slot: update while overlay still covers it
  const FLIP_REVEAL_MS = FLIP_MS - 80; // landing slot: update just before overlay disappears

  const lastClickedIdxRef = useRef(null);
  const isDraggingRef     = useRef(false);
  const dragStartRef      = useRef(null);
  const spreadRef         = useRef(null);
  const cardSlotRefs      = useRef(new Map());

  // ── Filtering / sorting ──────────────────────────────────────────────────
  const counts = Object.keys(RARITIES).reduce((acc, r) => {
    acc[r] = cards.filter(c => c.rarity === r).length;
    return acc;
  }, {});
  const tierCounts = TIER_ORDER.reduce((acc, tier) => {
    acc[tier] = cards.filter(c => Number(c.tier) === tier).length;
    return acc;
  }, {});
  const tagCounts = TAG_ORDER.reduce((acc, tag) => {
    acc[tag] = cards.filter(c => c.tag === tag).length;
    return acc;
  }, {});
  const affixCounts = AFFIX_ORDER.reduce((acc, affixId) => {
    acc[affixId] = cards.filter(c => (c.affixes ?? []).some(affix => affix.id === affixId || affix.stat === affixId)).length;
    return acc;
  }, {});

  const filtered = [...cards]
    .filter(c =>
      (!filterRarity || c.rarity === filterRarity) &&
      (!filterTier || Number(c.tier) === filterTier) &&
      (!filterTag || c.tag === filterTag) &&
      (!filterAffix || (c.affixes ?? []).some(affix => affix.id === filterAffix || affix.stat === filterAffix)) &&
      (!search || c.name.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'price-desc':  return b.value - a.value;
        case 'price-asc':   return a.value - b.value;
        case 'rarity-desc': return RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity);
        case 'rarity-asc':  return RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
        default:            return 0;
      }
    });

  /**
   * Page and spread sizes follow the measured row count, so they change with the window. `spreadIndex` is
   * an index into a list whose page size just moved, which is why the effect below resets to the first
   * spread when `cardsPerPage` changes — keeping the number would land the player on a different set of
   * cards than they were looking at, or past the end entirely.
   */
  const binderLayout   = useBinderLayout(binderAreaRef);
  const cardsPerPage   = binderLayout.rows * BINDER_COLUMNS;
  const spreadSize     = cardsPerPage * 2;

  const totalSpreads   = Math.max(1, Math.ceil(filtered.length / spreadSize));
  const safeLeft       = Math.min(leftDisplay,  totalSpreads - 1);
  const safeRight      = Math.min(rightDisplay, totalSpreads - 1);
  const leftPageCards  = filtered.slice(safeLeft  * spreadSize, safeLeft  * spreadSize + cardsPerPage);
  const rightPageCards = filtered.slice(safeRight * spreadSize + cardsPerPage, (safeRight + 1) * spreadSize);
  // Combined for select-all / invert operations
  const spreadCards    = [...leftPageCards, ...rightPageCards];

  // Reset to page 1 when filters change — or when the page size does, since a spread index means something
  // different once the number of cards per spread has moved.
  const filterKey = `${search}|${filterRarity}|${filterTier}|${filterTag}|${filterAffix}|${sortBy}|${cardsPerPage}`;
  useEffect(() => {
    setSpreadIndex(0);
    setLeftDisplay(0);
    setRightDisplay(0);
    setFlipState(null);
    window.scrollTo(0, 0);
  }, [filterKey]);

  // Clamp all indices if cards are removed (e.g. sold)
  useEffect(() => {
    const max = totalSpreads - 1;
    if (spreadIndex  > max) setSpreadIndex(max);
    if (leftDisplay  > max) setLeftDisplay(max);
    if (rightDisplay > max) setRightDisplay(max);
  }, [totalSpreads]);

  // ── Navigation with page-flip animation ──────────────────────────────────
  function goNext() {
    if (flipState !== null) return;
    const next = Math.min(totalSpreads - 1, spreadIndex + 1);
    if (next === spreadIndex) return;
    // Capture current right page (front face of flipping page)
    const front = rightPageCards;
    // Capture new spread's left page (back face — revealed as page lands)
    const nextSlice = filtered.slice(next * spreadSize, (next + 1) * spreadSize);
    const back = nextSlice.slice(0, cardsPerPage);
    setSpreadIndex(next);
    setFlipState({ dir: 'next', frontCards: front, backCards: back });
    // Right slot (departing): overlay lifts off it immediately, so reveal new content early
    setTimeout(() => setRightDisplay(next), FLIP_EARLY_MS);
    // Left slot (landing): overlay covers it at the end, update just before overlay disappears
    setTimeout(() => setLeftDisplay(next), FLIP_REVEAL_MS);
    setTimeout(() => setFlipState(null), FLIP_MS);
  }

  function goPrev() {
    if (flipState !== null) return;
    const prev = Math.max(0, spreadIndex - 1);
    if (prev === spreadIndex) return;
    // Capture current left page (front face of flipping page)
    const front = leftPageCards;
    // Capture prev spread's right page (back face — revealed as page lands)
    const prevSlice = filtered.slice(prev * spreadSize, (prev + 1) * spreadSize);
    const back = prevSlice.slice(cardsPerPage);
    setSpreadIndex(prev);
    setFlipState({ dir: 'prev', frontCards: front, backCards: back });
    // Left slot (departing): reveal new content early
    setTimeout(() => setLeftDisplay(prev), FLIP_EARLY_MS);
    // Right slot (landing): update just before overlay disappears
    setTimeout(() => setRightDisplay(prev), FLIP_REVEAL_MS);
    setTimeout(() => setFlipState(null), FLIP_MS);
  }

  useEffect(() => {
    function onKey(e) {
      if (viewingCard) {
        if (e.key === 'Escape') setViewingCard(null);
        return;
      }
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft')  goPrev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewingCard, spreadIndex, flipState, totalSpreads]);

  // ── Select mode ──────────────────────────────────────────────────────────
  function toggleSelectMode() {
    setSelectMode(prev => !prev);
    setSelectedIds(new Set());
    lastClickedIdxRef.current = null;
  }

  function toggleSelect(cardId, globalIdx, e) {
    if (isPocketedCardId(cardId)) return;
    if (e?.shiftKey && lastClickedIdxRef.current !== null) {
      const from    = Math.min(lastClickedIdxRef.current, globalIdx);
      const to      = Math.max(lastClickedIdxRef.current, globalIdx);
      const rangeIds = filtered
        .slice(from, to + 1)
        .filter(c => !isPocketedCardId(c.id))
        .map(c => c.id);
      setSelectedIds(prev => {
        const s = new Set(prev);
        rangeIds.forEach(id => s.add(id));
        return s;
      });
    } else {
      lastClickedIdxRef.current = globalIdx;
      setSelectedIds(prev => {
        const s = new Set(prev);
        s.has(cardId) ? s.delete(cardId) : s.add(cardId);
        return s;
      });
    }
  }

  // ── Sell ─────────────────────────────────────────────────────────────────
  function handleSell(cardId) {
    setSellingIds(prev => new Set([...prev, cardId]));
    setTimeout(() => onSell(cardId), 480);
  }

  function handleMassSell() {
    const toSell = [...selectedIds];
    setSellingIds(prev => new Set([...prev, ...toSell]));
    setSelectMode(false);
    setSelectedIds(new Set());
    setTimeout(() => toSell.forEach(id => onSell(id)), 480);
  }

  function handleSellFromViewer(cardId) {
    setViewingCard(null);
    setSellingIds(prev => new Set([...prev, cardId]));
    setTimeout(() => onSell(cardId), 480);
  }

  // ── Filter helpers ───────────────────────────────────────────────────────
  function toggleRarity(key) {
    setFilterRarity(prev => prev === key ? null : key);
  }

  function toggleTier(tier) {
    setFilterTier(prev => prev === tier ? null : tier);
  }

  function toggleTag(tag) {
    setFilterTag(prev => prev === tag ? null : tag);
  }

  function toggleAffix(affixId) {
    setFilterAffix(prev => prev === affixId ? null : affixId);
  }

  function selectByRarity(rarityKey) {
    const ids = cards
      .filter(c => c.rarity === rarityKey && !isPocketedCardId(c.id))
      .map(c => c.id);
    setSelectedIds(prev => {
      const s   = new Set(prev);
      const all = ids.every(id => s.has(id));
      if (all) ids.forEach(id => s.delete(id));
      else     ids.forEach(id => s.add(id));
      return s;
    });
  }

  // Price range selects across all filtered cards, not just the current spread
  function selectByPriceRange() {
    const min = priceMin !== '' ? parseFloat(priceMin) : -Infinity;
    const max = priceMax !== '' ? parseFloat(priceMax) :  Infinity;
    const ids = filtered
      .filter(c => c.value >= min && c.value <= max && !isPocketedCardId(c.id))
      .map(c => c.id);
    setSelectedIds(prev => {
      const s = new Set(prev);
      ids.forEach(id => s.add(id));
      return s;
    });
  }

  // "All visible" / "Invert" operate on the current spread only
  function selectAllVisible() {
    const ids = spreadCards.filter(c => !isPocketedCardId(c.id)).map(c => c.id);
    setSelectedIds(prev => {
      const s   = new Set(prev);
      const all = ids.every(id => s.has(id));
      if (all) ids.forEach(id => s.delete(id));
      else     ids.forEach(id => s.add(id));
      return s;
    });
  }

  function invertSelection() {
    const visibleIds = new Set(spreadCards.filter(c => !isPocketedCardId(c.id)).map(c => c.id));
    setSelectedIds(prev => {
      const s = new Set();
      visibleIds.forEach(id => { if (!prev.has(id)) s.add(id); });
      return s;
    });
  }

  // ── Lasso drag ───────────────────────────────────────────────────────────
  function handleSpreadMouseDown(e) {
    if (!selectMode) return;
    if (e.button !== 0) return;
    if (e.target.closest('.collection-card-slot')) return;
    isDraggingRef.current  = true;
    dragStartRef.current   = { x: e.clientX, y: e.clientY };
    setDragRect({ x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY });
    e.preventDefault();
  }

  useEffect(() => {
    function onMouseMove(e) {
      if (!isDraggingRef.current) return;
      const { x, y } = dragStartRef.current;
      setDragRect({ x1: x, y1: y, x2: e.clientX, y2: e.clientY });
    }
    function onMouseUp(e) {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      const { x, y } = dragStartRef.current;
      const selLeft   = Math.min(x, e.clientX);
      const selTop    = Math.min(y, e.clientY);
      const selRight  = Math.max(x, e.clientX);
      const selBottom = Math.max(y, e.clientY);
      if (selRight - selLeft > 5 || selBottom - selTop > 5) {
        const hit = [];
        for (const [cardId, el] of cardSlotRefs.current.entries()) {
          if (isPocketedCardId(cardId)) continue;
          if (!el) continue;
          const r = el.getBoundingClientRect();
          if (r.right > selLeft && r.left < selRight &&
              r.bottom > selTop  && r.top  < selBottom) {
            hit.push(cardId);
          }
        }
        if (hit.length > 0) {
          setSelectedIds(prev => {
            const s = new Set(prev);
            hit.forEach(id => s.add(id));
            return s;
          });
        }
      }
      setDragRect(null);
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };
  }, []);

  // Close viewer if the viewed card is sold
  useEffect(() => {
    if (viewingCard && !cards.find(c => c.id === viewingCard.id)) setViewingCard(null);
  }, [cards, viewingCard]);

  // ── Derived display values ───────────────────────────────────────────────
  const totalValue   = cards.reduce((sum, c) => sum + c.value, 0);
  const selectedTotal = [...selectedIds].reduce((sum, id) => {
    const card = cards.find(c => c.id === id);
    return sum + (card?.value ?? 0);
  }, 0);

  const lassoStyle = dragRect ? {
    position:     'fixed',
    left:         Math.min(dragRect.x1, dragRect.x2),
    top:          Math.min(dragRect.y1, dragRect.y2),
    width:        Math.abs(dragRect.x2 - dragRect.x1),
    height:       Math.abs(dragRect.y2 - dragRect.y1),
    border:       '1.5px dashed #60a5fa',
    background:   'rgba(96,165,250,0.08)',
    pointerEvents:'none',
    zIndex:        9998,
    borderRadius:  4,
  } : null;

  // ── Card slot renderer ───────────────────────────────────────────────────
  function renderCardSlot(card, globalIdx) {
    const isSelling  = sellingIds.has(card.id);
    const isSelected = selectedIds.has(card.id);
    const inPocket   = isPocketedCardId(card.id);
    const isLocked   = isLockedCardId(card.id);
    const isUnavailable = inPocket || isLocked;
    const classes = [
      isSelling  ? 'selling'  : '',
      isSelected ? 'selected' : '',
      selectMode ? 'no-twirl' : '',
      isUnavailable ? 'in-pocket' : '',
    ].filter(Boolean).join(' ');

    return (
      <div
        key={card.id}
        ref={el => {
          if (el) cardSlotRefs.current.set(card.id, el);
          else    cardSlotRefs.current.delete(card.id);
        }}
        className={`collection-card-slot${isUnavailable ? ' collection-card-slot--in-pocket' : ''}`}
        draggable={!selectMode && !isUnavailable}
        onMouseEnter={e => setHoverPreview(buildHoverCardPreview(e.currentTarget, card))}
        onMouseLeave={() => setHoverPreview(current => (current?.card?.id === card.id ? null : current))}
        onDragStart={!selectMode && !isUnavailable ? e => {
          audioEngine.play(SOUND_IDS.cardFlip);
          e.dataTransfer.setData('text/plain', String(card.id));
          // Lets the pocket distinguish an incoming card from an internal reorder.
          e.dataTransfer.setData(CARD_SOURCE_MIME, 'collection');
          e.dataTransfer.effectAllowed = 'move';
        } : undefined}
      >
        <CardFace
          card={card}
          className={classes}
          visualMode="compact"
          onClick={isUnavailable ? undefined : (e => {
            // A CardFace is a div, so the delegated click sound in App.jsx does not fire for
            // it — cards need their own.
            audioEngine.play(SOUND_IDS.cardFlip);
            if (selectMode) toggleSelect(card.id, globalIdx, e);
            else setViewingCard(card);
          })}
        />
        {isUnavailable && (
          <div
            className="collection-pocket-badge"
            title={inPocket ? 'In pocket' : 'Socketed in foundry'}
            aria-label={inPocket ? 'In pocket' : 'Socketed in foundry'}
          >
            <span className="collection-pocket-badge__rune" aria-hidden="true">ᛜ</span>
            <span className="collection-pocket-badge__text">{inPocket ? 'In Pocket' : 'In Use'}</span>
          </div>
        )}
        {isSelling && (
          <div className="money-popup">+<Gold amount={card.value} /></div>
        )}
      </div>
    );
  }

  // Render a card for the flip overlay faces (no interactions)
  function renderFlipCard(card) {
    return (
      <div key={card.id} className="collection-card-slot">
        <CardFace card={card} visualMode="compact" />
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (cards.length === 0) {
    return (
      <div className="collection">
        <h2>Collection</h2>
        <p className="empty-msg">No cards yet — buy a pack to get started!</p>
      </div>
    );
  }

  const leftPageNum  = safeLeft  * 2 + 1;
  const rightPageNum = safeRight * 2 + 2;

  return (
    <div className="collection">
      <HoverCardPreview preview={hoverPreview} />
      {lassoStyle && <div style={lassoStyle} />}

      <div className="collection-shell">
        <aside className="collection-sidebar">
          <div className="collection-title-row">
            <h2>
              Collection{' '}
              <span className="card-count">({cards.length} cards · <Gold amount={totalValue} /> total value)</span>
            </h2>
            <button
              className={`select-mode-btn ${selectMode ? 'active' : ''}`}
              onClick={toggleSelectMode}
            >
              {selectMode
                ? (selectedIds.size > 0 ? `Cancel (${selectedIds.size})` : 'Cancel')
                : 'Select'}
            </button>
          </div>

          {/* Scroll region. The sell bar below sits outside it, so it stays visible no
              matter how long the filter stack gets — previously it was the last child
              of the sidebar and got pushed off-screen exactly when it was needed. */}
          <div className="collection-sidebar__scroll">
          <div className="collection-filters">
            <div className="filters-top-row">
              <input
                className="search-input"
                type="text"
                placeholder="Search cards..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <div className="sort-control">
                <label className="sort-label">Order by</label>
                <select
                  className="sort-select"
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                >
                  <option value="price-desc">Price ↓</option>
                  <option value="price-asc">Price ↑</option>
                  <option value="rarity-desc">Rarity ↓</option>
                  <option value="rarity-asc">Rarity ↑</option>
                </select>
              </div>
            </div>
            <div className="collection-filter-group">
              <span className="collection-filter-group__label">Rarity</span>
              <div className="rarity-filters">
              {Object.entries(RARITIES).map(([key, rarity]) =>
                counts[key] > 0 && (
                  <button
                    key={key}
                    className={`rarity-filter-btn ${filterRarity === key ? 'active' : ''}`}
                    style={{
                      '--rarity-color': rarity.color,
                      borderColor: filterRarity === key ? rarity.color : undefined,
                      color: filterRarity === key ? rarity.color : undefined,
                    }}
                    onClick={() => toggleRarity(key)}
                  >
                    <span className="rarity-filter-btn__main">
                      <span className="rarity-filter-gem-wrap">
                        <img src={RARITY_GEMS[key]} alt="" className="rarity-filter-gem" />
                      </span>
                      <span>{rarity.name}</span>
                    </span>
                    <span className="rarity-filter-count">{counts[key]}</span>
                  </button>
                )
              )}
              </div>
            </div>

            <div className="collection-filter-group">
              <span className="collection-filter-group__label">Tier</span>
              <div className="collection-chip-grid collection-chip-grid--tier">
                {TIER_ORDER.map(tier =>
                  tierCounts[tier] > 0 && (
                    <button
                      key={tier}
                      className={`collection-chip-btn ${filterTier === tier ? 'active' : ''}`}
                      onClick={() => toggleTier(tier)}
                    >
                      <span className="collection-chip-btn__label">Tier {tier}</span>
                      <span className="collection-chip-btn__count">{tierCounts[tier]}</span>
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="collection-filter-group">
              <span className="collection-filter-group__label">Card Type</span>
              <div className="collection-chip-grid">
                {TAG_ORDER.map(tag =>
                  tagCounts[tag] > 0 && (
                    <button
                      key={tag}
                      className={`collection-chip-btn collection-chip-btn--tag ${filterTag === tag ? 'active' : ''}`}
                      onClick={() => toggleTag(tag)}
                    >
                      <span className="collection-chip-btn__label">{TAGS[tag].name}</span>
                      <span className="collection-chip-btn__count">{tagCounts[tag]}</span>
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="collection-filter-group">
              <span className="collection-filter-group__label">Affix</span>
              <div className="collection-chip-grid">
                {AFFIX_ORDER.map(affixId =>
                  affixCounts[affixId] > 0 && (
                    <button
                      key={affixId}
                      className={`collection-chip-btn collection-chip-btn--affix ${filterAffix === affixId ? 'active' : ''}`}
                      onClick={() => toggleAffix(affixId)}
                    >
                      <span className="collection-chip-btn__label">{CARD_AFFIXES[affixId].label}</span>
                      <span className="collection-chip-btn__count">{affixCounts[affixId]}</span>
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          {selectMode && (
            <div className="select-by-panel">
              <span className="select-by-label">Select by</span>
              <div className="select-by-rarities">
                {Object.entries(RARITIES).map(([key, rarity]) =>
                  counts[key] > 0 && (
                    <button
                      key={key}
                      className="select-by-rarity-btn"
                      style={{ '--rarity-color': rarity.color }}
                      onClick={() => selectByRarity(key)}
                    >
                      {rarity.name}
                    </button>
                  )
                )}
              </div>
              <div className="select-by-price">
                <span className="select-by-sublabel">Price</span>
                <input
                  className="price-range-input"
                  type="number"
                  placeholder="Min"
                  min="0"
                  value={priceMin}
                  onChange={e => setPriceMin(e.target.value)}
                />
                <span className="price-range-dash">–</span>
                <input
                  className="price-range-input"
                  type="number"
                  placeholder="Max"
                  min="0"
                  value={priceMax}
                  onChange={e => setPriceMax(e.target.value)}
                />
                <button
                  className="select-by-action-btn"
                  onClick={selectByPriceRange}
                  disabled={priceMin === '' && priceMax === ''}
                >
                  Select
                </button>
              </div>
              <div className="select-by-actions">
                <button className="select-by-action-btn" onClick={selectAllVisible}>
                  {spreadCards.every(c => selectedIds.has(c.id)) ? 'Deselect page' : 'All on page'}
                </button>
                <button className="select-by-action-btn" onClick={invertSelection}>
                  Invert
                </button>
              </div>
            </div>
          )}

          </div>

          {selectMode && selectedIds.size > 0 && (
            <div className="mass-sell-bar">
              <span>{selectedIds.size} card{selectedIds.size !== 1 ? 's' : ''} selected · <Gold amount={selectedTotal} /></span>
              <button className="sell-selected-btn" onClick={handleMassSell}>
                Sell selected
              </button>
            </div>
          )}
        </aside>

        {/* `binderAreaRef` is measured to pick the binder's row count — see useBinderLayout. The CSS vars
            carry the result down to the grid, so the geometry lives in one place. */}
        <div
          className="collection-main"
          ref={binderAreaRef}
          style={{
            '--binder-rows': binderLayout.rows,
            '--binder-cell-h': `${binderLayout.cellH}px`,
          }}
        >
          {filtered.length === 0 ? (
            <p className="empty-msg">No cards match your filter.</p>
          ) : (
            <div className="binder">
          {/* Prev arrow */}
          <button
            className="binder-nav binder-nav--prev"
            onClick={goPrev}
            disabled={spreadIndex === 0 || flipState !== null}
            aria-label="Previous page"
          >
            ‹
          </button>

          {/* Spread */}
          <div
            ref={spreadRef}
            className={`binder-spread${selectMode ? ' binder-spread--selecting' : ''}`}
            onMouseDown={handleSpreadMouseDown}
          >
            {/* Left page slot — elevated during prev flip so overlay renders above right slot */}
            <div className="binder-page-slot binder-page-slot--left" style={flipState?.dir === 'prev' ? { zIndex: 2 } : undefined}>
              <div className="binder-page binder-page--left">
                <div className="binder-page-grid">
                  {leftPageCards.map((card, i) =>
                    renderCardSlot(card, safeLeft * spreadSize + i)
                  )}
                  {Array.from({ length: cardsPerPage - leftPageCards.length }).map((_, i) => (
                    <div key={`empty-l-${i}`} className="binder-empty-slot" />
                  ))}
                </div>
                <div className="binder-page-number">{leftPageNum}</div>
              </div>

              {/* Prev-flip overlay: left page flips to the right */}
              {flipState?.dir === 'prev' && (
                <div className="binder-flip-overlay binder-flip-overlay--prev">
                  <div className="binder-flip-face binder-flip-face--front binder-page--left">
                    <div className="binder-page-grid">
                      {flipState.frontCards.map(renderFlipCard)}
                      {Array.from({ length: cardsPerPage - flipState.frontCards.length }).map((_, i) => (
                        <div key={`empty-fl-${i}`} className="binder-empty-slot" />
                      ))}
                    </div>
                  </div>
                  <div className="binder-flip-face binder-flip-face--back binder-page--right">
                    <div className="binder-page-grid">
                      {flipState.backCards.map(renderFlipCard)}
                      {Array.from({ length: cardsPerPage - flipState.backCards.length }).map((_, i) => (
                        <div key={`empty-bl-${i}`} className="binder-empty-slot" />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Spine */}
            <div className="binder-spine" />

            {/* Right page slot */}
            <div className="binder-page-slot binder-page-slot--right">
              <div className="binder-page binder-page--right">
                <div className="binder-page-grid">
                  {rightPageCards.map((card, i) =>
                    renderCardSlot(card, safeRight * spreadSize + cardsPerPage + i)
                  )}
                  {Array.from({ length: cardsPerPage - rightPageCards.length }).map((_, i) => (
                    <div key={`empty-r-${i}`} className="binder-empty-slot" />
                  ))}
                </div>
                <div className="binder-page-number">{rightPageNum}</div>
              </div>

              {/* Next-flip overlay: right page flips to the left */}
              {flipState?.dir === 'next' && (
                <div className="binder-flip-overlay binder-flip-overlay--next">
                  <div className="binder-flip-face binder-flip-face--front binder-page--right">
                    <div className="binder-page-grid">
                      {flipState.frontCards.map(renderFlipCard)}
                      {Array.from({ length: cardsPerPage - flipState.frontCards.length }).map((_, i) => (
                        <div key={`empty-fr-${i}`} className="binder-empty-slot" />
                      ))}
                    </div>
                  </div>
                  <div className="binder-flip-face binder-flip-face--back binder-page--left">
                    <div className="binder-page-grid">
                      {flipState.backCards.map(renderFlipCard)}
                      {Array.from({ length: cardsPerPage - flipState.backCards.length }).map((_, i) => (
                        <div key={`empty-br-${i}`} className="binder-empty-slot" />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Next arrow */}
          <button
            className="binder-nav binder-nav--next"
            onClick={goNext}
            disabled={spreadIndex >= totalSpreads - 1 || flipState !== null}
            aria-label="Next page"
          >
            ›
          </button>
        </div>
          )}

          {filtered.length > 0 && (
            <div className="binder-spread-counter">
              {safeLeft * spreadSize + 1}–{Math.min((safeLeft + 1) * spreadSize, filtered.length)} of {filtered.length}
            </div>
          )}
        </div>
      </div>

      {/* ── Card viewer ── */}
      {viewingCard && (
        <div className="card-viewer-overlay" onClick={() => setViewingCard(null)}>
          <div className="card-viewer-modal" onClick={e => e.stopPropagation()}>
            <button className="card-viewer-close" onClick={() => setViewingCard(null)} aria-label="Close">✕</button>
            <div className="card-viewer-card-wrap">
              <CardFace card={viewingCard} className="viewer-card" holo artDetail="full" />
            </div>
            <div className="card-viewer-panel">
              <h3 className="card-viewer-name">{viewingCard.name}</h3>
              <div className="card-viewer-tags">
                <span
                  className="card-viewer-tag"
                  style={{ '--tag-color': RARITIES[viewingCard.rarity].color }}
                >
                  {RARITIES[viewingCard.rarity].name}
                </span>
                <span className="card-viewer-tag card-viewer-tag--tier">
                  Tier {TIERS[viewingCard.tier]?.name ?? viewingCard.tier}
                </span>
                {viewingCard.tag && TAGS[viewingCard.tag] && (
                  <span className={`card-viewer-tag card-viewer-tag--tag card-viewer-tag--tag-${viewingCard.tag}`}>
                    {TAGS[viewingCard.tag].name}
                  </span>
                )}
              </div>
              <div className="card-viewer-value-row">
                <span className="card-viewer-value-label">Value</span>
                <span className="card-viewer-value-amount"><Gold amount={viewingCard.value} /></span>
              </div>
              <button
                className="card-viewer-sell-btn"
                onClick={() => handleSellFromViewer(viewingCard.id)}
              >
                Sell · {fmtStr(viewingCard.value)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
