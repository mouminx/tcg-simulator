import { useState, useEffect, useRef } from 'react';
import CardFace from './CardFace';
import { RARITIES, TIERS, fmt } from '../game/cards';

// Slot price schedules — each successive slot costs more
export const LEGENDARY_SLOT_PRICES = [1500, 3000, 5500, 9000, 14000];
export const MYTHIC_SLOT_PRICES    = [5000, 9000, 15000, 24000, 38000];

const MAX_SLOTS    = 5;
const MAX_HISTORY  = 20;
const TICK_MS      = 3000;

const VOLATILITY = { legendary: 0.030, mythic: 0.012 };
const REVERSION  = { legendary: 0.10,  mythic: 0.18  };

function tickPrices(priceMap, trackedCards) {
  const next = new Map(priceMap);
  for (const card of trackedCards) {
    const history = priceMap.get(card.id) ?? [card.value];
    const current = history[history.length - 1];
    const vol = VOLATILITY[card.rarity] ?? 0.09;
    const rev = REVERSION[card.rarity]  ?? 0.08;
    const noise = (Math.random() + Math.random() + Math.random() - 1.5) * (2 / 1.5);
    const shock = noise * vol * card.value;
    const pull  = rev * (card.value - current);
    const nextPrice = Math.max(0.01, Math.round((current + shock + pull) * 100) / 100);
    next.set(card.id, [...history, nextPrice].slice(-MAX_HISTORY));
  }
  return next;
}

function Sparkline({ cardId, history, color }) {
  const gradId = `sg-${String(cardId).replace('.', '-')}`;
  const W = 160, H = 40, pad = 3;

  if (history.length < 2) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H }}>
        <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke={color} strokeWidth="1.5" strokeOpacity="0.5" />
      </svg>
    );
  }

  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || max * 0.02 || 1;
  const pts = history.map((p, i) => [
    (i / (history.length - 1)) * W,
    H - pad - ((p - min) / range) * (H - pad * 2),
  ]);
  const pointsStr = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath  = `M 0,${H} L ${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ')} L ${W},${H} Z`;
  const [lx, ly]  = pts[pts.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <polyline points={pointsStr} fill="none" stroke={color} strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx.toFixed(1)} cy={ly.toFixed(1)} r="3" fill={color} />
    </svg>
  );
}

