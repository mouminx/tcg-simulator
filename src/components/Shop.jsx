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
    id: 'editions',
    label: 'Tag Editions',
    tagline: '15 cards · 1.2× tag rate',
    detail: 'Each edition boosts one finish. Six shelves worth of packs, one shelf.',
    packIds: ['holoEd', 'foilEd', 'reverseEd', 'shadowEd', 'nexusEd', 'prismaticEd'],
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

export default function Shop({ balance, onBuyPack, packsNavRef, packsHeld = 0, maxPacks = Infinity }) {
  const buyBtnRefs = useRef({});
  const [flyingPacks, setFlyingPacks] = useState([]);
  // One shelf at a time. Ten stacked sections was ~3600px of scroll; five categories
  // with one visible shelf fits any viewport and reads as a shop counter.
  const [activeSection, setActiveSection] = useState(SECTIONS[1].id);

  const packsFull = packsHeld >= maxPacks;

  function handleBuy(pt) {
    if (balance < pt.cost || packsFull) return;
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
      <div className={`shop${packsFull ? ' shop--packs-full' : ''}`}>
        <div className="shop-header">
          <h2>Shop</h2>
          {/* No standing subtitle. Explanatory prose under a heading reads as a web page
              rather than a game; the shelf itself says what this screen is for. The one line
              that stays is functional — it tells the player why buying stopped working. */}
          {packsFull && (
            <p className="shop-subtitle">
              {`Pack limit reached — open some of your ${packsHeld} unopened packs to buy more.`}
            </p>
          )}
        </div>

        <div className="shop-categories" role="tablist" aria-label="Pack categories">
          {SECTIONS.map(section => (
            <button
              key={section.id}
              role="tab"
              aria-selected={activeSection === section.id}
              className={`shop-category${activeSection === section.id ? ' shop-category--active' : ''}`}
              onClick={() => setActiveSection(section.id)}
            >
              <span className="shop-category__label">{section.label}</span>
              <span className="shop-category__count">{section.packIds.length}</span>
            </button>
          ))}
        </div>

        {SECTIONS.filter(section => section.id === activeSection).map(section => {
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

              {/* Shelf: packs stand on a plank, price tags hang off its front edge.
                  The `shop-pack-card--{id}` modifier is kept on each pack so the
                  existing per-pack glow and hover-colour rules still apply. */}
              <div className="shop-shelf">
                <div className="shop-shelf__plank" aria-hidden="true" />
                <div className="shop-shelf__packs">
                  {packs.map(pt => {
                    const canAfford = balance >= pt.cost;
                    const blocked = !canAfford || packsFull;
                    return (
                      <div
                        key={pt.id}
                        className={`shelf-pack${blocked ? ' shelf-pack--unaffordable' : ''}`}
                      >
                        <button
                          ref={el => { buyBtnRefs.current[pt.id] = el; }}
                          className={`shelf-pack__grab shop-pack-card--${pt.id}`}
                          onClick={() => handleBuy(pt)}
                          disabled={blocked}
                          title={
                            packsFull
                              ? `Open some packs first — ${maxPacks} unopened is the limit`
                              : canAfford
                                ? `Buy ${pt.name} Pack — ${pt.description}`
                                : `Not enough gold for ${pt.name} Pack`
                          }
                          aria-label={`Buy ${pt.name} Pack for ${pt.cost}. ${pt.description}`}
                        >
                          <span className="shop-pack-preview">
                            <PackCard size="shelf" packType={pt} />
                          </span>
                          <span className="shelf-pack__contact" aria-hidden="true" />
                        </button>

                        <div className="shelf-pack__tag">
                          <span className="shelf-pack__tag-name">{pt.name}</span>
                          <span className="shelf-pack__tag-price">
                            {blocked ? <span className="shelf-pack__tag-short"><Gold amount={pt.cost} /></span> : <Gold amount={pt.cost} />}
                          </span>
                        </div>

                        <p className="shelf-pack__desc">{pt.description}</p>
                      </div>
                    );
                  })}
                </div>
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
