import { useMemo, useState, useRef } from 'react';
import {
  ARCANA_ITEMS_BY_ID,
  ESSENCES_BY_ID,
  parseElementResourceId,
} from '../game/arcana';
import CardFace from './CardFace';

// ── Ring recipe definitions ───────────────────────────────────────────────────
// pattern: { slotId: elementId } — only element family, tier ignored for matching
// All unspecified slots must be EMPTY for the pattern to match.
const RING_RECIPES = [
  // ── Charms (N-S axis) ─────────────────────────────────────────────────────
  { id: 'smoldering-charm', mages: 1, pattern: { 'outer-n': 'smoldering', 'outer-s': 'smoldering', 'inner-n': 'gusting',   'inner-s': 'gusting'   } },
  { id: 'jolting-charm',    mages: 1, pattern: { 'outer-n': 'jolting',    'outer-s': 'jolting',    'inner-n': 'gusting',   'inner-s': 'gusting'   } },
  { id: 'flowing-charm',    mages: 1, pattern: { 'outer-n': 'flowing',    'outer-s': 'flowing',    'inner-n': 'blooming',  'inner-s': 'blooming'  } },
  { id: 'blooming-charm',   mages: 1, pattern: { 'outer-n': 'blooming',   'outer-s': 'blooming',   'inner-n': 'flowing',   'inner-s': 'flowing'   } },
  { id: 'gusting-charm',    mages: 1, pattern: { 'outer-n': 'gusting',    'outer-s': 'gusting',    'inner-n': 'jolting',   'inner-s': 'jolting'   } },
  { id: 'hollowing-charm',  mages: 1, pattern: { 'outer-n': 'hollowing',  'outer-s': 'hollowing',  'inner-n': 'flowing',   'inner-s': 'flowing'   } },
  { id: 'gleaming-charm',   mages: 1, pattern: { 'outer-n': 'gleaming',   'outer-s': 'gleaming',   'inner-n': 'ascending', 'inner-s': 'ascending' } },
  { id: 'ascending-charm',  mages: 1, pattern: { 'outer-n': 'ascending',  'outer-s': 'ascending',  'inner-n': 'gleaming',  'inner-s': 'gleaming'  } },
  // ── Catalysts (E-W axis) ─────────────────────────────────────────────────
  { id: 'emberstep-catalyst',  mages: 2, pattern: { 'outer-w': 'smoldering', 'inner-w': 'blooming',  'inner-e': 'flowing'                          } },
  { id: 'crestforge-catalyst', mages: 2, pattern: { 'outer-w': 'jolting',    'outer-e': 'gusting',   'inner-w': 'gleaming'                         } },
  { id: 'mythrise-catalyst',   mages: 2, pattern: { 'outer-w': 'hollowing',  'outer-e': 'gleaming',  'inner-w': 'ascending', 'inner-e': 'ascending' } },
  { id: 'zenith-catalyst',     mages: 2, pattern: { 'outer-w': 'ascending',  'outer-e': 'ascending', 'inner-w': 'gleaming',  'inner-e': 'hollowing' } },
  // ── Sigils (mixed patterns) ──────────────────────────────────────────────
  { id: 'tideglow-sigil',   mages: 3, pattern: { 'outer-n': 'gleaming',  'outer-e': 'flowing',   'inner-n': 'blooming'                         } },
  { id: 'windluster-sigil', mages: 3, pattern: { 'outer-n': 'gleaming',  'outer-w': 'gusting',   'inner-w': 'smoldering'                       } },
  { id: 'ashmirror-sigil',  mages: 3, pattern: { 'outer-e': 'gusting',   'outer-w': 'jolting',   'inner-s': 'flowing'                          } },
  { id: 'cinderveil-sigil', mages: 3, pattern: { 'outer-s': 'hollowing', 'inner-s': 'smoldering', 'inner-e': 'gusting'                         } },
  { id: 'riftheart-sigil',  mages: 3, pattern: { 'outer-n': 'hollowing', 'outer-s': 'ascending', 'inner-w': 'jolting'                          } },
  { id: 'starprism-sigil',  mages: 3, pattern: { 'outer-n': 'gleaming',  'outer-e': 'ascending', 'inner-e': 'gusting',   'inner-w': 'jolting'   } },
  { id: 'dawnmark-sigil',   mages: 3, pattern: { 'outer-n': 'gleaming',  'outer-e': 'ascending', 'inner-n': 'flowing'                          } },
];

