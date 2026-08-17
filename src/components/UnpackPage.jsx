import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import PackCard from './PackCard';
import PackOpening from './PackOpening';
import { getPackTypeById, PACK_GROUPS, DEFAULT_PACK_GROUP, getPackGroup, getPackTile } from '../game/cards';
import { getResourceArt } from '../game/resourceArt';
import LootTile from './LootTile';
import {
  assignInventoryItemToSlot,
  createEmptyAttunementLoadout,
  removeSlottedItem,
  validateAttunementLoadout,
  ATTUNEMENT_SLOT_RULES,
} from '../game/arcanaAttunement';
import { ARCANA_ITEMS_BY_ID } from '../game/arcana';
import {
  getNextAttunementCost,
  getPackAttunementItemIds,
  MAX_PACK_ATTUNEMENTS,
} from '../game/arcanaPackOpening';

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

/**
 * A held openable, drawn the way its group declares (`PACK_GROUPS[].tile`).
 *
 * `pack` is the foil-wrapper graphic. `loot` is the square resource tile the Bag and the collection queues
 * use — because a treasure cache IS loot: it is the same object the Wilderness queue showed pending, with the
 * same artwork, and drawing it as a booster made it look like a card pack that opens into cards.
 *
 * Branching here rather than at each render site means the altar's row, the staged view, and anything added
 * later all agree, and a new group chooses its treatment once in `PACK_GROUPS`.
 */
function HeldOpenable({ packType, size }) {
  if (getPackTile(packType?.id) !== 'loot') {
    return <PackCard size={size} packType={packType} />;
  }
  return <LootTile artSrc={getResourceArt(packType?.artKey)} name={packType?.name ?? ''} size={size} />;
}

// ── Slot config ────────────────────────────────────────────────────────────────

const SLOT_ORDER = ['calling', 'surge', 'inscription'];
const SLOT_ACCEPTED_CATEGORY = { calling: 'charm', surge: 'catalyst', inscription: 'sigil' };
const SLOT_RUNE = { calling: 'ᚨ', surge: 'ᚲ', inscription: 'ᛊ' };

// ── Effect description helpers ─────────────────────────────────────────────────

