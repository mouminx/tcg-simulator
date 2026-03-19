import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PackCard from './PackCard';
import { PACK_TYPES } from '../game/cards';
import Gold from './Gold';

const SECTIONS = [
  {
    id: 'arcana',
    label: 'Arcana Packs',
    tagline: '5 cards · Attunement-ready',
    detail: 'Blank Slate packs can be routed through the Arcana Station before opening.',
    packIds: ['blankSlate'],
  },
  {
    id: 'core',
    label: 'Core Set',
    tagline: '5 cards per pack',
    detail: 'The essentials. Standard drop rates across all rarities.',
    packIds: ['dusk', 'iron', 'arcane', 'void', 'primordial'],
  },
  {
    id: 'horizon',
    label: 'Horizon Set',
    tagline: '10 cards per pack',
    detail: 'Double the cards, elevated odds. A new era of packs.',
    packIds: ['dawn', 'steel', 'mystic', 'abyss', 'eternal'],
  },
  {
    id: 'vault',
    label: 'Vault Collection',
    tagline: '20 cards per pack',
    detail: 'Premium packs engineered for rare and above. Every pull counts.',
    packIds: ['vault1', 'vault2', 'vault3'],
  },
  {
    id: 'holo-editions',
    label: 'Holo Editions',
    tagline: '15 cards · 1.2× Holo rate',
    detail: 'Prismatic shimmer on every pull. Your commons will never look the same.',
    packIds: ['holoEd'],
  },
  {
    id: 'foil-editions',
    label: 'Foil Editions',
    tagline: '15 cards · 1.2× Foil rate',
    detail: 'Chrome-touched and collector-grade. Metallic finishes at a premium.',
    packIds: ['foilEd'],
  },
  {
    id: 'reverse-editions',
    label: 'Reverse Editions',
    tagline: '15 cards · 1.2× Reverse rate',
    detail: 'The world flipped. Familiar cards in a striking new light.',
    packIds: ['reverseEd'],
  },
  {
    id: 'shadow-editions',
    label: 'Shadow Editions',
    tagline: '15 cards · 1.2× Shadow rate',
    detail: 'Darkness amplified. Rare silhouettes forged in rarity-glow.',
    packIds: ['shadowEd'],
  },
  {
    id: 'nexus-editions',
    label: 'Nexus Editions',
    tagline: '15 cards · 1.2× Nexus rate',
    detail: 'Void energy seeps through every card. The most coveted tag, boosted.',
    packIds: ['nexusEd'],
  },
  {
    id: 'prismatic-editions',
    label: 'Prismatic Editions',
    tagline: '15 cards · 1.2× Prismatic rate',
    detail: 'A spectrum in your hands. Every card cycling through the full colour wheel.',
    packIds: ['prismaticEd'],
  },
];

function FlyingPack({ startX, startY, endX, endY, packType, onDone }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = 'left 0.5s ease, top 0.5s ease, transform 0.5s ease, opacity 0.4s ease 0.1s';
        el.style.left = `${endX}px`;
        el.style.top = `${endY}px`;
        el.style.transform = 'translate(-50%, -50%) scale(0.1)';
        el.style.opacity = '0';
      });
    });
    const t = setTimeout(onDone, 600);
    return () => clearTimeout(t);
  }, []);

  return createPortal(
    <div ref={ref} className="flying-pack" style={{ left: startX, top: startY }}>
      <PackCard size="sm" packType={packType} />
    </div>,
    document.body
  );
}

export default function Shop({ balance, onBuyPack, packsNavRef }) {
  const buyBtnRefs = useRef({});
  const [flyingPacks, setFlyingPacks] = useState([]);

  function handleBuy(pt) {
    if (balance < pt.cost) return;
    const btn = buyBtnRefs.current[pt.id];
    if (btn && packsNavRef?.current) {
      const start = btn.getBoundingClientRect();
      const end = packsNavRef.current.getBoundingClientRect();
      const id = Date.now() + Math.random();
      setFlyingPacks(prev => [...prev, {
        id, packType: pt,
        startX: start.left + start.width / 2,
        startY: start.top + start.height / 2,
        endX: end.left + end.width / 2,
        endY: end.top + end.height / 2,
      }]);
    }
    onBuyPack(pt.id);
  }

  return (
    <>
      <div className="shop">
        <div className="shop-header">
          <h2>Shop</h2>
          <p className="shop-subtitle">Choose your pack. Shape your collection.</p>
        </div>

        {SECTIONS.map(section => {
          const packs = section.packIds.map(id => PACK_TYPES[id]).filter(Boolean);
          return (
            <div key={section.id} className={`shop-section shop-section--${section.id}`}>
              <div className="shop-section-header">
                <div className="shop-section-title-row">
                  <h3 className="shop-section-title">{section.label}</h3>
                  <span className="shop-section-tagline">{section.tagline}</span>
                </div>
                <p className="shop-section-detail">{section.detail}</p>
              </div>
              <div className="shop-pack-list">
                {packs.map(pt => {
                  const canAfford = balance >= pt.cost;
                  return (
                    <div key={pt.id} className={`shop-pack-card shop-pack-card--${pt.id}`}>
                      <div className="shop-pack-preview">
                        <PackCard size="sm" packType={pt} />
                      </div>
                      <div className="pack-info">
                        <h3>{pt.name} Pack</h3>
                        <p>{pt.description}</p>
                        <p className="pack-cost"><Gold amount={pt.cost} /></p>
                      </div>
                      <button
                        ref={el => { buyBtnRefs.current[pt.id] = el; }}
                        className={`buy-btn ${!canAfford ? 'disabled' : ''}`}
                        onClick={() => handleBuy(pt)}
                        disabled={!canAfford}
                      >
                        {canAfford ? 'Buy' : 'Not enough'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {flyingPacks.map(p => (
        <FlyingPack
          key={p.id}
          startX={p.startX} startY={p.startY}
          endX={p.endX} endY={p.endY}
          packType={p.packType}
          onDone={() => setFlyingPacks(prev => prev.filter(fp => fp.id !== p.id))}
        />
      ))}
    </>
  );
}
