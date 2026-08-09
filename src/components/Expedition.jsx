import { useEffect, useMemo, useRef, useState } from 'react';

import CardFace from './CardFace';
import HoverCardPreview, { buildHoverCardPreview } from './HoverCardPreview';
import {
  EXPEDITION_DIFFICULTIES,
  EXPEDITION_SLOT_LIMITS,
  EXPEDITION_STATES,
  getExpeditionUpgradeCost,
  getExpeditionClassIcon,
} from '../game/expedition';
import { parseElementResourceId } from '../game/arcana';

const RESOURCE_ART = Object.fromEntries(
  Object.entries({
    ...import.meta.glob('../assets/resources/*.webp', { eager: true, import: 'default' }),
    ...import.meta.glob('../assets/ores/*.webp', { eager: true, import: 'default' }),
    ...import.meta.glob('../assets/ingots/*.webp', { eager: true, import: 'default' }),
    ...import.meta.glob('../assets/elements/**/*.webp', { eager: true, import: 'default' }),
    ...import.meta.glob('../assets/cards/charms/*.webp', { eager: true, import: 'default' }),
  }).map(([path, src]) => [path.split('/').pop().replace(/\.webp$/i, '').toLowerCase(), src]),
);

function fmtCount(count) {
  return new Intl.NumberFormat('en-US').format(count ?? 0);
}

function formatTimer(remainingMs) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getResourceArt(entry) {
  if (!entry) return null;
  const key = (entry.artKey ?? entry.id ?? entry.name ?? '').toLowerCase();
  if (RESOURCE_ART[key]) return RESOURCE_ART[key];
  const normalized = key.replace(/\s+ore$/i, '');
  if (RESOURCE_ART[normalized]) return RESOURCE_ART[normalized];
  const element = parseElementResourceId(entry.id ?? '');
  const elementKey = `${element.elementId} ${element.tier}`.toLowerCase();
  return RESOURCE_ART[elementKey] ?? null;
}

function getArcanaItemArt(slot) {
  const key = (slot.artKey ?? slot.itemId ?? '').toLowerCase();
  return RESOURCE_ART[key] ?? null;
}

function ExpeditionTag({ label, tone = 'neutral' }) {
  return <span className={`expedition-tag expedition-tag--${tone}`}>{label}</span>;
}

function UnitSlot({ slot, survivalChance = 0, dragOver = false, onDrop, onDragOver, onDragLeave, onClear, onPreviewEnter, onPreviewLeave, locked = false }) {
  const card = slot.card;
  return (
    <div
      className={[
        'expedition-unit-slot',
        card ? 'expedition-unit-slot--filled' : '',
        dragOver ? 'expedition-unit-slot--drag-over' : '',
        locked ? 'expedition-unit-slot--locked' : '',
      ].filter(Boolean).join(' ')}
      onDrop={locked ? undefined : onDrop}
      onDragOver={locked ? undefined : onDragOver}
      onDragLeave={locked ? undefined : onDragLeave}
    >
      {card ? (
        <>
          {!locked ? (
            <button className="expedition-slot-clear" onClick={onClear} aria-label={`Remove ${card.name}`}>
              ✕
            </button>
          ) : null}
          <div
            className="expedition-unit-slot__card"
            onMouseEnter={e => onPreviewEnter?.(e.currentTarget, card)}
            onMouseLeave={() => onPreviewLeave?.(card)}
          >
            <CardFace card={card} visualMode="compact" className="expedition-unit-slot__card-face no-twirl" />
            <span className="expedition-unit-slot__class-icon" aria-hidden="true">
              {getExpeditionClassIcon(card.classType)}
            </span>
            <span className="expedition-unit-slot__rarity-tier">
              {card.rarity} · T{card.tier}
            </span>
            <span className="expedition-unit-slot__survival">
              {survivalChance}%
            </span>
          </div>
        </>
      ) : (
        <div className="expedition-slot-empty">
          <span className="expedition-slot-empty__rune" aria-hidden="true">ᛟ</span>
          <span className="expedition-slot-empty__label">Drop Unit</span>
        </div>
      )}
    </div>
  );
}

