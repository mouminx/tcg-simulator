import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PackCard from './PackCard';
import PackOpening from './PackOpening';
import { getPackTypeById } from '../game/cards';
import {
  assignInventoryItemToSlot,
  createEmptyAttunementLoadout,
  removeSlottedItem,
  validateAttunementLoadout,
  ATTUNEMENT_SLOT_RULES,
} from '../game/arcanaAttunement';
import { ARCANA_ITEMS_BY_ID, ESSENCES_BY_ID } from '../game/arcana';

// Charm artwork — mirrors Arcana.jsx imports
import _cindergust from '../assets/cards/charms/cindergust.webp';
import _stormlash  from '../assets/cards/charms/stormlash.webp';
import _tidereed   from '../assets/cards/charms/tidereed.webp';
import _bloomtide  from '../assets/cards/charms/bloomtide.webp';
import _galebolt   from '../assets/cards/charms/galebolt.webp';
import _voidtide   from '../assets/cards/charms/voidtide.webp';
import _dawnseal   from '../assets/cards/charms/dawnseal.webp';
import _starveil   from '../assets/cards/charms/starveil.webp';

const CHARM_ART = {
  'smoldering-charm': _cindergust,
  'jolting-charm':    _stormlash,
  'flowing-charm':    _tidereed,
  'blooming-charm':   _bloomtide,
  'gusting-charm':    _galebolt,
  'hollowing-charm':  _voidtide,
  'gleaming-charm':   _dawnseal,
  'ascending-charm':  _starveil,
};

// Module-level drag state (one drag at a time)
let _draggingPack = null;

// Order to pick next pack: lowest → highest rarity/cost
const PACK_TYPE_ORDER = ['dusk', 'iron', 'blankSlate', 'treasure', 'arcane', 'void', 'primordial'];

function getNextPack(packs) {
  for (const typeId of PACK_TYPE_ORDER) {
    const pack = packs.find(p => p.packTypeId === typeId);
    if (pack) return pack;
  }
  return packs[0] ?? null;
}

function FlyingPack({ packType, startX, startY, endX, endY, onDone }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition =
          'left 0.52s cubic-bezier(0.4,0,0.2,1), top 0.52s cubic-bezier(0.4,0,0.2,1), transform 0.52s cubic-bezier(0.4,0,0.2,1)';
        el.style.left = `${endX}px`;
        el.style.top = `${endY}px`;
        el.style.transform = 'translate(-50%,-50%) scale(1)';
      });
    });
    const t = setTimeout(onDone, 560);
    return () => clearTimeout(t);
  }, []);

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: startX,
        top: startY,
        transform: 'translate(-50%,-50%) scale(0.55)',
        transformOrigin: 'center center',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <PackCard size="md" packType={packType} />
    </div>,
    document.body
  );
}

// ── Slot config ────────────────────────────────────────────────────────────────

const SLOT_ORDER = ['calling', 'surge', 'inscription'];
const SLOT_ACCEPTED_CATEGORY = { calling: 'charm', surge: 'catalyst', inscription: 'sigil' };
const SLOT_RUNE = { calling: 'ᚨ', surge: 'ᚲ', inscription: 'ᛊ' };

// ── Effect description helpers ─────────────────────────────────────────────────

const TAG_COLORS = {
  holo: '#59d9ff', foil: '#d8dee8', reverse: '#ff87d2',
  shadow: '#8d87ff', nexus: '#b45cff', prismatic: '#ff73f1', firstEdition: '#ffd84d',
};

