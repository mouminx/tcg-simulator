import { useState, useEffect, useRef } from 'react';
import Shop from './components/Shop';
import UnpackPage from './components/UnpackPage';
import Collection from './components/Collection';
import Market, { LEGENDARY_SLOT_PRICES, MYTHIC_SLOT_PRICES } from './components/Market';
import Lab from './components/Lab';
import FXEditor from './components/FXEditor';
import { openPack, PACK_TYPES, STARTING_BALANCE, fmt, getGradeCost, getImprintCost, getCardSellValue } from './game/cards';
import './App.css';

const VIEWS = { SHOP: 'shop', UNPACK: 'unpack', COLLECTION: 'collection', MARKET: 'market', LAB: 'lab', FX: 'fx' };
const TAB_ICONS = { shop: '⊙', unpack: '✦', collection: '⊞', market: '↗', lab: '⚗', fx: '✏' };
const VIEW_ORDER = [VIEWS.SHOP, VIEWS.UNPACK, VIEWS.COLLECTION, VIEWS.LAB, VIEWS.MARKET, VIEWS.FX];

const SAVE_VERSION = 6;
const DEFAULT_MARKET = { legendarySlots: 0, mythicSlots: 0 };

function loadState() {
  try {
    const saved = localStorage.getItem('tcg-sim');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.version === SAVE_VERSION) return parsed;
    }
  } catch {}
  return { balance: STARTING_BALANCE, collection: [], packs: [], market: DEFAULT_MARKET };
}

function saveState(state) {
  localStorage.setItem('tcg-sim', JSON.stringify({ ...state, version: SAVE_VERSION }));
}