// ── Slot layout ───────────────────────────────────────────────────────────────
const OUTER_SLOT_IDS = ['outer-n', 'outer-e', 'outer-s', 'outer-w'];
const INNER_SLOT_IDS = ['inner-n', 'inner-e', 'inner-s', 'inner-w'];
const ELEMENT_SLOT_IDS = [...OUTER_SLOT_IDS, ...INNER_SLOT_IDS];
const CARD_SLOT_IDS = ['nw', 'ne', 'sw', 'se'];

const SLOT_GRID_AREA = {
  'outer-n': 'outern', 'outer-e': 'outere', 'outer-s': 'outers', 'outer-w': 'outerw',
  'inner-n': 'innern', 'inner-e': 'innere', 'inner-s': 'inners', 'inner-w': 'innerw',
  'nw': 'cardnw', 'ne': 'cardne', 'sw': 'cardsw', 'se': 'cardse',
};

const CARD_SLOT_LABEL = { nw: 'NW', ne: 'NE', sw: 'SW', se: 'SE' };
const SLOT_HINT = {
  'outer-n': 'Outer N', 'outer-e': 'Outer E', 'outer-s': 'Outer S', 'outer-w': 'Outer W',
  'inner-n': 'Inner N', 'inner-e': 'Inner E', 'inner-s': 'Inner S', 'inner-w': 'Inner W',
};

const INITIAL_RING_SLOTS = Object.fromEntries(ELEMENT_SLOT_IDS.map(id => [id, null]));
const INITIAL_CARD_SLOTS = Object.fromEntries(CARD_SLOT_IDS.map(id => [id, null]));

// ── Visual assets ─────────────────────────────────────────────────────────────
import _cindergust from '../assets/cards/charms/cindergust.webp';
import _stormlash  from '../assets/cards/charms/stormlash.webp';
import _tidereed   from '../assets/cards/charms/tidereed.webp';
import _bloomtide  from '../assets/cards/charms/bloomtide.webp';
import _galebolt   from '../assets/cards/charms/galebolt.webp';
import _voidtide   from '../assets/cards/charms/voidtide.webp';
import _dawnseal   from '../assets/cards/charms/dawnseal.webp';
import _starveil   from '../assets/cards/charms/starveil.webp';

const ITEM_ART = {
  'smoldering-charm': _cindergust, 'jolting-charm': _stormlash,
  'flowing-charm': _tidereed,     'blooming-charm': _bloomtide,
  'gusting-charm': _galebolt,     'hollowing-charm': _voidtide,
  'gleaming-charm': _dawnseal,    'ascending-charm': _starveil,
};

