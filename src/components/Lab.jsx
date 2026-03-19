import { useState } from 'react';
import {
  RARITIES, TAGS,
  GRADE_MULTIPLIERS, GRADE_FLOOR, rollGrade, GRADEABLE_RARITIES, getGradeCost,
  FUSION_RECIPES, IMPRINT_DATA, RARITY_ORDER,
  computeFuseScore, getFuseSuccessRate, rollTagInheritance,
  getImprintCost, getImprintSuccessChance,
  makeCard, fmtStr,
} from '../game/cards';
import CardFace from './CardFace';
import Gold from './Gold';
import FusionAnimation from './FusionAnimation';

const LAB_TABS = [
  { id: 'fuse',    label: 'Fuse',    icon: '⊕' },
  { id: 'imprint', label: 'Imprint', icon: '✦' },
  { id: 'grade',   label: 'Grade',   icon: '⧫' },
];

// ── Result modal ──────────────────────────────────────────────────────────────

function ResultModal({ result, onClose }) {
  if (!result) return null;
  return (
    <div className="lab-result-backdrop" onClick={onClose}>
      <div className="lab-result-modal" onClick={e => e.stopPropagation()}>

        {result.type === 'grade' && (
          <>
            <div className={`lab-result-grade-num grade-badge--${result.grade === 10 ? 'gem' : result.grade >= 8 ? 'high' : result.grade >= 5 ? 'mid' : 'low'}`}>
              {result.grade}
            </div>
            <h3 className="lab-result-title">
              {result.grade === 10 ? 'Gem Mint' : result.grade >= 8 ? 'Near Mint' : result.grade >= 6 ? 'Good' : result.grade >= 4 ? 'Fair' : 'Poor'}
            </h3>
            <p className="lab-result-sub">Grade {result.grade} · Sell value: <Gold amount={result.newValue} /></p>
            {result.attempts > 1 && (
              <p className="lab-result-sub lab-result-sub--dim">Attempt #{result.attempts}</p>
            )}
          </>
        )}

        {result.type === 'fuse' && result.success && (
          <>
            <div className="lab-result-icon lab-result-icon--success">⊕</div>
            <h3 className="lab-result-title lab-result-title--success">Fusion Successful</h3>
            <p className="lab-result-sub" style={{ color: RARITIES[result.card.rarity].color }}>
              {RARITIES[result.card.rarity].name} · {result.card.name}
            </p>
            {result.card.fuseScore != null && (
              <p className="lab-result-sub">Fuse score: <strong>⊕{result.card.fuseScore}</strong></p>
            )}
            {result.card.tag && (
              <p className="lab-result-sub lab-result-sub--tag">
                Inherited: <strong>{TAGS[result.card.tag].name}</strong>
              </p>
            )}
            <div className="lab-result-card">
              <CardFace card={result.card} holo={false} />
            </div>
          </>
        )}

        {result.type === 'fuse' && !result.success && (
          <>
            <div className="lab-result-icon lab-result-icon--fail">✕</div>
            <h3 className="lab-result-title lab-result-title--fail">Fusion Failed</h3>
            <p className="lab-result-sub">The cards dissolved into nothing.</p>
          </>
        )}

        {result.type === 'imprint' && result.success && (
          <>
            <div className="lab-result-icon lab-result-icon--success">✦</div>
            <h3 className="lab-result-title lab-result-title--success">Imprint Successful</h3>
            <p className="lab-result-sub">{TAGS[result.tag].name} tag applied · New value: <Gold amount={result.newValue} /></p>
          </>
        )}

        {result.type === 'imprint' && !result.success && (
          <>
            <div className="lab-result-icon lab-result-icon--fail">✕</div>
            <h3 className="lab-result-title lab-result-title--fail">Imprint Failed</h3>
            <p className="lab-result-sub">The card was destroyed in the process.</p>
          </>
        )}

        <button className="lab-result-close" onClick={onClose}>Continue</button>
      </div>
    </div>
  );
}

// ── Shared card picker ────────────────────────────────────────────────────────

const ROW_SIZE = 12;