export default function App() {
  const [balance, setBalance] = useState(() => loadState().balance);
  const [collection, setCollection] = useState(() => loadState().collection);
  const [packs, setPacks] = useState(() => loadState().packs ?? []);
  const [market, setMarket] = useState(() => ({ ...DEFAULT_MARKET, ...(loadState().market ?? {}) }));
  const [view, setView] = useState(VIEWS.SHOP);
  const [pendingCards, setPendingCards] = useState([]);
  const [pendingPackType, setPendingPackType] = useState(null);

  const tabRefs = useRef([]);
  const unpackBtnRef = useRef(null);
  const collectionBtnRef = useRef(null);
  const [underline, setUnderline] = useState({ left: 0, width: 0 });

  const [displayBalance, setDisplayBalance] = useState(balance);
  const [balancePumping, setBalancePumping] = useState(false);
  const prevBalanceRef = useRef(balance);
  const balanceAnimRef = useRef(null);

  useEffect(() => {
    const prev = prevBalanceRef.current;
    prevBalanceRef.current = balance;
    if (balance <= prev) { setDisplayBalance(balance); return; }
    if (balanceAnimRef.current) cancelAnimationFrame(balanceAnimRef.current);
    const from = prev, to = balance, duration = 700, t0 = performance.now();
    setBalancePumping(true);
    function step(now) {
      const t = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayBalance(from + (to - from) * eased);
      if (t < 1) { balanceAnimRef.current = requestAnimationFrame(step); }
      else { setDisplayBalance(to); setBalancePumping(false); }
    }
    balanceAnimRef.current = requestAnimationFrame(step);
    return () => { if (balanceAnimRef.current) cancelAnimationFrame(balanceAnimRef.current); };
  }, [balance]);

  useEffect(() => {
    saveState({ balance, collection, packs, market });
  }, [balance, collection, packs, market]);

  useEffect(() => {
    const tabIndex = VIEW_ORDER.indexOf(view);
    if (tabIndex === -1) return;
    const tab = tabRefs.current[tabIndex];
    if (tab) setUnderline({ left: tab.offsetLeft, width: tab.offsetWidth });
  }, [view]);

  function handleBuyPack(packTypeId) {
    const pt = PACK_TYPES[packTypeId];
    if (!pt || balance < pt.cost) return;
    setBalance(b => Math.round((b - pt.cost) * 100) / 100);
    setPacks(prev => [...prev, { id: Date.now() + Math.random(), packTypeId }]);
  }

  function handleOpenPack(packId) {
    const pack = packs.find(p => p.id === packId);
    const cards = openPack(pack?.packTypeId ?? 'iron');
    setPacks(prev => prev.filter(p => p.id !== packId));
    setPendingCards(cards);
    setPendingPackType(PACK_TYPES[pack?.packTypeId] ?? PACK_TYPES.iron);
  }

  function handlePackDone() {
    setCollection(prev => [...prev, ...pendingCards]);
    setPendingCards([]);
    setPendingPackType(null);
  }

  function handleSell(cardId) {
    const card = collection.find(c => c.id === cardId);
    if (!card) return;
    setBalance(b => Math.round((b + getCardSellValue(card)) * 100) / 100);
    setCollection(prev => prev.filter(c => c.id !== cardId));
  }

  function handleGrade(cardId, grade) {
    const card = collection.find(c => c.id === cardId);
    if (!card) return;
    const cost = getGradeCost(card);
    if (balance < cost) return;
    setBalance(b => Math.round((b - cost) * 100) / 100);
    setCollection(prev => prev.map(c =>
      c.id === cardId
        ? { ...c, grade, gradeAttempts: (c.gradeAttempts ?? 0) + 1 }
        : c
    ));
  }

  function handleFuse(cardIds, cost, newCard) {
    if (balance < cost) return;
    setBalance(b => Math.round((b - cost) * 100) / 100);
    setCollection(prev => {
      const filtered = prev.filter(c => !cardIds.includes(c.id));
      return newCard ? [...filtered, newCard] : filtered;
    });
  }

  function handleImprint(cardId, tag, success, newValue) {
    const card = collection.find(c => c.id === cardId);
    if (!card || card.tag) return;
    const cost = getImprintCost(tag, card.rarity);
    if (!cost || balance < cost) return;
    setBalance(b => Math.round((b - cost) * 100) / 100);
    if (success) {
      setCollection(prev => prev.map(c => c.id === cardId ? { ...c, tag, value: newValue } : c));
    } else {
      setCollection(prev => prev.filter(c => c.id !== cardId));
    }
  }

  function handleMarketSell(cardId, marketPrice) {
    if (!collection.find(c => c.id === cardId)) return;
    setBalance(b => Math.round((b + marketPrice) * 100) / 100);
    setCollection(prev => prev.filter(c => c.id !== cardId));
  }

  function handleBuyLegendarySlot() {
    const cost = LEGENDARY_SLOT_PRICES[market.legendarySlots];
    if (!cost || balance < cost || market.legendarySlots >= 5) return;
    setBalance(b => Math.round((b - cost) * 100) / 100);
    setMarket(m => ({ ...m, legendarySlots: m.legendarySlots + 1 }));
  }

  function handleBuyMythicSlot() {
    const cost = MYTHIC_SLOT_PRICES[market.mythicSlots];
    if (!cost || balance < cost || market.mythicSlots >= 5) return;
    setBalance(b => Math.round((b - cost) * 100) / 100);
    setMarket(m => ({ ...m, mythicSlots: m.mythicSlots + 1 }));
  }

  const opening = pendingCards.length > 0;

  return (
    <div className="app">
      <header className="header">
        <h1>TCG Simulator</h1>
        <nav>
          {VIEW_ORDER.map((v, i) => {
            let label;
            if (v === VIEWS.SHOP) label = 'Shop';
            else if (v === VIEWS.UNPACK) label = packs.length > 0 ? `Open (${packs.length})` : 'Open';
            else if (v === VIEWS.COLLECTION) label = `Collection (${collection.length})`;
            else if (v === VIEWS.MARKET) label = 'Market';
            else if (v === VIEWS.LAB) label = 'Lab';
            else label = 'FX';
            return (
              <button
                key={v}
                ref={el => {
                  tabRefs.current[i] = el;
                  if (v === VIEWS.UNPACK) unpackBtnRef.current = el;
                  if (v === VIEWS.COLLECTION) collectionBtnRef.current = el;
                }}
                className={view === v ? 'active' : ''}
                onClick={() => setView(v)}
                disabled={opening}
              >
                <span className="tab-icon">{TAB_ICONS[v]}</span>
                {label}
              </button>
            );
          })}
          <div
            className="nav-underline"
            style={{ left: `${underline.left}px`, width: `${underline.width}px` }}
          />
        </nav>
        <div className={`balance${balancePumping ? ' balance--pumping' : ''}`}>
          💵 {fmt(displayBalance)}
        </div>
      </header>

      <main className="main">
        {view === VIEWS.SHOP && (
          <Shop balance={balance} onBuyPack={handleBuyPack} packsNavRef={unpackBtnRef} />
        )}
        {view === VIEWS.UNPACK && (
          <UnpackPage
            packs={packs}
            pendingCards={pendingCards}
            pendingPackType={pendingPackType}
            onOpenPack={handleOpenPack}
            onPackDone={handlePackDone}
            collectionBtnRef={collectionBtnRef}
          />
        )}
        {view === VIEWS.COLLECTION && <Collection cards={collection} onSell={handleSell} />}
        {view === VIEWS.LAB && (
          <Lab
            cards={collection}
            balance={balance}
            onGrade={handleGrade}
            onFuse={handleFuse}
            onImprint={handleImprint}
          />
        )}
        {view === VIEWS.MARKET && (
          <Market
            cards={collection}
            onSell={handleMarketSell}
            market={market}
            onBuyLegendarySlot={handleBuyLegendarySlot}
            onBuyMythicSlot={handleBuyMythicSlot}
            balance={balance}
          />
        )}
        {view === VIEWS.FX && <FXEditor />}
      </main>
    </div>
  );
}
