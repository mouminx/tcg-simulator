import { useState, useRef, useEffect } from 'react';
import { RARITIES, TIERS, TAGS, fmt } from '../game/cards';
import CardFace from './CardFace';

const RARITY_ORDER = Object.keys(RARITIES); // common → mythic

export default function Collection({ cards, onSell }) {
  const [search, setSearch] = useState('');
  const [filterRarity, setFilterRarity] = useState(null);
  const [sortBy, setSortBy] = useState('price-desc');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sellingIds, setSellingIds] = useState(new Set());
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [dragRect, setDragRect] = useState(null);
  const [viewingCard, setViewingCard] = useState(null);
  const [visibleCount, setVisibleCount] = useState(20);

  const lastClickedIdxRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef(null);
  const gridRef = useRef(null);
  const cardSlotRefs = useRef(new Map()); // Map<cardId, DOMElement>
  const sentinelRef = useRef(null);

  // Auto-load more cards when sentinel scrolls into view.
  // `fired` local var ensures the observer fires at most once per effect
  // lifecycle, preventing the race where it fires multiple times before
  // React can commit the new visibleCount and disconnect the old observer.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    let fired = false;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !fired) {
        fired = true;
        setVisibleCount(n => n + 20);
      }
    }, { rootMargin: '500px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [visibleCount]);

  // When filters/sort change, reset pagination and scroll to top.
  // Without scrollTo(0,0), the old scroll position could land past the new
  // shorter list and appear as an accidental snap-to-top.
  const filterKey = `${search}|${filterRarity}|${sortBy}`;
  useEffect(() => {
    setVisibleCount(20);
    window.scrollTo(0, 0);
  }, [filterKey]);

  // Compute counts + filtered early so handlers can close over them
  const counts = Object.keys(RARITIES).reduce((acc, r) => {
    acc[r] = cards.filter(c => c.rarity === r).length;
    return acc;
  }, {});

  const filtered = [...cards]
    .filter(c =>
      (!filterRarity || c.rarity === filterRarity) &&
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

  function toggleSelectMode() {
    setSelectMode(prev => !prev);
    setSelectedIds(new Set());
    lastClickedIdxRef.current = null;
  }

  function toggleSelect(cardId, idx, e) {
    if (e?.shiftKey && lastClickedIdxRef.current !== null) {
      const from = Math.min(lastClickedIdxRef.current, idx);
      const to   = Math.max(lastClickedIdxRef.current, idx);
      const rangeIds = filtered.slice(from, to + 1).map(c => c.id);
      setSelectedIds(prev => {
        const s = new Set(prev);
        rangeIds.forEach(id => s.add(id));
        return s;
      });
      // anchor stays fixed — don't update lastClickedIdxRef
    } else {
      lastClickedIdxRef.current = idx;
      setSelectedIds(prev => {
        const s = new Set(prev);
        s.has(cardId) ? s.delete(cardId) : s.add(cardId);
        return s;
      });
    }
  }

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

  function closeViewer() { setViewingCard(null); }

  function handleSellFromViewer(cardId) {
    setViewingCard(null);
    setSellingIds(prev => new Set([...prev, cardId]));
    setTimeout(() => onSell(cardId), 480);
  }

  function toggleRarity(key) {
    setFilterRarity(prev => prev === key ? null : key);
  }

  function selectByRarity(rarityKey) {
    const ids = cards.filter(c => c.rarity === rarityKey).map(c => c.id);
    setSelectedIds(prev => {
      const s = new Set(prev);
      const allAlreadySelected = ids.every(id => s.has(id));
      if (allAlreadySelected) ids.forEach(id => s.delete(id));
      else ids.forEach(id => s.add(id));
      return s;
    });
  }

  function selectByPriceRange(visibleCards) {
    const min = priceMin !== '' ? parseFloat(priceMin) : -Infinity;
    const max = priceMax !== '' ? parseFloat(priceMax) :  Infinity;
    const ids = visibleCards.filter(c => c.value >= min && c.value <= max).map(c => c.id);
    setSelectedIds(prev => {
      const s = new Set(prev);
      ids.forEach(id => s.add(id));
      return s;
    });
  }

  function selectAllVisible(visibleCards) {
    const ids = visibleCards.map(c => c.id);
    setSelectedIds(prev => {
      const s = new Set(prev);
      const allSelected = ids.every(id => s.has(id));
      if (allSelected) ids.forEach(id => s.delete(id));
      else ids.forEach(id => s.add(id));
      return s;
    });
  }

  function invertSelection(visibleCards) {
    const visibleIds = new Set(visibleCards.map(c => c.id));
    setSelectedIds(prev => {
      const s = new Set();
      visibleIds.forEach(id => { if (!prev.has(id)) s.add(id); });
      return s;
    });
  }

  // Lasso drag — only fires when clicking empty grid space (not on a card)
  function handleGridMouseDown(e) {
    if (!selectMode) return;
    if (e.button !== 0) return;
    if (e.target.closest('.collection-card-slot')) return;
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
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

  // Close viewer on Escape, or if the viewed card is sold
  useEffect(() => {
    if (viewingCard && !cards.find(c => c.id === viewingCard.id)) setViewingCard(null);
  }, [cards, viewingCard]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') setViewingCard(null); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (cards.length === 0) {
    return (
      <div className="collection">
        <h2>Collection</h2>
        <p className="empty-msg">No cards yet — buy a pack to get started!</p>
      </div>
    );
  }

  const totalValue = cards.reduce((sum, c) => sum + c.value, 0);

  const selectedTotal = [...selectedIds].reduce((sum, id) => {
    const card = cards.find(c => c.id === id);
    return sum + (card?.value ?? 0);
  }, 0);

  const lassoStyle = dragRect ? {
    position: 'fixed',
    left:   Math.min(dragRect.x1, dragRect.x2),
    top:    Math.min(dragRect.y1, dragRect.y2),
    width:  Math.abs(dragRect.x2 - dragRect.x1),
    height: Math.abs(dragRect.y2 - dragRect.y1),
    border: '1.5px dashed #60a5fa',
    background: 'rgba(96,165,250,0.08)',
    pointerEvents: 'none',
    zIndex: 9998,
    borderRadius: 4,
  } : null;

  return (
    <div className="collection">
      {lassoStyle && <div style={lassoStyle} />}

      <div className="collection-title-row">
        <h2>
          Collection <span className="card-count">({cards.length} cards · {fmt(totalValue)} total value)</span>
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
                {rarity.name} <span className="rarity-filter-count">{counts[key]}</span>
              </button>
            )
          )}
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
              onClick={() => selectByPriceRange(filtered)}
              disabled={priceMin === '' && priceMax === ''}
            >
              Select
            </button>
          </div>

          <div className="select-by-actions">
            <button className="select-by-action-btn" onClick={() => selectAllVisible(filtered)}>
              {filtered.every(c => selectedIds.has(c.id)) ? 'Deselect visible' : 'All visible'}
            </button>
            <button className="select-by-action-btn" onClick={() => invertSelection(filtered)}>
              Invert
            </button>
          </div>
        </div>
      )}

      {selectMode && selectedIds.size > 0 && (
        <div className="mass-sell-bar">
          <span>{selectedIds.size} card{selectedIds.size !== 1 ? 's' : ''} selected · {fmt(selectedTotal)}</span>
          <button className="sell-selected-btn" onClick={handleMassSell}>
            Sell selected
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="empty-msg">No cards match your filter.</p>
      ) : (
        <div
          ref={gridRef}
          className={`collection-grid${selectMode ? ' collection-grid--selecting' : ''}`}
          onMouseDown={handleGridMouseDown}
        >
          {filtered.slice(0, visibleCount).map((card, idx) => {
            const isSelling = sellingIds.has(card.id);
            const isSelected = selectedIds.has(card.id);
            const classes = [
              isSelling  ? 'selling'  : '',
              isSelected ? 'selected' : '',
              selectMode ? 'no-twirl' : '',
            ].filter(Boolean).join(' ');

            return (
              <div
                key={card.id}
                ref={el => {
                  if (el) cardSlotRefs.current.set(card.id, el);
                  else    cardSlotRefs.current.delete(card.id);
                }}
                className="collection-card-slot"
              >
                <CardFace
                  card={card}
                  className={classes}
                  visualMode="compact"
                  onClick={selectMode
                    ? (e) => toggleSelect(card.id, idx, e)
                    : () => setViewingCard(card)
                  }
                />
                {isSelling && (
                  <div className="money-popup">+{fmt(card.value)}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {filtered.length > visibleCount && (
        <div ref={sentinelRef} style={{ height: 1 }} />
      )}
      {viewingCard && (
        <div className="card-viewer-overlay" onClick={closeViewer}>
          <div className="card-viewer-modal" onClick={e => e.stopPropagation()}>
            <button className="card-viewer-close" onClick={closeViewer} aria-label="Close">✕</button>
            <div className="card-viewer-card-wrap">
              <CardFace card={viewingCard} className="viewer-card" holo />
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
                <span className="card-viewer-value-amount">{fmt(viewingCard.value)}</span>
              </div>
              <button
                className="card-viewer-sell-btn"
                onClick={() => handleSellFromViewer(viewingCard.id)}
              >
                Sell · {fmt(viewingCard.value)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