function formatTagName(tag) {
  if (tag === 'firstEdition') return 'First Edition';
  return tag.charAt(0).toUpperCase() + tag.slice(1);
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
  onConfirmAttunement,
  onCancel,
  openingContent = null,
  showNextPrompt = false,
  remainingPacks = 0,
  onOpenNext,
  packTargetRef,
  balance = 0,
  carriedResource = null,
  onTakeCarriedAttunement,
}) {
  const [dragOverField, setDragOverField] = useState(false);
  const [dragOverSlot, setDragOverSlot] = useState(null);
  const [tooltip, setTooltip] = useState(null);

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

  const isIdle = !staged && !openingContent && !showNextPrompt;
  const confirmedItemIds = getPackAttunementItemIds(staged?.pack);
  const attunementCost = staged ? getNextAttunementCost(staged.pack) : null;
  const canAttune = isBlankSlate
    && confirmedItemIds.length < MAX_PACK_ATTUNEMENTS
    && attunementCost != null
    && balance >= attunementCost;
  const loadoutComplete = validateAttunementLoadout(
    loadout, inventory, { requireAllSlotsFilled: true }
  ).isComplete;

  // Group inventory by itemId for display
  // Items live in the Bag. The altar owns only the three square sockets, so it never grows a second,
  // cramped inventory strip and the user sees the same square card before and after placement.

  // ── Drag handlers ──

  function handleSlotDragOver(e, slotId) {
    if (!isBlankSlate) return;
    const item = carriedResource?.entries?.[0] ?? null;
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
    if (!isBlankSlate) return;
    const item = carriedResource?.entries?.[0] ?? null;
    if (!item || item.category !== SLOT_ACCEPTED_CATEGORY[slotId]) return;
    const assignedItem = onTakeCarriedAttunement?.(slotId);
    if (assignedItem) onAssign(slotId, assignedItem);
  }

  function handleSlotPointerDown(e, slotId) {
    if (!isBlankSlate) return;
    const item = carriedResource?.entries?.[0];
    if (!item || item.category !== SLOT_ACCEPTED_CATEGORY[slotId]) return;
    e.stopPropagation();
    const assignedItem = onTakeCarriedAttunement?.(slotId);
    if (assignedItem) onAssign(slotId, assignedItem);
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
      {/* Persistent top band: it never changes height while the pack moves through its opening phases. */}
      <div className={`summon-col summon-col--left${!isBlankSlate ? ' summon-col--inactive' : ''}`}>
        <div className="summon-col-header">
          <span className="summon-col-rune">ᚨ</span>
          <span>Attunement</span>
          <span className="summon-attunement-count">{confirmedItemIds.length}/{MAX_PACK_ATTUNEMENTS}</span>
        </div>

        {/* The apparatus is persistent even when this pack cannot use it. Removing the sockets made
            ordinary packs look as if attunement had disappeared rather than being incompatible. */}
        <div className="summon-slots">
          {SLOT_ORDER.map(slotId => {
            const slotRule = ATTUNEMENT_SLOT_RULES[slotId];
            const slottedItem = loadout?.[slotId];
            const isDragOver = dragOverSlot === slotId;
            return (
              <div
                key={slotId}
                data-resource-drop-target="summon-attunement-slot"
                data-attunement-slot-id={slotId}
                aria-disabled={!isBlankSlate}
                className={[
                  'summon-slot',
                  slottedItem ? 'summon-slot--filled' : '',
                  isDragOver ? 'summon-slot--dragover' : '',
                  !isBlankSlate ? 'summon-slot--locked' : '',
                ].filter(Boolean).join(' ')}
                onDragOver={e => handleSlotDragOver(e, slotId)}
                onDragLeave={handleSlotDragLeave}
                onDrop={e => handleSlotDrop(e, slotId)}
                onPointerDown={e => handleSlotPointerDown(e, slotId)}
              >
                <div className="summon-slot-head">
                  <span className="summon-slot-rune">{SLOT_RUNE[slotId]}</span>
                  <span className="summon-slot-label">
                    {slotRule.label.replace(' slot', '')}
                  </span>
                </div>
                {slottedItem ? (
                  <div className="summon-slot-filled-row">
                    {ARCANA_ITEMS_BY_ID[slottedItem.itemId]?.artKey && (
                      <img
                        className="summon-slot-item-art"
                        src={getResourceArt(ARCANA_ITEMS_BY_ID[slottedItem.itemId].artKey)}
                        alt=""
                      />
                    )}
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

        <div className="summon-attunement-controls">
          <div className="summon-attunement-pips" aria-label={`${confirmedItemIds.length} pack attunements`}>
            {Array.from({ length: MAX_PACK_ATTUNEMENTS }, (_, index) => {
              const itemId = confirmedItemIds[index];
              const item = itemId ? ARCANA_ITEMS_BY_ID[itemId] : null;
              return (
                <span
                  key={index}
                  className={`summon-attunement-pip${item ? ' summon-attunement-pip--filled' : ''}${item?.category ? ` summon-attunement-pip--${item.category}` : ''}`}
                  aria-label={item?.name ?? `Empty attunement ${index + 1}`}
                  onMouseEnter={item ? e => showInvTooltip(e, item) : undefined}
                  onMouseLeave={item ? hideInvTooltip : undefined}
                />
              );
            })}
          </div>
          <button
            className="summon-btn summon-btn--attune"
            disabled={!canAttune || !loadoutComplete}
            onClick={onConfirmAttunement}
          >
            {!isBlankSlate
              ? 'Blank Slate only'
              : confirmedItemIds.length >= MAX_PACK_ATTUNEMENTS
                ? 'Fully Attuned'
                : `Confirm · ${attunementCost ?? 0} gold`}
          </button>
        </div>
      </div>

      {/* Persistent middle: pack, full card reveal and action buttons all occupy this same box. */}
      <div ref={packTargetRef} className="summon-col summon-col--center">
        {openingContent ? openingContent : showNextPrompt ? (
          <div className="unpack-next-area">
            <p className="unpack-next-label">{remainingPacks} remaining</p>
            <button className="unpack-next-btn summon-btn summon-btn--primary" onClick={onOpenNext}>
              Open Next Pack
            </button>
          </div>
        ) : isIdle ? (
          <div className="summon-drop-zone">
            <div className="summon-drop-rune">ᛟ</div>
            <p className="summon-drop-label">Drop a pack to summon</p>
            <p className="summon-drop-sub">or click a pack above</p>
          </div>
        ) : (
          <>
            <div className={`summon-pack-wrap summon-pack-wrap--${getPackTile(staged.packType?.id)}`}>
              <HeldOpenable size="md" packType={staged.packType} />
            </div>
            <div className="summon-actions">
              <button className="summon-btn summon-btn--back" onClick={onCancel}>
                Back
              </button>
              <button className="summon-btn summon-btn--primary" onClick={onConfirm}>
                {isBlankSlate ? 'Summon Pack' : 'Open Pack'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Persistent bottom tray. During reveal PackOpening fills it with the horizontal card stack. */}
      {!openingContent && (
        <div className="summon-col summon-col--right summon-card-tray">
          <div className="summon-col-header"><span className="summon-col-rune">ᛞ</span><span>Revealed Cards</span></div>
          <p className="summon-col-idle-hint">
            Summoned cards collect here.
          </p>
        </div>
      )}
    </div>
    </>
  );
}

// ── Main UnpackPage ────────────────────────────────────────────────────────────

export default function UnpackPage({
  packs,
  balance,
  arcanaInventory,
  pendingCards,
  pendingResourceCards,
  pendingEssenceDrops,
  pendingPackType,
  onOpenPack,
  onConfirmAttunement,
  onPackDone,
  onCoinPop,
  collectionBtnRef,
  inventoryTargetRef,
  /** The pack fan, so the shop's shelves can fly a purchase to where it actually lands. */
  packFanRef = null,
  carriedResource = null,
  onTakeCarriedAttunement,
}) {
  const [hiddenPackId, setHiddenPackId] = useState(null);
  const [showNextPrompt, setShowNextPrompt] = useState(false);
  const [stagedPack, setStagedPack] = useState(null); // { pack, packType }
  /**
   * Which altar tab is showing. Not persisted — it is where the player is looking, the same reasoning as the
   * forge row selector. Defaults to Packs.
   */
  const [activeGroup, setActiveGroup] = useState(DEFAULT_PACK_GROUP);
  const [draftLoadout, setDraftLoadout] = useState(() => createEmptyAttunementLoadout());
  const fieldRef = useRef(null);
  const packTargetRef = useRef(null);
  const packOpeningRef = useRef(null);

  const isOpening = pendingCards.length > 0 || pendingResourceCards.length > 0;
  const isBlankSlate = stagedPack?.pack.packTypeId === 'blankSlate';
  const busy = isOpening || !!stagedPack;

  /**
   * The held packs are a STACKED HORIZONTAL LINE, not a fan.
   *
   * The fan positioned each pack on an arc — an angle, a radius, and a `left`/`top` per pack, with the
   * radius solved from the container so the end packs did not leave the column. All of that is gone. A line
   * of packs overlapping like a dealt row needs no geometry at all: the row is a flex line and the overlap
   * is a negative margin, so it reflows on resize with no measurement and no ResizeObserver.
   *
   * The overlap is a CSS custom property rather than a per-pack inline style, because every pack after the
   * first gets the same treatment — see `.unpack-pack-row--line` in App.css.
   */
  const packRowRef = useRef(null);

  /**
   * Held packs bucketed by group, so a tab knows its own count without re-filtering at every use site.
   * Built for EVERY group, including empty ones — a tab that vanishes when its last cache is opened would
   * take the only mention of Treasure with it, and a player would never learn the category exists.
   */
  const packsByGroup = useMemo(() => {
    const buckets = Object.fromEntries(PACK_GROUPS.map(g => [g.id, []]));
    for (const pack of packs) {
      const group = getPackGroup(pack.packTypeId);
      (buckets[group] ?? buckets[DEFAULT_PACK_GROUP]).push(pack);
    }
    return buckets;
  }, [packs]);

  const groupPacks = packsByGroup[activeGroup] ?? [];

  function stagePackObject(pack) {
    const packType = getPackTypeById(pack.packTypeId);
    setStagedPack({ pack, packType });
    setHiddenPackId(pack.id);
  }

  function handlePackClick(pack) {
    if (busy) return;
    setShowNextPrompt(false);
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
    const opened = onOpenPack(stagedPack.pack.id);
    if (opened === false) return;
    setStagedPack(null);
    setHiddenPackId(null);
    setDraftLoadout(createEmptyAttunementLoadout());
  }

  function handleConfirmAttunement() {
    if (!stagedPack || !isBlankSlate) return;
    const result = onConfirmAttunement?.(stagedPack.pack.id, draftLoadout);
    if (!result?.ok) return;
    setStagedPack(current => current ? { ...current, pack: result.pack } : current);
    setDraftLoadout(createEmptyAttunementLoadout());
  }

  function handlePackDone() {
    // Scoped to the visible tab. Against every held pack, finishing your last cache would offer "Open Next"
    // and then open a card pack from the other tab — something you cannot see and did not choose.
    const hasMore = groupPacks.length > 0;
    onPackDone();
    if (hasMore) setShowNextPrompt(true);
  }

  function handleUnpackNext() {
    const next = getNextPack(groupPacks);
    if (next) handlePackClick(next);
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== 'u' && e.key !== 'U') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (isOpening) {
        packOpeningRef.current?.advance();
      } else if (showNextPrompt || (!busy && groupPacks.length > 0)) {
        handleUnpackNext();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpening, showNextPrompt, busy, groupPacks]);

  return (
    <div className="unpack-page">
      <div className="unpack-topbar">
        {/* One tab per group of openable things. Every group is always listed, including empty ones: a tab
            that vanished with its last item would take the only mention of Treasure with it. */}
        <div className="unpack-groups" role="tablist" aria-label="Openable">
          {PACK_GROUPS.map(group => {
            const count = packsByGroup[group.id]?.length ?? 0;
            const active = group.id === activeGroup;
            return (
              <button
                key={group.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`unpack-group-tab${active ? ' unpack-group-tab--active' : ''}${count === 0 ? ' unpack-group-tab--empty' : ''}`}
                onClick={() => setActiveGroup(group.id)}
                disabled={busy}
              >
                <span className="unpack-group-tab__label">{group.label}</span>
                <span className="unpack-group-tab__count">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="shop-header unpack-header">
          <h2>Summon</h2>
        </div>

        {/* The held packs share the title band instead of forming a third compressed row underneath it. */}
        <div
          ref={el => {
            packRowRef.current = el;
            if (packFanRef) packFanRef.current = el;
          }}
          className={`unpack-pack-row unpack-pack-row--line stack-line${busy ? ' unpack-pack-row--busy' : ''}${groupPacks.length === 0 ? ' unpack-pack-row--empty' : ''}`}
          style={{ '--stack-gaps': Math.max(1, groupPacks.length - 1) }}
        >
          {groupPacks.length === 0 ? (
            <p className="unpack-pack-row-empty-hint">
              {PACK_GROUPS.find(g => g.id === activeGroup)?.empty ?? 'Nothing to open here yet.'}
            </p>
          ) : groupPacks.map((pack, i) => {
            const packType = getPackTypeById(pack.packTypeId);
            const tileKind = getPackTile(packType.id);
            const isHidden = hiddenPackId === pack.id;
            return (
              <div
                key={pack.id}
                className={`unpack-pack-item unpack-pack-item--${tileKind}${isHidden ? ' unpack-pack-item--hidden' : ''}`}
                style={{ zIndex: i + 1 }}
                draggable={!busy}
                onDragStart={e => handlePackDragStart(e, pack)}
                onDragEnd={handlePackDragEnd}
                onClick={() => handlePackClick(pack)}
              >
                <HeldOpenable size="sm" packType={packType} />
              </div>
            );
          })}
        </div>
      </div>

      {/* One altar shell for idle, staged, reveal, and open-next states. Only its contents change. */}
      <div ref={fieldRef} className="unpack-summon-field-wrap">
        <SummoningField
          staged={stagedPack}
          isBlankSlate={isBlankSlate}
          loadout={draftLoadout}
          inventory={arcanaInventory}
          balance={balance}
          carriedResource={carriedResource}
          onTakeCarriedAttunement={onTakeCarriedAttunement}
          packTargetRef={packTargetRef}
          openingContent={isOpening ? (
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
          ) : null}
          showNextPrompt={showNextPrompt}
          remainingPacks={groupPacks.length}
          onOpenNext={handleUnpackNext}
          onPackDrop={handleFieldPackDrop}
          onAssign={handleAssignAttunement}
          onRemove={handleRemoveAttunement}
          onConfirm={handleConfirm}
          onConfirmAttunement={handleConfirmAttunement}
          onCancel={handleCancelStaged}
        />
      </div>

    </div>
  );
}