const MOTE_ART = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/elements/motes/*.webp', { eager: true, import: 'default' }))
    .map(([path, src]) => [path.split('/').pop().replace(/\s+mote\.webp$/i, '').toLowerCase(), src]),
);

const WISP_ART = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/elements/wisps/*.webp', { eager: true, import: 'default' }))
    .map(([path, src]) => [path.split('/').pop().replace(/\s+wisp\.webp$/i, '').toLowerCase(), src]),
);

const ESSENCE_ART = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/elements/essences/*.webp', { eager: true, import: 'default' }))
    .map(([path, src]) => [path.split('/').pop().replace(/\s+essence\.webp$/i, '').toLowerCase(), src]),
);

const QUINTESSENCE_ART = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/elements/quintessences/*.webp', { eager: true, import: 'default' }))
    .map(([path, src]) => [path.split('/').pop().replace(/\s+quin?tessence\.webp$/i, '').toLowerCase(), src]),
);

const TIER_ART = {
  mote: MOTE_ART,
  wisp: WISP_ART,
  essence: ESSENCE_ART,
  quintessence: QUINTESSENCE_ART,
};

// ── Gothic rune decoration ────────────────────────────────────────────────────
const GOTHIC_OUTER  = ['𐌰','𐌱','𐌲','𐌳','𐌴','𐌵','𐌶','𐌷','𐌸','𐌹','𐌺','𐌻','𐌼','𐌽','𐌾','𐌿','𐍀','𐍂','𐍃','𐍄','𐍅','𐍆','𐍇','𐍈','𐍉'];
const GOTHIC_INNER  = ['𐍃','𐍄','𐍅','𐍆','𐍇','𐍈','𐍉','𐌰','𐌲','𐌴','𐌶','𐌸','𐌺','𐌼','𐌾','𐌹','𐌻','𐌿'];
const TURKIC_LINE   = '𐰀 𐰃 𐰆 𐰉 𐰌 𐰏 𐰒 𐰕 𐰘 𐰛 𐰞 𐰡 𐰤 𐰧 𐰪 𐰭 𐰰 𐰳 𐰶 𐰹 𐰼 𐰿 𐱂 𐱅 𐱈 '.repeat(8);
const TABLE_RING_RUNES = ['ᚠ','ᚨ','ᛁ','ᚾ','ᛗ','ᛟ','⩔','𐌘','ᚱ','ᛊ','ᛞ','ᚷ','ᚲ','ᛚ','ᛈ','ᚩ'];

// ── Sub-components ────────────────────────────────────────────────────────────
function EmptySlotPlaceholder({ label, type = 'element' }) {
  return (
    <div className={`arcana-ring-empty-slot arcana-ring-empty-slot--${type}`}>
      <span className="arcana-ring-empty-slot__label">{label}</span>
    </div>
  );
}

function fmtCount(count) {
  return new Intl.NumberFormat('en-US').format(count ?? 0);
}

function SlotResourceCard({ essence, resourceId, tier, count }) {
  const artSrc = TIER_ART[tier]?.[essence.id] ?? null;

  return (
    <div
      className="card-face-wrapper no-twirl foundry-square-resource foundry-square-resource--owned arcana-ring-slot-resource-card"
      data-arcana-resource-id={resourceId}
      style={{ '--glow-color': essence.color }}
    >
      <div className="card-face-inner">
        <div className="card-face-front foundry-square-resource__front">
          <div className="foundry-square-resource__header foundry-square-resource__header--count-only">
            <span className="foundry-square-resource__count">{fmtCount(count)}</span>
          </div>
          <div className="foundry-square-resource__art-wrap">
            {artSrc ? <img src={artSrc} alt={essence.name} className="foundry-square-resource__art" /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Arcana({
  resources,
  pocket = [],
  onRingCraft,
  carriedResource = null,
  onPlaceCarriedResource = null,
}) {
  const [ringSlots, setRingSlots] = useState(INITIAL_RING_SLOTS);
  const [cardSlots, setCardSlots] = useState(INITIAL_CARD_SLOTS);
  const [dragOverElementSlot, setDragOverElementSlot] = useState(null);
  const [craftResult, setCraftResult] = useState(null);
  const [craftAnimating, setCraftAnimating] = useState(false);
  const [tooltip, setTooltip] = useState(null);
  const tableRef = useRef(null);

  // ── Pattern matching ──────────────────────────────────────────────────────
  const matchedRecipe = useMemo(() => {
    const filled = Object.fromEntries(
      Object.entries(ringSlots)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => [k, v.elementId]),
    );
    for (const recipe of RING_RECIPES) {
      const patternKeys = Object.keys(recipe.pattern);
      if (patternKeys.length !== Object.keys(filled).length) continue;
      if (patternKeys.every(slotId => filled[slotId] === recipe.pattern[slotId])) return recipe;
    }
    return null;
  }, [ringSlots]);

  const arcanaItem = matchedRecipe ? ARCANA_ITEMS_BY_ID[matchedRecipe.id] : null;
  const artSrc     = arcanaItem ? (ITEM_ART[arcanaItem.id] ?? null) : null;

  // ── Mage requirement ──────────────────────────────────────────────────────
  const mageCount        = pocket.filter(c => c.classType === 'mage').length;
  const requiredMages    = matchedRecipe?.mages ?? 0;
  const mageRequirementMet = requiredMages === 0 || mageCount >= requiredMages;

  // ── Resource availability for placed elements ────────────────────────────
  const placedResources = useMemo(() => {
    const counts = {};
    for (const v of Object.values(ringSlots)) {
      if (!v) continue;
      counts[v.resourceId] = (counts[v.resourceId] ?? 0) + 1;
    }
    return counts;
  }, [ringSlots]);

  const resourcesAvailable = useMemo(
    () => Object.entries(placedResources).every(([id, needed]) => (resources?.[id] ?? 0) >= needed),
    [placedResources, resources],
  );

  const canCraft = Boolean(matchedRecipe) && mageRequirementMet && resourcesAvailable && !craftAnimating;

  // ── Ring activation level ─────────────────────────────────────────────────
  const filledCount  = Object.values(ringSlots).filter(Boolean).length;
  const ringLevel    = filledCount / 8;
  const ringActive   = ringLevel > 0;
  const ringDuration = ringLevel > 0 ? 12 / ringLevel : 12;

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleElementSlotClick(slotId) {
    if (ringSlots[slotId]) {
      setRingSlots(prev => ({ ...prev, [slotId]: null }));
    }
    setCraftResult(null);
  }

  function handleElementSlotDrop(slotId, event) {
    event.preventDefault();
    setDragOverElementSlot(current => (current === slotId ? null : current));
    const resourceId = event.dataTransfer.getData('arcana-resource-id');
    if (!resourceId) return;
    const { elementId, tier } = parseElementResourceId(resourceId);
    const essence = ESSENCES_BY_ID[elementId];
    const isCarriedDrag = carriedResource?.source === 'arcana'
      && carriedResource.id === resourceId
      && carriedResource.count > 0;
    // A Bag drag reserves the stack at dragstart, so its inventory count may be zero by the time it
    // reaches the ring. The carried stack is authoritative for that path; the inventory count remains
    // the guard for older/direct Arcana drags.
    if (!essence || (!isCarriedDrag && (resources?.[resourceId] ?? 0) <= 0)) return;
    setRingSlots(prev => ({ ...prev, [slotId]: { elementId, tier, resourceId } }));
    setCraftResult(null);
    if (isCarriedDrag) onPlaceCarriedResource?.({ source: 'arcana', id: resourceId });
  }

  function handlePlaceCarriedArcanaResource(slotId, event) {
    if (!carriedResource || carriedResource.source !== 'arcana') return;
    const parsed = parseElementResourceId(carriedResource.id);
    const essence = ESSENCES_BY_ID[parsed.elementId];
    if (!essence || carriedResource.count <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    setRingSlots(prev => ({
      ...prev,
      [slotId]: {
        elementId: parsed.elementId,
        tier: parsed.tier,
        resourceId: carriedResource.id,
      },
    }));
    setCraftResult(null);
    onPlaceCarriedResource?.({ source: 'arcana', id: carriedResource.id });
  }

  function handleCardSlotDrop(slotId, e) {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('text/plain');
    const card = pocket.find(c => String(c.id) === String(cardId));
    if (!card || card.classType !== 'mage') return;
    // Prevent same card in multiple slots
    const alreadySlotted = Object.values(cardSlots).some(v => v && String(v.id) === String(card.id));
    if (alreadySlotted) return;
    setCardSlots(prev => ({ ...prev, [slotId]: card }));
  }

  function handleClearCardSlot(slotId) {
    setCardSlots(prev => ({ ...prev, [slotId]: null }));
  }

  function handleCraft() {
    if (!canCraft || !matchedRecipe || !onRingCraft) return;
    setCraftAnimating(true);
    const resourceIds = Object.values(ringSlots).filter(Boolean).map(v => v.resourceId);
    const result = onRingCraft(matchedRecipe.id, resourceIds);
    setCraftResult(result);
    if (result?.ok) {
      setTimeout(() => {
        setRingSlots({ ...INITIAL_RING_SLOTS });
        setCardSlots({ ...INITIAL_CARD_SLOTS });
        setCraftAnimating(false);
        setCraftResult(null);
      }, 1200);
    } else {
      setCraftAnimating(false);
    }
  }

  function handleClearAll() {
    setRingSlots({ ...INITIAL_RING_SLOTS });
    setCardSlots({ ...INITIAL_CARD_SLOTS });
    setDragOverElementSlot(null);
    setCraftResult(null);
  }

  // ── Tooltip ───────────────────────────────────────────────────────────────
  function showTooltip(e, title, tag, body, dir = 'above') {
    const r = e.currentTarget.getBoundingClientRect();
    const GAP = 10;
    let x, y;
    if (dir === 'above') { x = r.left + r.width / 2; y = r.top - GAP; }
    else if (dir === 'right') { x = r.right + GAP; y = r.top + r.height / 2; }
    else { x = r.right + GAP; y = r.top + r.height / 2; }
    setTooltip({ title, tag, body, x, y, dir });
  }
  function hideTooltip() { setTooltip(null); }

  // ── Render helpers ────────────────────────────────────────────────────────
  function renderElementSlot(slotId) {
    const value   = ringSlots[slotId];
    const essence = value ? ESSENCES_BY_ID[value.elementId] : null;
    const dragActive = dragOverElementSlot === slotId;

    return (
      <button
        key={slotId}
        type="button"
        data-resource-drop-target="arcana-ring-slot"
        className={[
          'arcana-ring-slot',
          'arcana-ring-slot--element',
          value  ? 'arcana-ring-slot--filled' : 'arcana-ring-slot--empty',
          dragActive ? 'arcana-ring-slot--drag-target' : '',
        ].filter(Boolean).join(' ')}
        style={{ gridArea: SLOT_GRID_AREA[slotId] }}
        onClick={() => handleElementSlotClick(slotId)}
        onPointerDown={event => handlePlaceCarriedArcanaResource(slotId, event)}
        onDragOver={e => {
          if (e.dataTransfer.types.includes('arcana-resource-id')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            setDragOverElementSlot(slotId);
          }
        }}
        onDragLeave={() => setDragOverElementSlot(current => (current === slotId ? null : current))}
        onDrop={e => handleElementSlotDrop(slotId, e)}
        onMouseEnter={value && essence ? e => showTooltip(
          e,
          `${essence.name} ${value.tier.charAt(0).toUpperCase() + value.tier.slice(1)}`,
          essence.family,
          'Click to remove',
          'above',
        ) : undefined}
        onMouseLeave={hideTooltip}
        aria-label={value ? `${value.elementId} ${value.tier} – click to remove` : `${SLOT_HINT[slotId]} – drag Arcana resource here`}
      >
        {value && essence ? (
          <SlotResourceCard
            essence={essence}
            resourceId={value.resourceId}
            tier={value.tier}
            count={resources?.[value.resourceId] ?? 0}
          />
        ) : (
          <EmptySlotPlaceholder label={SLOT_HINT[slotId]} />
        )}
      </button>
    );
  }

  function renderCardSlot(slotId) {
    const card = cardSlots[slotId];
    return (
      <div
        key={slotId}
        className={[
          'arcana-ring-slot',
          'arcana-ring-slot--card',
          card ? 'arcana-ring-slot--filled' : 'arcana-ring-slot--empty',
        ].filter(Boolean).join(' ')}
        style={{ gridArea: SLOT_GRID_AREA[slotId] }}
        onDragOver={e => {
          const draggingCardId = e.dataTransfer.types.includes('text/plain');
          if (draggingCardId) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
        }}
        onDrop={e => handleCardSlotDrop(slotId, e)}
      >
        {card ? (
          <div className="arcana-ring-card-slot-inner">
            <CardFace card={card} visualMode="compact" className="arcana-ring-card-face no-twirl" />
            <button
              className="arcana-ring-card-remove"
              onClick={() => handleClearCardSlot(slotId)}
              aria-label={`Remove ${card.name} from ring`}
            >✕</button>
          </div>
        ) : (
          <EmptySlotPlaceholder label={`Mage ${CARD_SLOT_LABEL[slotId]}`} type="card" />
        )}
      </div>
    );
  }

  return (
    <div className="arcana">
      <div className="foundry-header arcana-page-header">
        <h2 className="foundry-title">Arcana Station</h2>
        <p className="foundry-subtitle">
          Discover recipes by placing elements in the ring — different patterns yield different results.
        </p>
        {filledCount > 0 && (
          <button type="button" className="arcana-clear-btn" onClick={handleClearAll}>
            Clear ring
          </button>
        )}
      </div>

      {/* Fixed tooltip */}
      {tooltip && (
        <div
          className={`arcana-tt arcana-tt--fixed arcana-tt--${tooltip.dir}`}
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="arcana-tt-head">
            {tooltip.title && <span className="arcana-tt-title">{tooltip.title}</span>}
            {tooltip.tag   && <span className="arcana-tt-tag">{tooltip.tag}</span>}
          </div>
          {tooltip.body && <p className="arcana-tt-body">{tooltip.body}</p>}
        </div>
      )}

      <div className="arcana-ring-workspace">

        {/* ── Ring table ───────────────────────────────────────────────── */}
        <div className="arcana-crafting-table arcana-ring-table" ref={tableRef}>

          {/* Gothic bg rings */}
          <div className="arcana-table-bg-ring arcana-table-bg-ring--outer" style={{ '--total': GOTHIC_OUTER.length }} aria-hidden="true">
            {GOTHIC_OUTER.map((ch, i) => (
              <span key={i} className="arcana-table-bg-glyph" style={{ '--i': i }}><span>{ch}</span></span>
            ))}
          </div>
          <div className="arcana-table-bg-ring arcana-table-bg-ring--inner" style={{ '--total': GOTHIC_INNER.length }} aria-hidden="true">
            {GOTHIC_INNER.map((ch, i) => (
              <span key={i} className="arcana-table-bg-glyph" style={{ '--i': i }}><span>{ch}</span></span>
            ))}
          </div>

          {/* Turkic crosshair */}
          <div className="arcana-table-turkic-h" aria-hidden="true">{TURKIC_LINE}</div>
          <div className="arcana-table-turkic-v" aria-hidden="true">{TURKIC_LINE}</div>

          {/* Ambient rune ring */}
          <div
            className={`arcana-table-rune-ring${ringActive ? ' arcana-table-rune-ring--active' : ''}`}
            style={{ '--total': TABLE_RING_RUNES.length, '--ring-duration': `${ringDuration}s`, '--ring-intensity': ringLevel }}
            aria-hidden="true"
          >
            {TABLE_RING_RUNES.map((r, i) => (
              <span key={i} className="arcana-table-rune-ring-glyph" style={{ '--i': i }}><span>{r}</span></span>
            ))}
          </div>

          {/* ── Ring grid ─────────────────────────────────────────────── */}
          <div className="arcana-ring-grid">
            {/* Outer element slots */}
            {OUTER_SLOT_IDS.map(id => renderElementSlot(id))}

            {/* Inner element slots */}
            {INNER_SLOT_IDS.map(id => renderElementSlot(id))}

            {/* Card (mage) slots */}
            {CARD_SLOT_IDS.map(id => renderCardSlot(id))}

            {/* Center */}
            <div className="arcana-ring-center" style={{ gridArea: 'center' }}>
              {arcanaItem ? (
                <div className={`arcana-ring-center-matched${craftAnimating ? ' arcana-ring-center-matched--animating' : ''}`}>
                  {artSrc && <img src={artSrc} alt={arcanaItem.name} className="arcana-ring-center-art" />}
                  <span className="arcana-ring-center-category">{arcanaItem.category}</span>
                  <strong className="arcana-ring-center-name">{arcanaItem.name}</strong>
                </div>
              ) : (
                <div className="arcana-ring-center-idle">
                  <span className="arcana-ring-center-glyph" aria-hidden="true">⬡</span>
                  {filledCount > 0 && <span className="arcana-ring-center-hint">Unknown pattern</span>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Craft panel ────────────────────────────────────────────────── */}
        <div className={`arcana-ring-craft-panel${arcanaItem ? ' arcana-ring-craft-panel--matched' : ''}`}>
          {arcanaItem ? (
            <>
              <p className="arcana-ring-craft-desc">{arcanaItem.description}</p>

              <div className="arcana-mage-req">
                <span className="arcana-mage-req__label">
                  {requiredMages} Mage{requiredMages !== 1 ? 's' : ''} in Pocket required
                </span>
                <span className={`arcana-mage-req__count${mageRequirementMet ? ' arcana-mage-req__count--met' : ' arcana-mage-req__count--unmet'}`}>
                  {mageCount} / {requiredMages}
                </span>
              </div>

              {!resourcesAvailable && (
                <p className="arcana-ring-craft-warning">Not enough elements in inventory</p>
              )}

              <button
                type="button"
                className="arcana-craft-btn"
                onClick={handleCraft}
                disabled={!canCraft}
              >
                Craft {arcanaItem.name}
              </button>

              {craftResult?.ok === true  && <p className="arcana-craft-status arcana-craft-status--success">Crafted!</p>}
              {craftResult?.ok === false && <p className="arcana-craft-status arcana-craft-status--warning">Craft failed</p>}
            </>
          ) : (
            <p className="arcana-ring-craft-panel__hint">
              {filledCount === 0
                ? 'Drag Arcana resources from the main inventory into ring slots to discover recipes'
                : `${filledCount} element${filledCount !== 1 ? 's' : ''} placed — keep going`}
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