function ResourceSlot({ slot, label, dragOver = false, locked = false, onPointerDown, onClear, type = 'supply' }) {
  const filled = Boolean(slot?.id || slot?.itemId);
  const artSrc = type === 'arcana' ? getArcanaItemArt(slot) : getResourceArt(slot);
  return (
    <div
      className={[
        'expedition-resource-slot',
        filled ? 'expedition-resource-slot--filled' : '',
        dragOver ? 'expedition-resource-slot--drag-over' : '',
        locked ? 'expedition-resource-slot--locked' : '',
      ].filter(Boolean).join(' ')}
      data-resource-drop-target={type === 'arcana' ? 'expedition-arcana-slot' : 'expedition-supply-slot'}
      data-expedition-slot-id={slot.slotId}
      onPointerDown={locked ? undefined : onPointerDown}
    >
      {filled ? (
        <>
          {!locked ? (
            <button className="expedition-slot-clear" onPointerDown={e => e.stopPropagation()} onClick={onClear} aria-label={`Remove ${slot.name}`}>
              ✕
            </button>
          ) : null}
          <div className="expedition-resource-slot__tile card-face-wrapper no-twirl foundry-square-resource foundry-square-resource--owned">
            <div className="card-face-inner">
              <div className="card-face-front foundry-square-resource__front">
                <div className="foundry-square-resource__header foundry-square-resource__header--count-only">
                  <span className="foundry-square-resource__count">{fmtCount(type === 'arcana' ? 1 : slot.count)}</span>
                </div>
                <div className="foundry-square-resource__art-wrap">
                  {artSrc ? <img src={artSrc} alt={slot.name} className="foundry-square-resource__art" /> : null}
                </div>
              </div>
            </div>
          </div>
          <span className="expedition-resource-slot__name">{slot.name}</span>
        </>
      ) : (
        <div className="expedition-slot-empty expedition-slot-empty--small">
          <span className="expedition-slot-empty__rune" aria-hidden="true">{type === 'arcana' ? '◌' : '⬡'}</span>
          <span className="expedition-slot-empty__label">{label}</span>
        </div>
      )}
    </div>
  );
}

function SupportUnlockSlot({ type, index, currentCapacity, balance, isEditable, onUnlock }) {
  const cost = getExpeditionUpgradeCost(type, index);
  const isNextUnlock = index === currentCapacity;
  const enabled = Boolean(cost) && isNextUnlock && isEditable && balance >= cost;

  return (
    <div className={`expedition-resource-slot expedition-resource-slot--locked-slot${enabled ? ' expedition-resource-slot--unlockable' : ''}`}>
      <button
        className="expedition-locked-slot"
        disabled={!enabled}
        onClick={() => enabled && onUnlock?.(type)}
        aria-label={cost ? `Unlock ${type} slot for ${cost}` : `${type} slot locked`}
      >
        <span className="expedition-locked-slot__rune" aria-hidden="true">✦</span>
        <span className="expedition-locked-slot__label">
          {cost ? 'Unlock' : 'Locked'}
        </span>
        {cost ? <strong className="expedition-locked-slot__cost">{cost}</strong> : null}
      </button>
    </div>
  );
}