function MarketRow({ card, priceMap, sellingIds, soldPrices, onSell }) {
  const history      = priceMap.get(card.id) ?? [card.value];
  const currentPrice = history.at(-1);
  const pct          = ((currentPrice - card.value) / card.value) * 100;
  const up           = currentPrice >= card.value;
  const trendColor   = up ? '#4ade80' : '#f87171';
  const rarity       = RARITIES[card.rarity];
  const tierName     = TIERS[card.tier]?.name ?? card.tier;
  const isSelling    = sellingIds.has(card.id);
  const soldPrice    = soldPrices.get(card.id);

  if (soldPrice !== undefined) {
    return (
      <div className="market-row market-row--sold" style={{ '--rarity-color': rarity.color }}>
        <div className="market-sold-popup">+{fmt(soldPrice)}</div>
      </div>
    );
  }

  return (
    <div
      className={`market-row${isSelling ? ' market-row--selling' : ''}`}
      style={{ '--rarity-color': rarity.color }}
    >
      <div className="market-card-preview">
        <CardFace card={card} className="no-twirl" />
      </div>

      <div className="market-row-info">
        <div className="market-card-name">{card.name}</div>
        <div className="market-card-badges">
          <span className="market-badge" style={{ color: rarity.color }}>{rarity.name}</span>
          <span className="market-badge market-tier-badge">Tier {tierName}</span>
        </div>
      </div>

      <div className="market-sparkline">
        <Sparkline cardId={card.id} history={history} color={trendColor} />
      </div>

      <div className="market-row-price">
        <div className="market-current-price" style={{ color: trendColor }}>{fmt(currentPrice)}</div>
        <div className={`market-pct ${up ? 'market-pct--up' : 'market-pct--down'}`}>
          {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
        </div>
        <div className="market-base-price">base {fmt(card.value)}</div>
      </div>

      <button
        className="market-sell-btn"
        style={{ '--sell-color': trendColor }}
        onClick={() => onSell(card, currentPrice)}
        disabled={isSelling}
      >
        Sell
      </button>
    </div>
  );
}

function EmptySlot() {
  return <div className="market-empty-slot">No card assigned</div>;
}

function BuySlot({ price, isNext, canAfford, onClick, rarityColor }) {
  return (
    <div
      className={`market-slot-buy${isNext ? ' market-slot-buy--next' : ' market-slot-buy--future'}${isNext && !canAfford ? ' market-slot-buy--broke' : ''}`}
      style={{ '--rarity-color': rarityColor }}
      onClick={isNext && canAfford ? onClick : undefined}
    >
      {isNext ? (
        <>
          <span className="market-slot-icon">+</span>
          <span className="market-slot-label">
            {canAfford ? `Buy Slot · ${fmt(price)}` : `${fmt(price)} to unlock`}
          </span>
        </>
      ) : (
        <span className="market-slot-future-price">{fmt(price)}</span>
      )}
    </div>
  );
}

export default function Market({ cards, onSell, market, onBuyLegendarySlot, onBuyMythicSlot, balance }) {
  const legendaryCards = [...cards.filter(c => c.rarity === 'legendary')].sort((a, b) => b.value - a.value);
  const mythicCards    = [...cards.filter(c => c.rarity === 'mythic')].sort((a, b) => b.value - a.value);

  const trackedLegendary = legendaryCards.slice(0, market.legendarySlots);
  const trackedMythic    = mythicCards.slice(0, market.mythicSlots);
  const allTracked       = [...trackedLegendary, ...trackedMythic];

  const trackedRef = useRef(allTracked);
  useEffect(() => { trackedRef.current = allTracked; }, [allTracked]);

  const [priceMap, setPriceMap] = useState(() => {
    const m = new Map();
    for (const c of allTracked) m.set(c.id, [c.value]);
    return m;
  });
  const [sellingIds, setSellingIds] = useState(new Set());
  const [soldPrices, setSoldPrices] = useState(new Map());

  useEffect(() => {
    setPriceMap(prev => {
      const next = new Map(prev);
      for (const c of allTracked) {
        if (!next.has(c.id)) next.set(c.id, [c.value]);
      }
      for (const id of next.keys()) {
        if (!allTracked.find(c => c.id === id)) next.delete(id);
      }
      return next;
    });
  }, [cards, market]);

  useEffect(() => {
    const id = setInterval(() => {
      setPriceMap(prev => tickPrices(prev, trackedRef.current));
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  function handleSell(card, currentPrice) {
    setSellingIds(prev => new Set([...prev, card.id]));
    setTimeout(() => {
      setSoldPrices(prev => new Map(prev).set(card.id, currentPrice));
      setSellingIds(prev => { const s = new Set(prev); s.delete(card.id); return s; });
    }, 480);
    setTimeout(() => onSell(card.id, currentPrice), 1400);
  }

  const legColor  = RARITIES.legendary.color;
  const mythColor = RARITIES.mythic.color;

  return (
    <div className="market">
      <div className="market-header">
        <h2>
          Elite Market{' '}
          {allTracked.length > 0 && (
            <span className="market-count">({allTracked.length} tracked)</span>
          )}
        </h2>
        <span className="market-live-badge">
          <span className="market-live-dot" />
          Live · 3s
        </span>
      </div>

      <div className="market-panels">

        {/* ── Legendary Panel ── */}
        <div className="market-panel">
          <div className="market-panel-header">
            <span className="market-panel-title" style={{ color: legColor }}>Legendary</span>
            <span className="market-panel-slots">{market.legendarySlots} / {MAX_SLOTS} slots</span>
          </div>

          <div className="market-panel-body">
            {market.legendarySlots === 0 && (
              <p className="market-panel-desc">
                Buy tracking slots to watch your legendary cards' live prices.
              </p>
            )}
            {Array.from({ length: MAX_SLOTS }).map((_, i) => {
              if (i < market.legendarySlots) {
                return trackedLegendary[i]
                  ? <MarketRow key={i} card={trackedLegendary[i]}
                      priceMap={priceMap} sellingIds={sellingIds} soldPrices={soldPrices} onSell={handleSell} />
                  : <EmptySlot key={i} />;
              }
              return (
                <BuySlot
                  key={i}
                  price={LEGENDARY_SLOT_PRICES[i]}
                  isNext={i === market.legendarySlots}
                  canAfford={balance >= LEGENDARY_SLOT_PRICES[i]}
                  onClick={onBuyLegendarySlot}
                  rarityColor={legColor}
                />
              );
            })}
          </div>
        </div>

        {/* ── Mythic Panel ── */}
        <div className="market-panel">
          <div className="market-panel-header">
            <span className="market-panel-title" style={{ color: mythColor }}>Mythic</span>
            <span className="market-panel-slots">{market.mythicSlots} / {MAX_SLOTS} slots</span>
          </div>

          <div className="market-panel-body">
            {market.mythicSlots === 0 && (
              <p className="market-panel-desc">
                Premium tracking for mythic cards — the rarest assets in your collection.
              </p>
            )}
            {Array.from({ length: MAX_SLOTS }).map((_, i) => {
              if (i < market.mythicSlots) {
                return trackedMythic[i]
                  ? <MarketRow key={i} card={trackedMythic[i]}
                      priceMap={priceMap} sellingIds={sellingIds} soldPrices={soldPrices} onSell={handleSell} />
                  : <EmptySlot key={i} />;
              }
              return (
                <BuySlot
                  key={i}
                  price={MYTHIC_SLOT_PRICES[i]}
                  isNext={i === market.mythicSlots}
                  canAfford={balance >= MYTHIC_SLOT_PRICES[i]}
                  onClick={onBuyMythicSlot}
                  rarityColor={mythColor}
                />
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