function formatTagName(tag) {
  if (tag === 'firstEdition') return 'First Edition';
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

function getEffectTags(loadout) {
  const tags = [];
  for (const slotId of SLOT_ORDER) {
    const item = loadout?.[slotId];
    if (!item) continue;
    const arcanaItem = ARCANA_ITEMS_BY_ID[item.itemId];
    if (!arcanaItem) continue;
    const { effect } = arcanaItem;
    if (effect.bias === 'element') {
      const ess = ESSENCES_BY_ID[effect.targetEssenceId];
      tags.push({
        slotId,
        label: `Higher chance for ${effect.targetFamily} creatures`,
        color: ess?.color ?? '#e2c870',
      });
    } else if (effect.bias === 'tier') {
      const tierColors = { 2: '#94a3b8', 3: '#fbbf24', 4: '#f0abfc', 5: '#ff4268' };
      tags.push({
        slotId,
        label: `Higher chance for Tier ${effect.targetTier}+ value`,
        color: tierColors[effect.targetTier] ?? '#94a3b8',
      });
    } else if (effect.bias === 'tag') {
      const tagName = formatTagName(effect.targetTag);
      tags.push({
        slotId,
        label: `Higher chance for ${tagName} treatment`,
        color: TAG_COLORS[effect.targetTag] ?? '#a78bfa',
      });
    }
  }
  return tags;
}

function getItemTooltipBody(groupEntry) {
  const arcanaItem = ARCANA_ITEMS_BY_ID[groupEntry.itemId];
  if (!arcanaItem?.effect) return '';
  const { effect } = arcanaItem;
  if (effect.bias === 'element') return `Higher chance for ${effect.targetFamily} creatures`;
  if (effect.bias === 'tier')    return `Higher chance for Tier ${effect.targetTier}+ value`;
  if (effect.bias === 'tag') {
    const tagName = formatTagName(effect.targetTag);
    return `Higher chance for ${tagName} treatment`;
  }
  return '';
}

// ── SummoningField ─────────────────────────────────────────────────────────────

function SummoningField({
  staged,        // null | { pack, packType }
  isBlankSlate,
  loadout,
  inventory,
  onPackDrop,
  onAssign,
  onRemove,
  onConfirm,
  onCancel,
}) {
  const [dragOverField, setDragOverField] = useState(false);
  const [dragOverSlot, setDragOverSlot] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const dragItemRef = useRef(null);

  function showInvTooltip(e, groupEntry) {
    const r = e.currentTarget.getBoundingClientRect();
    setTooltip({
      title: groupEntry.name,
      tag: groupEntry.category,
      body: getItemTooltipBody(groupEntry),
      x: r.right + 10,
      y: r.top + r.height / 2,
    });
  }
  function hideInvTooltip() { setTooltip(null); }

  const isIdle = !staged;
  const effectTags = isBlankSlate ? getEffectTags(loadout) : [];

  // Group inventory by itemId for display
  const slottedIds = new Set(
    Object.values(loadout ?? {})
      .filter(Boolean)
      .map(s => s.inventoryEntryId)
  );

  const inventoryGrouped = inventory.reduce((acc, item) => {
    if (!acc[item.itemId]) {
      acc[item.itemId] = { ...item, count: 0, available: [] };
    }
    acc[item.itemId].count++;
    if (!slottedIds.has(item.inventoryEntryId)) {
      acc[item.itemId].available.push(item);
    }
    return acc;
  }, {});

  const charms = Object.values(inventoryGrouped).filter(i => i.category === 'charm');
  const catalysts = Object.values(inventoryGrouped).filter(i => i.category === 'catalyst');
  const sigils = Object.values(inventoryGrouped).filter(i => i.category === 'sigil');
  const hasAnyItems = inventory.length > 0;

  // ── Drag handlers ──

  function handleItemDragStart(e, groupEntry) {
    const entry = groupEntry.available[0];
    if (!entry) { e.preventDefault(); return; }
    dragItemRef.current = entry;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', entry.inventoryEntryId);
  }

  function handleItemDragEnd() {
    dragItemRef.current = null;
    setDragOverSlot(null);
  }

  function handleSlotDragOver(e, slotId) {
    const item = dragItemRef.current;
    if (!item) {
      // might be a pack drag — allow field-level handling
      return;
    }
    if (item.category !== SLOT_ACCEPTED_CATEGORY[slotId]) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOverSlot(slotId);
  }

  function handleSlotDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverSlot(null);
    }
  }

  function handleSlotDrop(e, slotId) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSlot(null);
    const item = dragItemRef.current;
    if (!item || item.category !== SLOT_ACCEPTED_CATEGORY[slotId]) return;
    onAssign(slotId, item);
    dragItemRef.current = null;
  }

  // Field-level drag (for pack drops)
  function handleFieldDragOver(e) {
    if (_draggingPack && !staged) {
      e.preventDefault();
      setDragOverField(true);
    }
  }

  function handleFieldDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverField(false);
    }
  }

  function handleFieldDrop(e) {
    e.preventDefault();
    setDragOverField(false);
    if (_draggingPack && !staged) {
      const pack = _draggingPack;
      _draggingPack = null;
      onPackDrop(pack);
    }
  }

  // Click to assign (routes by category)
  function handleItemClick(groupEntry) {
    const entry = groupEntry.available[0];
    if (!entry) return;
    const slotId = SLOT_ORDER.find(sid => SLOT_ACCEPTED_CATEGORY[sid] === entry.category);
    if (slotId) onAssign(slotId, entry);
  }

  return (
    <>
    {tooltip && createPortal(
      <div
        className="arcana-tt--fixed arcana-tt--right"
        style={{ left: tooltip.x, top: tooltip.y }}
      >
        <div className="arcana-tt-head">
          <strong className="arcana-tt-title">{tooltip.title}</strong>
          {tooltip.tag && <span className="arcana-tt-tag">{tooltip.tag}</span>}
        </div>
        {tooltip.body && <p className="arcana-tt-body">{tooltip.body}</p>}
      </div>,
      document.body
    )}
    <div
      className={[
        'summon-field',
        isIdle ? 'summon-field--idle' : 'summon-field--active',
        dragOverField ? 'summon-field--dragover' : '',
      ].filter(Boolean).join(' ')}
      onDragOver={handleFieldDragOver}
      onDragLeave={handleFieldDragLeave}
      onDrop={handleFieldDrop}
    >
      {/* ── Left: Attunement Slots + Inventory ── */}
      <div className={`summon-col summon-col--left${!isBlankSlate && !isIdle ? ' summon-col--inactive' : ''}`}>
        <div className="summon-col-header">
          <span className="summon-col-rune">ᚨ</span>
          <span>Attunement</span>
        </div>

        {isIdle ? (
          <p className="summon-col-idle-hint">Slot items to attune a Blank Slate pack</p>
        ) : !isBlankSlate ? (
          <p className="summon-col-idle-hint">Attunement requires a Blank Slate pack</p>
        ) : (
          <>
            {/* Slots */}
            <div className="summon-slots">
              {SLOT_ORDER.map(slotId => {
                const slotRule = ATTUNEMENT_SLOT_RULES[slotId];
                const slottedItem = loadout?.[slotId];
                const isDragOver = dragOverSlot === slotId;
                return (
                  <div
                    key={slotId}
                    className={[
                      'summon-slot',
                      slottedItem ? 'summon-slot--filled' : '',
                      isDragOver ? 'summon-slot--dragover' : '',
                    ].filter(Boolean).join(' ')}
                    onDragOver={e => handleSlotDragOver(e, slotId)}
                    onDragLeave={handleSlotDragLeave}
                    onDrop={e => handleSlotDrop(e, slotId)}
                  >
                    <div className="summon-slot-head">
                      <span className="summon-slot-rune">{SLOT_RUNE[slotId]}</span>
                      <span className="summon-slot-label">
                        {slotRule.label.replace(' slot', '')}
                      </span>
                    </div>
                    {slottedItem ? (
                      <div className="summon-slot-filled-row">
                        <span className="summon-slot-item-name">{slottedItem.name}</span>
                        <button
                          className="summon-slot-clear"
                          onClick={() => onRemove(slotId)}
                          title="Remove"
                        >×</button>
                      </div>
                    ) : (
                      <span className="summon-slot-hint">
                        Drop {SLOT_ACCEPTED_CATEGORY[slotId]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Inventory */}
            {hasAnyItems && (
              <div className="summon-inventory">
                <div className="summon-inventory-divider">
                  <span>Items</span>
                </div>

                {/* Charms — show with artwork */}
                {charms.length > 0 && (
                  <div className="summon-inv-charm-grid">
                    {charms.map(g => {
                      const art = CHARM_ART[g.itemId];
                      const isUnavailable = g.available.length === 0;
                      return (
                        <div
                          key={g.itemId}
                          className={[
                            'summon-inv-charm',
                            isUnavailable ? 'summon-inv-charm--slotted' : '',
                          ].filter(Boolean).join(' ')}
                          draggable={!isUnavailable}
                          onDragStart={e => handleItemDragStart(e, g)}
                          onDragEnd={handleItemDragEnd}
                          onClick={() => handleItemClick(g)}
                          onMouseEnter={e => showInvTooltip(e, g)}
                          onMouseLeave={hideInvTooltip}
                        >
                          {art && (
                            <div className="summon-inv-charm-art">
                              <img src={art} alt={g.name} />
                            </div>
                          )}
                          <span className="summon-inv-charm-count">{g.count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Catalysts + Sigils — text rows */}
                {[...catalysts, ...sigils].map(g => {
                  const isUnavailable = g.available.length === 0;
                  return (
                    <div
                      key={g.itemId}
                      className={[
                        'summon-inv-row',
                        isUnavailable ? 'summon-inv-row--slotted' : '',
                      ].filter(Boolean).join(' ')}
                      draggable={!isUnavailable}
                      onDragStart={e => handleItemDragStart(e, g)}
                      onDragEnd={handleItemDragEnd}
                      onClick={() => handleItemClick(g)}
                      onMouseEnter={e => showInvTooltip(e, g)}
                      onMouseLeave={hideInvTooltip}
                    >
                      <span className="summon-inv-row-name">{g.name}</span>
                      <span className="summon-inv-row-count">{g.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Center: Pack + Actions ── */}
      <div className="summon-col summon-col--center">
        {isIdle ? (
          <div className="summon-drop-zone">
            <div className="summon-drop-rune">ᛟ</div>
            <p className="summon-drop-label">Drop a pack to summon</p>
            <p className="summon-drop-sub">or click a pack above</p>
          </div>
        ) : (
          <>
            <div className="summon-pack-wrap">
              <PackCard size="md" packType={staged.packType} />
            </div>
            <div className="summon-actions">
              <button className="summon-btn summon-btn--back" onClick={onCancel}>
                Back
              </button>
              <button className="summon-btn summon-btn--primary" onClick={onConfirm}>
                {isBlankSlate ? 'Summon' : 'Open Pack'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Right: Effect Descriptions ── */}
      <div className={`summon-col summon-col--right${!isBlankSlate && !isIdle ? ' summon-col--inactive' : ''}`}>
        <div className="summon-col-header">
          <span className="summon-col-rune">ᛞ</span>
          <span>Effects</span>
        </div>

        {isIdle || !isBlankSlate ? (
          <p className="summon-col-idle-hint">
            {isIdle
              ? 'Active attunements appear here'
              : 'Attunement effects apply to Blank Slate packs only'}
          </p>
        ) : effectTags.length === 0 ? (
          <p className="summon-col-idle-hint">Slot items on the left to apply effects</p>
        ) : (
          <div className="summon-effects-list">
            {effectTags.map(tag => (
              <div
                key={tag.slotId}
                className="summon-effect-tag"
                style={{ '--tag-accent': tag.color }}
              >
                <span className="summon-effect-tag-label">{tag.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
}

// ── Main UnpackPage ────────────────────────────────────────────────────────────

export default function UnpackPage({
  packs,
  arcanaInventory,
  pendingCards,
  pendingResourceCards,
  pendingEssenceDrops,
  pendingPackType,
  onOpenPack,
  onPackDone,
  onCoinPop,
  collectionBtnRef,
  inventoryTargetRef,
  /** The pack fan, so the shop's shelves can fly a purchase to where it actually lands. */
  packFanRef = null,
}) {
  const [flyingPack, setFlyingPack] = useState(null);
  const [hiddenPackId, setHiddenPackId] = useState(null);
  const [showNextPrompt, setShowNextPrompt] = useState(false);
  const [stagedPack, setStagedPack] = useState(null); // { pack, packType }
  const [draftLoadout, setDraftLoadout] = useState(() => createEmptyAttunementLoadout());
  const packItemRefs = useRef({});
  const fieldRef = useRef(null);
  const packOpeningRef = useRef(null);

  const isOpening = pendingCards.length > 0 || pendingResourceCards.length > 0;
  const isBlankSlate = stagedPack?.pack.packTypeId === 'blankSlate';
  const attunementValidation = validateAttunementLoadout(
    draftLoadout, arcanaInventory, { requireAllSlotsFilled: false }
  );
  const busy = !!flyingPack || isOpening || !!stagedPack;

  /**
   * The fan's arc, sized to the row it is actually in.
   *
   * `RADIUS` was a flat 600 with a spread up to 60 degrees, which puts the outermost pack
   * `sin(30°) × 600 = 300px` off centre — a 600px-wide fan plus the pack itself. That was fine while
   * Summon was its own full-width page. It is now the right column of the shop, so a fixed radius sends
   * the end packs straight out of the column.
   *
   * Solved for the radius that fits instead of picking one: the fan's span is
   * `2 · sin(spread/2) · RADIUS + PACK_W`, so the widest radius the row can hold is
   * `(width − PACK_W) / (2 · sin(spread/2))`. Capped at the original 600 so a wide window looks exactly
   * as it did, and floored so a very narrow column flattens the arc rather than inverting it.
   */
  const [fanWidth, setFanWidth] = useState(0);
  const packRowRef = useRef(null);
  useEffect(() => {
    const el = packRowRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => {
      const width = Math.round(entries[0].contentRect.width);
      // Equality guard: writing state unconditionally from a ResizeObserver is how these turn into
      // feedback loops, since the write can change layout and re-fire the observer.
      setFanWidth(prev => (prev === width ? prev : width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const PACK_W = 110;
  const totalAngle = packs.length > 1 ? Math.min(60, (packs.length - 1) * 10) : 0;
  const RADIUS = (() => {
    if (!fanWidth || totalAngle <= 0) return 600;
    const halfSpread = Math.sin((totalAngle / 2) * Math.PI / 180);
    if (halfSpread <= 0) return 600;
    return Math.max(140, Math.min(600, (fanWidth - PACK_W) / (2 * halfSpread)));
  })();

  function stagePackObject(pack) {
    const packType = getPackTypeById(pack.packTypeId);
    setStagedPack({ pack, packType });
    setHiddenPackId(pack.id);
  }

  function handlePackClick(pack) {
    if (busy) return;
    setShowNextPrompt(false);

    const packEl = packItemRefs.current[pack.id];
    const fieldEl = fieldRef.current;
    const packType = getPackTypeById(pack.packTypeId);

    if (packEl && fieldEl) {
      const packRect = packEl.getBoundingClientRect();
      const fieldRect = fieldEl.getBoundingClientRect();
      setHiddenPackId(pack.id);
      setFlyingPack({
        pack,
        packType,
        startX: packRect.left + packRect.width / 2,
        startY: packRect.top + packRect.height / 2,
        endX: fieldRect.left + fieldRect.width / 2,
        endY: fieldRect.top + fieldRect.height / 2,
      });
      return;
    }

    stagePackObject(pack);
  }

  function handleFlyDone() {
    if (!flyingPack) return;
    const pack = flyingPack.pack;
    setFlyingPack(null);
    stagePackObject(pack);
  }

  function handleFieldPackDrop(pack) {
    if (busy) return;
    setShowNextPrompt(false);
    stagePackObject(pack);
  }

  function handlePackDragStart(e, pack) {
    _draggingPack = pack;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', pack.id);
  }

  function handlePackDragEnd() {
    _draggingPack = null;
  }

  function handleAssignAttunement(slotId, inventoryItem) {
    setDraftLoadout(current => {
      const result = assignInventoryItemToSlot(current, inventoryItem, slotId);
      return result.ok ? result.nextLoadout : current;
    });
  }

  function handleRemoveAttunement(slotId) {
    setDraftLoadout(current => removeSlottedItem(current, slotId).nextLoadout);
  }

  function handleCancelStaged() {
    setStagedPack(null);
    setHiddenPackId(null);
    setDraftLoadout(createEmptyAttunementLoadout());
  }

  function handleConfirm() {
    if (!stagedPack) return;
    if (isBlankSlate) {
      const packId = stagedPack.pack.id;
      const loadout = draftLoadout;
      const opened = onOpenPack(packId, { attunementLoadout: loadout });
      if (opened === false) return;
    } else {
      onOpenPack(stagedPack.pack.id);
    }
    setStagedPack(null);
    setHiddenPackId(null);
    setDraftLoadout(createEmptyAttunementLoadout());
  }

  function handlePackDone() {
    const hasMore = packs.length > 0;
    onPackDone();
    if (hasMore) setShowNextPrompt(true);
  }

  function handleUnpackNext() {
    const next = getNextPack(packs);
    if (next) handlePackClick(next);
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== 'u' && e.key !== 'U') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (isOpening) {
        packOpeningRef.current?.advance();
      } else if (showNextPrompt || (!busy && packs.length > 0)) {
        handleUnpackNext();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpening, showNextPrompt, busy, packs]);

  return (
    <div className="unpack-page">

      {/* Pack fan row — always rendered for layout stability */}
      <div
        ref={el => {
          packRowRef.current = el;
          if (packFanRef) packFanRef.current = el;
        }}
        className={`unpack-pack-row${busy ? ' unpack-pack-row--busy' : ''}${packs.length === 0 ? ' unpack-pack-row--empty' : ''}`}
      >
        {packs.length === 0 ? (
          <p className="unpack-pack-row-empty-hint">
            Acquire packs from the Shop to begin summoning
          </p>
        ) : packs.map((pack, i) => {
          const packType = getPackTypeById(pack.packTypeId);
          const isHidden = hiddenPackId === pack.id;
          const angle = packs.length > 1 ? (i / (packs.length - 1) - 0.5) * totalAngle : 0;
          const angleRad = angle * Math.PI / 180;
          const x = Math.sin(angleRad) * RADIUS;
          const y = (1 - Math.cos(angleRad)) * RADIUS;
          return (
            <div
              key={pack.id}
              ref={el => { packItemRefs.current[pack.id] = el; }}
              className={`unpack-pack-item${isHidden ? ' unpack-pack-item--hidden' : ''}`}
              style={{
                left: `calc(50% + ${x.toFixed(1)}px - ${PACK_W / 2}px)`,
                top: `${(y + 16).toFixed(1)}px`,
                zIndex: i + 1,
                '--pack-angle': `${angle.toFixed(1)}deg`,
              }}
              draggable={!busy}
              onDragStart={e => handlePackDragStart(e, pack)}
              onDragEnd={handlePackDragEnd}
              onClick={() => handlePackClick(pack)}
            >
              <PackCard size="sm" packType={packType} />
            </div>
          );
        })}
      </div>

      {/* Pack opening */}
      {isOpening && (
        <PackOpening
          ref={packOpeningRef}
          cards={pendingCards}
          resourceCards={pendingResourceCards}
          essenceDrops={pendingEssenceDrops}
          onDone={handlePackDone}
          onCoinPop={onCoinPop}
          collectionBtnRef={collectionBtnRef}
          inventoryTargetRef={inventoryTargetRef}
          packType={pendingPackType}
        />
      )}

      {/* Next prompt */}
      {showNextPrompt && (
        <div className="pack-opening">
          <p className="hint">&nbsp;</p>
          <div className="opening-stage">
            <div className="unpack-next-area">
              <p className="unpack-next-label">
                {packs.length} pack{packs.length !== 1 ? 's' : ''} remaining
              </p>
              <button className="unpack-next-btn summon-btn summon-btn--primary" onClick={handleUnpackNext}>
                Open Next Pack
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summoning field — always visible when not opening */}
      {!isOpening && !showNextPrompt && (
        <div ref={fieldRef} className="unpack-summon-field-wrap">
          <SummoningField
            staged={stagedPack}
            isBlankSlate={isBlankSlate}
            loadout={draftLoadout}
            inventory={arcanaInventory}
            onPackDrop={handleFieldPackDrop}
            onAssign={handleAssignAttunement}
            onRemove={handleRemoveAttunement}
            onConfirm={handleConfirm}
            onCancel={handleCancelStaged}
          />
        </div>
      )}

      {/* Flying pack portal */}
      {flyingPack && (
        <FlyingPack
          packType={flyingPack.packType}
          startX={flyingPack.startX}
          startY={flyingPack.startY}
          endX={flyingPack.endX}
          endY={flyingPack.endY}
          onDone={handleFlyDone}
        />
      )}
    </div>
  );
}