function RewardTile({ reward }) {
  const artSrc = getResourceArt(reward);
  return (
    <div className="expedition-reward-tile card-face-wrapper no-twirl foundry-square-resource foundry-square-resource--owned">
      <div className="card-face-inner">
        <div className="card-face-front foundry-square-resource__front">
          <div className="foundry-square-resource__header foundry-square-resource__header--count-only">
            <span className="foundry-square-resource__count">{fmtCount(reward.amount)}</span>
          </div>
          <div className="foundry-square-resource__art-wrap">
            {artSrc ? <img src={artSrc} alt={reward.name} className="foundry-square-resource__art" /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ result, active = false, revealed = false, onPreviewEnter, onPreviewLeave }) {
  const outcomeTone =
    result.outcome === 'survived' ? 'safe' :
    result.outcome === 'injured' ? 'risk' :
    'deadly';
  return (
    <div className={`expedition-result-card${revealed ? ' expedition-result-card--revealed' : ''}${active ? ' expedition-result-card--active' : ''}`}>
      <div className="expedition-result-card__inner">
        <div className="expedition-result-card__face expedition-result-card__face--back">
          <span className="expedition-result-card__back-rune" aria-hidden="true">ᛞ</span>
          <span className="expedition-result-card__back-label">Expedition</span>
        </div>
        <div className={`expedition-result-card__face expedition-result-card__face--front expedition-result-card__face--${result.outcome}`}>
          <div
            className="expedition-result-card__unit"
            onMouseEnter={e => onPreviewEnter?.(e.currentTarget, result.card)}
            onMouseLeave={() => onPreviewLeave?.(result.card)}
          >
            <CardFace card={result.card} visualMode="compact" className={`expedition-result-card__card-face no-twirl${result.outcome !== 'survived' ? ' expedition-result-card__card-face--muted' : ''}`} />
            <span className="expedition-unit-slot__class-icon expedition-unit-slot__class-icon--reveal" aria-hidden="true">
              {getExpeditionClassIcon(result.card.classType)}
            </span>
          </div>
          <div className="expedition-result-card__summary">
            <ExpeditionTag label={result.outcome} tone={outcomeTone} />
            <span className="expedition-result-card__survival">Survival {result.survivalChance}%</span>
          </div>
          <div className="expedition-result-card__rewards">
            <div className="expedition-result-card__reward-block">
              <span className="expedition-result-card__reward-label">Rewards</span>
              <div className="expedition-result-card__reward-grid">
                {result.rewards.length > 0 ? result.rewards.map(entry => (
                  <RewardTile key={`reward-${result.slotId}-${entry.source}-${entry.id}`} reward={entry} />
                )) : <span className="expedition-result-card__reward-empty">None</span>}
              </div>
            </div>
            <div className="expedition-result-card__reward-block">
              <span className="expedition-result-card__reward-label">Bonus</span>
              <div className="expedition-result-card__reward-grid">
                {result.bonusRewards.length > 0 ? result.bonusRewards.map(entry => (
                  <RewardTile key={`bonus-${result.slotId}-${entry.source}-${entry.id}`} reward={entry} />
                )) : <span className="expedition-result-card__reward-empty">No bonus drop</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Expedition({
  balance,
  pocket = [],
  carriedResource = null,
  difficultyId,
  unitSlots,
  supplySlots,
  arcanaSlots,
  expeditionRun = null,
  stats,
  nextUnitSlotCost,
  nextSupplySlotCost,
  nextArcanaSlotCost,
  onSetDifficulty,
  onSocketUnit,
  onUnsocketUnit,
  onLoadSupply,
  onUnsocketSupply,
  onLoadArcana,
  onUnsocketArcana,
  onUnlockSlot,
  onSend,
  onAdvanceReveal,
  onConfirmCollect,
}) {
  const [now, setNow] = useState(Date.now());
  const [dragUnitSlot, setDragUnitSlot] = useState(null);
  const [dragSupplySlot, setDragSupplySlot] = useState(null);
  const [dragArcanaSlot, setDragArcanaSlot] = useState(null);
  const [hoverPreview, setHoverPreview] = useState(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const difficulty = EXPEDITION_DIFFICULTIES.find(entry => entry.id === difficultyId) ?? EXPEDITION_DIFFICULTIES[0];
  const filledUnits = stats.unitResults.filter(entry => entry.card);
  const hasSetupItems = filledUnits.length > 0 || supplySlots.some(slot => slot.id) || arcanaSlots.some(slot => slot.itemId);
  const currentState = expeditionRun?.state ?? (hasSetupItems ? EXPEDITION_STATES.SETUP : EXPEDITION_STATES.IDLE);
  const remainingMs = expeditionRun?.endsAt ? Math.max(0, expeditionRun.endsAt - now) : 0;
  const revealResults = expeditionRun?.unitResults ?? [];
  const revealIndex = expeditionRun?.revealIndex ?? 0;
  const currentReveal = revealResults[revealIndex] ?? null;
  const revealedResults = revealResults.slice(0, revealIndex);
  const isRevealMode = [EXPEDITION_STATES.REVEAL, EXPEDITION_STATES.COLLECT].includes(currentState);
  const revealFinished = currentState === EXPEDITION_STATES.COLLECT || (currentState === EXPEDITION_STATES.REVEAL && revealIndex >= revealResults.length);
  const isEditableSetup = currentState === EXPEDITION_STATES.IDLE || currentState === EXPEDITION_STATES.SETUP;
  const canSend = isEditableSetup && filledUnits.length > 0;
  const travelProgress = (() => {
    if (currentState === EXPEDITION_STATES.IN_PROGRESS && expeditionRun?.startedAt && expeditionRun?.endsAt) {
      const duration = Math.max(1, expeditionRun.endsAt - expeditionRun.startedAt);
      return Math.min(1, Math.max(0, (now - expeditionRun.startedAt) / duration));
    }
    if (isRevealMode) return 1;
    return 0;
  })();
  const travelStatusLabel =
    currentState === EXPEDITION_STATES.IN_PROGRESS
      ? formatTimer(remainingMs)
      : isRevealMode
        ? 'Arrived'
        : 'Ready';

  const revealRewards = useMemo(
    () => (expeditionRun?.rewardEntries ?? []),
    [expeditionRun],
  );
  const supplyDisplaySlots = Array.from({ length: EXPEDITION_SLOT_LIMITS.supply.max }, (_, index) => ({
    index,
    slot: supplySlots[index] ?? null,
  }));
  const arcanaDisplaySlots = Array.from({ length: EXPEDITION_SLOT_LIMITS.arcana.max }, (_, index) => ({
    index,
    slot: arcanaSlots[index] ?? null,
  }));

  return (
    <div className="expedition-page">
      <HoverCardPreview preview={hoverPreview} />

      <section className="expedition-topbar">
        <div className="expedition-selector">
          <span className="expedition-selector__label">Expedition</span>
          <div className="expedition-selector__buttons">
            {EXPEDITION_DIFFICULTIES.map(entry => (
              <button
                key={entry.id}
                className={`expedition-selector__btn${entry.id === difficultyId ? ' expedition-selector__btn--active' : ''}`}
                onClick={() => onSetDifficulty?.(entry.id)}
                disabled={!isEditableSetup}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
        <div className={`expedition-travel-strip expedition-travel-strip--${currentState.replace(/([A-Z])/g, '-$1').toLowerCase()}`}>
          <div className="expedition-travel-strip__meta">
            <span className="expedition-travel-strip__difficulty">{difficulty.title}</span>
            <strong className="expedition-travel-strip__status">{travelStatusLabel}</strong>
          </div>
          <div className="expedition-travel-strip__track">
            <span className="expedition-travel-strip__end expedition-travel-strip__end--start" aria-hidden="true">ᚱ</span>
            <div className="expedition-travel-strip__line" aria-hidden="true" />
            <div
              className="expedition-mini-wagon"
              style={{ '--journey-progress': travelProgress }}
              aria-hidden="true"
            >
              <div className="expedition-mini-wagon__body" />
            </div>
            <span className="expedition-travel-strip__end expedition-travel-strip__end--finish" aria-hidden="true">✦</span>
          </div>
        </div>
      </section>

      {isRevealMode ? (
        <section className="expedition-reveal-layout">
          <div className="expedition-reveal-main">
            {currentReveal && currentState === EXPEDITION_STATES.REVEAL ? (
              <div className="expedition-reveal-focus" onClick={() => onAdvanceReveal?.()}>
                <ResultCard
                  result={currentReveal}
                  active
                  revealed
                  onPreviewEnter={(element, card) => setHoverPreview(buildHoverCardPreview(element, card))}
                  onPreviewLeave={card => setHoverPreview(current => (current?.card?.id === card?.id ? null : current))}
                />
                <p className="expedition-reveal-hint">Tap to reveal next outcome</p>
              </div>
            ) : (
              <div className="expedition-reveal-complete">
                <h3>Expedition resolved</h3>
                <p>All units have reported in. Confirm to collect the haul and apply outcomes.</p>
              </div>
            )}

            {revealedResults.length > 0 ? (
              <div className="expedition-reveal-grid">
                {revealedResults.map(result => (
                  <ResultCard
                    key={result.slotId}
                    result={result}
                    revealed
                    onPreviewEnter={(element, card) => setHoverPreview(buildHoverCardPreview(element, card))}
                    onPreviewLeave={card => setHoverPreview(current => (current?.card?.id === card?.id ? null : current))}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <aside className="expedition-stats-panel">
            <div className="expedition-stats-panel__section">
              <span className="expedition-stats-panel__label">Rewards</span>
              <div className="expedition-reward-grid">
                {revealRewards.length > 0 ? revealRewards.map(entry => (
                  <RewardTile key={`summary-${entry.source}-${entry.id}`} reward={entry} />
                )) : <p className="expedition-empty-note">No rewards earned.</p>}
              </div>
            </div>
          </aside>
        </section>
      ) : (
        <section className="expedition-layout">
          <section className="expedition-wagon-panel">
            <header className="expedition-panel-head">
              <div>
                <p className="expedition-panel-kicker">Wagon</p>
                <h2 className="expedition-panel-title">Expedition Caravan</h2>
              </div>
              <p className="expedition-panel-copy">Load units, supplies, and Arcana. Stats update live as the wagon changes.</p>
            </header>

            <div className="expedition-wagon">
              <div className="expedition-wagon__frame">
                <div className="expedition-wagon__row expedition-wagon__row--units">
                  <div className="expedition-section-head">
                    <span className="expedition-section-head__title">Units</span>
                  </div>
                  <div className="expedition-slot-grid expedition-slot-grid--units">
                    {Array.from({ length: EXPEDITION_SLOT_LIMITS.unit.max }, (_, index) => ({ index, slot: unitSlots[index] ?? null })).map(({ index, slot }) => {
                      if (!slot) {
                        return (
                          <div key={`unit-locked-${index}`} className="expedition-unit-slot expedition-unit-slot--locked-shell">
                            <button
                              className="expedition-locked-slot expedition-locked-slot--unit"
                              disabled={index !== unitSlots.length || !isEditableSetup || balance < (getExpeditionUpgradeCost('unit', index) ?? Infinity)}
                              onClick={() => index === unitSlots.length && onUnlockSlot?.('unit')}
                              aria-label={`Unlock unit slot for ${getExpeditionUpgradeCost('unit', index) ?? 0}`}
                            >
                              <span className="expedition-locked-slot__rune" aria-hidden="true">⚔</span>
                              <span className="expedition-locked-slot__label">Unlock</span>
                              <strong className="expedition-locked-slot__cost">{getExpeditionUpgradeCost('unit', index)}</strong>
                            </button>
                          </div>
                        );
                      }
                      const unitStat = stats.unitResults.find(entry => entry.slotId === slot.slotId);
                      return (
                        <UnitSlot
                          key={slot.slotId}
                          slot={slot}
                          survivalChance={unitStat?.survivalChance ?? 0}
                          dragOver={dragUnitSlot === slot.slotId}
                          locked={!isEditableSetup}
                          onDragOver={event => {
                            event.preventDefault();
                            setDragUnitSlot(slot.slotId);
                          }}
                          onDragLeave={() => setDragUnitSlot(current => current === slot.slotId ? null : current)}
                          onDrop={event => {
                            event.preventDefault();
                            setDragUnitSlot(null);
                            onSocketUnit?.(event.dataTransfer.getData('text/plain'), slot.slotId);
                          }}
                          onClear={() => onUnsocketUnit?.(slot.slotId)}
                          onPreviewEnter={(element, card) => setHoverPreview(buildHoverCardPreview(element, card))}
                          onPreviewLeave={card => setHoverPreview(current => (current?.card?.id === card?.id ? null : current))}
                        />
                      );
                    })}
                  </div>
                </div>

                <div className="expedition-wagon__row expedition-wagon__row--support">
                  <div className="expedition-support-section">
                    <div className="expedition-section-head">
                      <span className="expedition-section-head__title">Supplies</span>
                    </div>
                    <div className="expedition-slot-grid expedition-slot-grid--resources">
                      {supplyDisplaySlots.map(({ index, slot }) => (
                        slot ? (
                          <ResourceSlot
                            key={slot.slotId}
                            slot={slot}
                            type="supply"
                            label="Drop Supply"
                            dragOver={dragSupplySlot === slot.slotId}
                            locked={!isEditableSetup}
                            onPointerDown={event => {
                              if (event.button !== 0) return;
                              if (!carriedResource) return;
                              if (!['gathered', 'processed'].includes(carriedResource.source)) return;
                              onLoadSupply?.(slot.slotId);
                            }}
                            onClear={() => onUnsocketSupply?.(slot.slotId)}
                          />
                        ) : (
                          <SupportUnlockSlot
                            key={`supply-locked-${index}`}
                            type="supply"
                            index={index}
                            currentCapacity={supplySlots.length}
                            balance={balance}
                            isEditable={isEditableSetup}
                            onUnlock={onUnlockSlot}
                          />
                        )
                      ))}
                    </div>
                  </div>

                  <div className="expedition-support-section">
                    <div className="expedition-section-head">
                      <span className="expedition-section-head__title">Arcana</span>
                    </div>
                    <div className="expedition-slot-grid expedition-slot-grid--resources">
                      {arcanaDisplaySlots.map(({ index, slot }) => (
                        slot ? (
                          <ResourceSlot
                            key={slot.slotId}
                            slot={slot}
                            type="arcana"
                            label="Drop Arcana"
                            dragOver={dragArcanaSlot === slot.slotId}
                            locked={!isEditableSetup}
                            onPointerDown={event => {
                              if (event.button !== 0) return;
                              if (!carriedResource || carriedResource.source !== 'arcana-item') return;
                              onLoadArcana?.(slot.slotId);
                            }}
                            onClear={() => onUnsocketArcana?.(slot.slotId)}
                          />
                        ) : (
                          <SupportUnlockSlot
                            key={`arcana-locked-${index}`}
                            type="arcana"
                            index={index}
                            currentCapacity={arcanaSlots.length}
                            balance={balance}
                            isEditable={isEditableSetup}
                            onUnlock={onUnlockSlot}
                          />
                        )
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="expedition-wagon__wheel expedition-wagon__wheel--left" aria-hidden="true" />
              <div className="expedition-wagon__wheel expedition-wagon__wheel--right" aria-hidden="true" />
            </div>
          </section>

          <aside className="expedition-stats-panel">
            <div className="expedition-stats-panel__section">
              <span className="expedition-stats-panel__label">Overview</span>
              <div className="expedition-stats-grid">
                <div className="expedition-stat-card">
                  <span className="expedition-stat-card__title">Power</span>
                  <strong>{stats.expeditionPower}</strong>
                </div>
                <div className="expedition-stat-card">
                  <span className="expedition-stat-card__title">Risk</span>
                  <strong>{stats.riskLevel}</strong>
                </div>
                <div className="expedition-stat-card">
                  <span className="expedition-stat-card__title">Rewards</span>
                  <strong>{stats.rewardPotential}</strong>
                </div>
              </div>
              <div className="expedition-overview-status">
                {currentState === EXPEDITION_STATES.IN_PROGRESS ? (
                  <div className="expedition-progress-pill">
                    <span className="expedition-progress-pill__label">Expedition in Progress</span>
                    <strong>{formatTimer(remainingMs)}</strong>
                  </div>
                ) : isRevealMode ? (
                  <div className="expedition-progress-pill expedition-progress-pill--reveal">
                    <span className="expedition-progress-pill__label">{currentState === EXPEDITION_STATES.COLLECT ? 'Collection Ready' : 'Reveal Phase'}</span>
                    <strong>{Math.min(revealIndex + (currentReveal ? 1 : 0), revealResults.length)}/{revealResults.length}</strong>
                  </div>
                ) : (
                  <div className="expedition-progress-pill expedition-progress-pill--idle">
                    <span className="expedition-progress-pill__label">Ready State</span>
                    <strong>{filledUnits.length} / {unitSlots.length} units</strong>
                  </div>
                )}
              </div>
            </div>

            <div className="expedition-stats-panel__section">
              <span className="expedition-stats-panel__label">Calculated Odds</span>
              <div className="expedition-kpi-list">
                <div className="expedition-kpi">
                  <span>Success Chance</span>
                  <strong>{stats.successChance}%</strong>
                </div>
                <div className="expedition-kpi">
                  <span>Bonus Reward Chance</span>
                  <strong>{stats.bonusRewardChance}%</strong>
                </div>
                <div className="expedition-kpi">
                  <span>Total Power</span>
                  <strong>{stats.totalPower}</strong>
                </div>
              </div>
            </div>

            <div className="expedition-stats-panel__section">
              <span className="expedition-stats-panel__label">Unit Survival</span>
              <div className="expedition-unit-survival-list">
                {stats.unitResults.filter(entry => entry.card).length > 0 ? stats.unitResults.filter(entry => entry.card).map(entry => (
                  <div key={entry.slotId} className="expedition-unit-survival-row">
                    <span className="expedition-unit-survival-row__name">
                      <span className="expedition-unit-survival-row__icon" aria-hidden="true">{getExpeditionClassIcon(entry.card.classType)}</span>
                      {entry.card.name}
                    </span>
                    <strong>{entry.survivalChance}%</strong>
                  </div>
                )) : <p className="expedition-empty-note">Slot units into the wagon to project outcomes.</p>}
              </div>
            </div>
          </aside>
        </section>
      )}

      {(isEditableSetup || (isRevealMode && revealFinished)) ? (
        <section className="expedition-action-row">
          {isEditableSetup ? (
            <button className="summon-btn summon-btn--primary expedition-send-btn" disabled={!canSend} onClick={() => onSend?.()}>
              Send Expedition
            </button>
          ) : null}
          {isRevealMode && revealFinished ? (
            <button className="summon-btn summon-btn--primary expedition-send-btn" onClick={() => onConfirmCollect?.()}>
              Confirm &amp; Collect
            </button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