function CardPicker({ cards, selectedIds, onToggle, lockedIds }) {
  const locked = new Set(lockedIds ?? []);
  const selectedSet = new Set(Array.isArray(selectedIds) ? selectedIds : [selectedIds]);

  // Chunk into rows of ROW_SIZE so z-index resets per row (leftmost = highest)
  const rows = [];
  for (let i = 0; i < cards.length; i += ROW_SIZE) {
    rows.push(cards.slice(i, i + ROW_SIZE));
  }

  return (
    <div className="lab-card-grid">
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} className="lab-card-row">
          {row.map((c, idx) => {
            const isSelected = selectedSet.has(c.id);
            const isLocked = locked.has(c.id);
            return (
              <div
                key={c.id}
                className={`lab-card-slot${isSelected ? ' lab-card-slot--selected' : ''}${isLocked ? ' lab-card-slot--locked' : ''}`}
                style={{ zIndex: isSelected ? 150 : Math.max(1, ROW_SIZE - idx) }}
                onClick={() => !isLocked && onToggle(c)}
              >
                <CardFace card={c} holo={false} />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Fuse section ──────────────────────────────────────────────────────────────

function FuseSection({ cards, balance, onFuse }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [result,      setResult]      = useState(null);
  const [animState,   setAnimState]   = useState(null); // pending animation

  const selectedCards = selectedIds.map(id => cards.find(c => c.id === id)).filter(Boolean);
  const selRarity = selectedCards[0]?.rarity ?? null;
  const recipe = selRarity ? FUSION_RECIPES[selRarity] : null;
  const readyToFuse = recipe && selectedCards.length === recipe.count;
  const canAfford = recipe ? balance >= recipe.cost : false;

  const fuseScore = readyToFuse ? computeFuseScore(selectedCards) : null;
  const adjustedRate = readyToFuse ? getFuseSuccessRate(recipe, fuseScore) : null;
  const taggedInputs = selectedCards.filter(c => c.tag);
  const inheritChance = fuseScore != null && taggedInputs.length > 0
    ? Math.min(0.10 + fuseScore * 0.025, 0.70)
    : 0;

  const eligible = cards
    .filter(c => FUSION_RECIPES[c.rarity] && c.grade == null)
    .sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity));
  const lockedIds = eligible
    .filter(c => selRarity && c.rarity !== selRarity && !selectedIds.includes(c.id))
    .map(c => c.id);

  function toggle(card) {
    if (!FUSION_RECIPES[card.rarity]) return;
    setSelectedIds(prev => {
      if (prev.includes(card.id)) return prev.filter(id => id !== card.id);
      if (selRarity && card.rarity !== selRarity) return [card.id];
      const rec = FUSION_RECIPES[card.rarity];
      if (prev.length >= rec.count) return prev;
      return [...prev, card.id];
    });
  }

  // Auto-select the best set for a given rarity.
  // Prioritises cards of the same name ("type") so same-type groups fuse together,
  // then fills remaining slots with highest fuseScore cards.
  function smartSelect(rarity) {
    const rec = FUSION_RECIPES[rarity];
    if (!rec) return;
    const pool = eligible
      .filter(c => c.rarity === rarity)
      .sort((a, b) => (b.fuseScore ?? 0) - (a.fuseScore ?? 0));
    if (pool.length < rec.count) return;

    // Group by card name (same name = same archetype/type)
    const groups = {};
    for (const c of pool) {
      if (!groups[c.name]) groups[c.name] = [];
      groups[c.name].push(c);
    }
    // Sort groups: most members first; ties broken by highest fuseScore in group
    const sorted = Object.values(groups).sort((a, b) =>
      b.length !== a.length
        ? b.length - a.length
        : (b[0].fuseScore ?? 0) - (a[0].fuseScore ?? 0),
    );

    const selected = [];
    for (const group of sorted) {
      for (const card of group) {
        if (selected.length >= rec.count) break;
        selected.push(card.id);
      }
      if (selected.length >= rec.count) break;
    }
    setSelectedIds(selected.slice(0, rec.count));
  }

  function handleFuse() {
    if (!readyToFuse || !canAfford) return;
    const fs = computeFuseScore(selectedCards);
    const rate = getFuseSuccessRate(recipe, fs);
    const success = Math.random() < rate;
    let newCard = null;
    if (success) {
      newCard = makeCard(recipe.result);
      newCard.fuseScore = fs;
      const inherited = rollTagInheritance(selectedCards, fs);
      if (inherited) {
        newCard.tag = inherited;
        newCard.value = Math.round(newCard.value * TAGS[inherited].multiplier * 100) / 100;
      }
    }
    // Snapshot the cards and cost before clearing selection
    setAnimState({
      inputCards:   [...selectedCards],
      inputIds:     [...selectedIds],
      cost:         recipe.cost,
      resultRarity: recipe.result,
      success,
      newCard,
    });
    setSelectedIds([]);
  }

  function handleAnimComplete() {
    const { inputIds, cost, success, newCard } = animState;
    onFuse(inputIds, cost, newCard);
    setAnimState(null);
    setResult({ type: 'fuse', success, card: newCard });
  }

  return (
    <div className="lab-layout">
      <div className="lab-panel lab-panel--picker">
        <h4 className="lab-panel-title">Select Cards to Fuse</h4>
        <p className="lab-panel-hint">Same rarity only. Higher fuse scores boost success chance and tag inheritance odds. Mythic cannot be fused.</p>
        {eligible.length === 0
          ? <p className="lab-empty">No fuseable cards in collection.</p>
          : <CardPicker cards={eligible} selectedIds={selectedIds} onToggle={toggle} lockedIds={lockedIds} />
        }
      </div>

      <div className="lab-panel lab-panel--action">
        <h4 className="lab-panel-title">Fusion Recipes</h4>
        <div className="lab-recipes">
          {RARITY_ORDER.filter(r => FUSION_RECIPES[r]).map(r => {
            const rec = FUSION_RECIPES[r];
            const isActive = selRarity === r;
            return (
              <div key={r} className={`lab-recipe${isActive ? ' lab-recipe--active' : ''}`}>
                <span className="lab-recipe-from" style={{ color: RARITIES[r].color }}>{RARITIES[r].name}</span>
                <span className="lab-recipe-arrow">→</span>
                <span className="lab-recipe-to" style={{ color: RARITIES[rec.result].color }}>{RARITIES[rec.result].name}</span>
                <span className="lab-recipe-meta">{rec.count} cards · <Gold amount={rec.cost} /></span>
                <span className="lab-recipe-rate">{Math.round(rec.successRate * 100)}%</span>
              </div>
            );
          })}
        </div>

        {selRarity && recipe && (
          <div className="lab-fuse-status">
            <div className="lab-fuse-progress-label">
              <span style={{ color: RARITIES[selRarity].color }}>{selectedCards.length}</span>
              <span className="lab-fuse-progress-sep">/</span>
              <span>{recipe.count} {RARITIES[selRarity].name}</span>
            </div>
            <div className="lab-fuse-dots">
              {Array.from({ length: recipe.count }).map((_, i) => (
                <div
                  key={i}
                  className={`lab-fuse-dot${i < selectedCards.length ? ' lab-fuse-dot--filled' : ''}`}
                  style={i < selectedCards.length
                    ? { background: RARITIES[selRarity].color, boxShadow: `0 0 6px ${RARITIES[selRarity].color}` }
                    : {}}
                />
              ))}
            </div>
            {readyToFuse && (
              <div className="lab-info-table">
                <div className="lab-info-row">
                  <span>Cost</span>
                  <span className={canAfford ? '' : 'lab-val--bad'}><Gold amount={recipe.cost} /></span>
                </div>
                <div className="lab-info-row">
                  <span>Fuse score</span>
                  <span className="lab-val--fuse">⊕{fuseScore}</span>
                </div>
                <div className="lab-info-row">
                  <span>Success chance</span>
                  <span className={adjustedRate > recipe.successRate ? 'lab-val--good' : ''}>
                    {Math.round(adjustedRate * 100)}%
                    {adjustedRate > recipe.successRate && (
                      <span className="lab-val--bonus"> (+{Math.round((adjustedRate - recipe.successRate) * 100)}%)</span>
                    )}
                  </span>
                </div>
                {taggedInputs.length > 0 && (
                  <div className="lab-info-row">
                    <span>Tag inherit chance</span>
                    <span className="lab-val--good">{Math.round(inheritChance * 100)}%</span>
                  </div>
                )}
                <div className="lab-info-row">
                  <span>Result if success</span>
                  <span style={{ color: RARITIES[recipe.result].color }}>{RARITIES[recipe.result].name}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Smart Merge ── */}
        {(() => {
          const available = RARITY_ORDER.filter(r => {
            const rec = FUSION_RECIPES[r];
            return rec && eligible.filter(c => c.rarity === r).length >= rec.count;
          });
          if (available.length === 0) return null;
          return (
            <div className="lab-smart-merge">
              <div className="lab-smart-merge-header">
                <span className="lab-smart-merge-title">Smart Merge</span>
                <span className="lab-smart-merge-hint">auto-select same type</span>
              </div>
              <div className="lab-smart-merge-btns">
                {available.map(r => (
                  <button
                    key={r}
                    className="lab-smart-merge-btn"
                    style={{ '--rc': RARITIES[r].color }}
                    onClick={() => smartSelect(r)}
                  >
                    {RARITIES[r].name}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        <button
          className={`lab-btn${readyToFuse && canAfford ? ' lab-btn--fuse' : ' lab-btn--disabled'}`}
          onClick={handleFuse}
          disabled={!readyToFuse || !canAfford}
        >
          {!selRarity
            ? 'Select cards to begin'
            : !readyToFuse
            ? `Need ${recipe.count - selectedCards.length} more ${RARITIES[selRarity].name}`
            : !canAfford
            ? 'Insufficient funds'
            : `Fuse · ${fmtStr(recipe.cost)} · ${Math.round(adjustedRate * 100)}%`}
        </button>
      </div>

      {animState && (
        <FusionAnimation
          cards={animState.inputCards}
          resultRarity={animState.resultRarity}
          success={animState.success}
          onComplete={handleAnimComplete}
        />
      )}
      <ResultModal result={result} onClose={() => setResult(null)} />
    </div>
  );
}

// ── Imprint section ───────────────────────────────────────────────────────────

function ImprintSection({ cards, balance, onImprint }) {
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [result, setResult] = useState(null);

  const eligible = cards.filter(c => !c.tag);
  const card = eligible.find(c => c.id === selectedCardId) ?? null;
  const imprintInfo = selectedTag ? IMPRINT_DATA[selectedTag] : null;
  const imprintCost = card && selectedTag ? getImprintCost(selectedTag, card.rarity) : 0;
  const canAfford = imprintCost > 0 ? balance >= imprintCost : false;
  const previewValue = card && selectedTag
    ? Math.round(card.value * TAGS[selectedTag].multiplier * 100) / 100
    : null;

  const fuseScore = card?.fuseScore ?? 0;
  const successChance = card && selectedTag
    ? getImprintSuccessChance(selectedTag, card.rarity, fuseScore)
    : null;
  const baseSuccess = imprintInfo ? 1 - imprintInfo.failRate : null;

  function handleImprint() {
    if (!card || !selectedTag || !canAfford) return;
    const sc = getImprintSuccessChance(selectedTag, card.rarity, fuseScore);
    const success = Math.random() < sc;
    const newValue = success
      ? Math.round(card.value * TAGS[selectedTag].multiplier * 100) / 100
      : null;
    onImprint(card.id, selectedTag, success, newValue);
    setSelectedCardId(null);
    setSelectedTag(null);
    setResult({ type: 'imprint', success, tag: selectedTag, newValue });
  }

  return (
    <div className="lab-layout">
      <div className="lab-panel lab-panel--picker">
        <h4 className="lab-panel-title">Select a Card</h4>
        <p className="lab-panel-hint">Only untagged cards. Fused cards have improved success rates. Failure destroys the card.</p>
        {eligible.length === 0
          ? <p className="lab-empty">No untagged cards in collection.</p>
          : <CardPicker
              cards={eligible}
              selectedIds={selectedCardId}
              onToggle={c => setSelectedCardId(c.id === selectedCardId ? null : c.id)}
            />
        }
      </div>

      <div className="lab-panel lab-panel--action">
        <h4 className="lab-panel-title">Choose a Tag</h4>
        <div className="lab-tag-grid">
          {Object.entries(IMPRINT_DATA).map(([tagKey, info]) => {
            const tag = TAGS[tagKey];
            const isSelected = selectedTag === tagKey;
            const sc = card ? getImprintSuccessChance(tagKey, card.rarity, fuseScore) : null;
            return (
              <button
                key={tagKey}
                className={`lab-tag-btn lab-tag-btn--${tagKey}${isSelected ? ' lab-tag-btn--selected' : ''}`}
                onClick={() => setSelectedTag(tagKey === selectedTag ? null : tagKey)}
              >
                <span className="lab-tag-btn-name">{tag.name}</span>
                <span className="lab-tag-btn-cost">
                  {card ? <Gold amount={getImprintCost(tagKey, card.rarity)} /> : <Gold amount={info.baseCost} />}
                </span>
                <span className="lab-tag-btn-fail">
                  {sc != null
                    ? `${Math.round((1 - sc) * 100)}% fail`
                    : `${Math.round(info.failRate * 100)}% fail`}
                </span>
              </button>
            );
          })}
        </div>

        {card && selectedTag && imprintInfo ? (
          <>
            <div className="lab-info-table">
              <div className="lab-info-row">
                <span>Cost</span>
                <span className={canAfford ? '' : 'lab-val--bad'}><Gold amount={imprintCost} /></span>
              </div>
              <div className="lab-info-row">
                <span>Fail chance</span>
                <span className={fuseScore > 0 ? 'lab-val--good' : 'lab-val--warn'}>
                  {Math.round((1 - successChance) * 100)}%
                  {fuseScore > 0 && baseSuccess != null && (
                    <span className="lab-val--bonus">
                      {' '}(−{Math.round((imprintInfo.failRate - (1 - successChance)) * 100)}% from ⊕{fuseScore})
                    </span>
                  )}
                </span>
              </div>
              <div className="lab-info-row">
                <span>Value if success</span>
                <span><Gold amount={previewValue} /></span>
              </div>
              <div className="lab-info-row lab-info-row--note">
                <span>On failure: card is permanently destroyed</span>
              </div>
            </div>
            <button
              className={`lab-btn${canAfford ? ' lab-btn--imprint' : ' lab-btn--disabled'}`}
              onClick={handleImprint}
              disabled={!canAfford}
            >
              {canAfford
                ? `Imprint ${TAGS[selectedTag].name} · ${fmtStr(imprintCost)}`
                : 'Insufficient funds'}
            </button>
          </>
        ) : (
          <p className="lab-empty">
            {!card && !selectedTag
              ? 'Select a card and a tag.'
              : !card ? 'No card selected.'
              : 'No tag selected.'}
          </p>
        )}
      </div>

      <ResultModal result={result} onClose={() => setResult(null)} />
    </div>
  );
}

// ── Grade section ─────────────────────────────────────────────────────────────

function GradeSection({ cards, balance, onGrade }) {
  const [selectedId, setSelectedId] = useState(null);
  const [result, setResult] = useState(null);

  const eligible = cards.filter(c => GRADEABLE_RARITIES.has(c.rarity));
  const card = eligible.find(c => c.id === selectedId) ?? null;
  const cost = card ? getGradeCost(card) : 0;
  const canAfford = balance >= cost;
  const attempts = card?.gradeAttempts ?? 0;
  const isRegrade = attempts > 0;

  function handleGrade() {
    if (!card || !canAfford) return;
    const grade = rollGrade(card.rarity);
    const newValue = Math.round(card.value * GRADE_MULTIPLIERS[grade] * 100) / 100;
    onGrade(card.id, grade);
    setSelectedId(null);
    setResult({ type: 'grade', grade, newValue, attempts: attempts + 1 });
  }

  return (
    <div className="lab-layout">
      <div className="lab-panel lab-panel--picker">
        <h4 className="lab-panel-title">Select a Card</h4>
        <p className="lab-panel-hint">Legendary and Mythic only. Re-grading overwrites the previous grade — cost doubles each attempt.</p>
        {eligible.length === 0
          ? <p className="lab-empty">No Legendary or Mythic cards in collection.</p>
          : <CardPicker
              cards={eligible}
              selectedIds={selectedId}
              onToggle={c => setSelectedId(c.id === selectedId ? null : c.id)}
            />
        }
      </div>

      <div className="lab-panel lab-panel--action">
        <h4 className="lab-panel-title">Grading Station</h4>
        {card ? (
          <>
            <div className="lab-card-preview">
              <CardFace card={card} holo={false} />
            </div>
            <div className="lab-info-table">
              <div className="lab-info-row">
                <span>{isRegrade ? `Re-grade fee (×${Math.pow(2, attempts)})` : 'Grading fee'}</span>
                <span className={canAfford ? (isRegrade ? 'lab-val--warn' : '') : 'lab-val--bad'}><Gold amount={cost} /></span>
              </div>
              <div className="lab-info-row">
                <span>Grade range</span>
                <span>{GRADE_FLOOR[card.rarity] ?? 1} – 10</span>
              </div>
              {isRegrade && (
                <div className="lab-info-row">
                  <span>Current grade</span>
                  <span className={`grade-badge grade-badge--${card.grade === 10 ? 'gem' : card.grade >= 8 ? 'high' : card.grade >= 5 ? 'mid' : 'low'}`}>
                    {card.grade}
                  </span>
                </div>
              )}
              {isRegrade && (
                <div className="lab-info-row lab-info-row--note">
                  <span>Attempt #{attempts + 1} — re-grading overwrites current grade</span>
                </div>
              )}
              {!isRegrade && (
                <div className="lab-info-row lab-info-row--note">
                  <span>Grade 10 (Gem Mint) = 5× value · Result is random</span>
                </div>
              )}
            </div>
            <button
              className={`lab-btn${canAfford ? '' : ' lab-btn--disabled'}`}
              onClick={handleGrade}
              disabled={!canAfford}
            >
              {canAfford
                ? isRegrade ? `Re-grade · ${fmtStr(cost)}` : `Grade · ${fmtStr(cost)}`
                : 'Insufficient funds'}
            </button>
          </>
        ) : (
          <p className="lab-empty">No card selected.</p>
        )}

        <div className="lab-grade-scale">
          <h5 className="lab-grade-scale-title">Grade Scale</h5>
          {Object.entries(GRADE_MULTIPLIERS).reverse().map(([g, m]) => (
            <div key={g} className="lab-grade-row">
              <span className={`grade-badge grade-badge--${Number(g) === 10 ? 'gem' : Number(g) >= 8 ? 'high' : Number(g) >= 5 ? 'mid' : 'low'}`}>{g}</span>
              <span className="lab-grade-mult">{m}×</span>
              <div className="lab-grade-bar-track">
                <div className="lab-grade-bar-fill" style={{ width: `${(m / 5) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <ResultModal result={result} onClose={() => setResult(null)} />
    </div>
  );
}

// ── Main Lab component ────────────────────────────────────────────────────────

export default function Lab({ cards, balance, onGrade, onFuse, onImprint }) {
  const [tab, setTab] = useState('fuse');
  return (
    <div className="lab">
      <div className="lab-header">
        <h2>Lab</h2>
        <p className="lab-subtitle">Fuse cards to build score · Imprint tags · Grade to seal value.</p>
      </div>
      <div className="lab-tabs">
        {LAB_TABS.map(t => (
          <button
            key={t.id}
            className={`lab-tab${tab === t.id ? ' lab-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="lab-tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'fuse'    && <FuseSection    cards={cards} balance={balance} onFuse={onFuse}       />}
      {tab === 'imprint' && <ImprintSection cards={cards} balance={balance} onImprint={onImprint} />}
      {tab === 'grade'   && <GradeSection   cards={cards} balance={balance} onGrade={onGrade}     />}
    </div>
  );
}
