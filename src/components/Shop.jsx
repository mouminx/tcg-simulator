import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PackCard from './PackCard';
import { PACK_TYPES } from '../game/cards';
import Gold from './Gold';
import { PERMANENT_PACK_IDS } from '../game/cards';
import { SHOP_MATERIALS, getRotationOffers, discountedCost } from '../game/shop';

/**
 * The permanently-stocked shelves. Two, not five.
 *
 * The shop carried 21 purchasable packs across five shelves, of which most were permanently ignored — the
 * Horizon Set in particular was five 10-card near-duplicates of the Core ladder at overlapping prices, and
 * has been deleted. The Vault and Tag Edition packs still exist but are stocked a few at a time by the
 * rotation, so what is on sale changes instead of being a wall.
 */
const PERMANENT_SECTIONS = [
  {
    id: 'core',
    label: 'Core Set',
    tagline: '5 cards per pack',
    detail: 'The essentials. Standard drop rates across all rarities.',
    packIds: PERMANENT_PACK_IDS,
  },
  {
    id: 'arcana',
    label: 'Arcana Packs',
    tagline: '5 cards · Attunement-ready',
    detail: 'Blank Slate packs can be routed through the Arcana Station before opening.',
    packIds: ['blankSlate'],
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

export default function Shop({ balance, onBuyPack, onBuyMaterial, packsNavRef, packsHeld = 0, maxPacks = Infinity }) {
  const buyBtnRefs = useRef({});
  const [flyingPacks, setFlyingPacks] = useState([]);
  // One shelf at a time. Ten stacked sections was ~3600px of scroll; a few categories
  // with one visible shelf fits any viewport and reads as a shop counter.
  const [activeSection, setActiveSection] = useState(PERMANENT_SECTIONS[0].id);

  /**
   * The rotation shelf, rebuilt as the window turns.
   *
   * `now` ticks once a minute rather than once a second: the only thing it drives is a countdown shown to
   * the minute, so a per-second interval would re-render the whole shop sixty times for no visible change.
   * The offers themselves are a pure function of the clock (see `getRotationOffers`), so nothing is stored
   * and a reload cannot reroll them.
   */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const rotation = getRotationOffers(now);
  const discountById = Object.fromEntries(rotation.offers.map(o => [o.packId, o.discountPct]));
  const hoursLeft = Math.floor(rotation.msRemaining / 3_600_000);
  const minsLeft = Math.max(0, Math.round((rotation.msRemaining % 3_600_000) / 60_000));

  const SECTIONS = [
    ...PERMANENT_SECTIONS,
    {
      id: 'goods',
      label: 'Goods',
      tagline: 'Materials, delivered to your Bag',
      detail: 'Bought at a premium over what they sell for — a shortcut when a forge is idle, not a way to '
        + 'turn gold into more gold.',
      // Not packs. The shelf below branches on this id; the count still wants a length.
      packIds: SHOP_MATERIALS.map(m => m.id),
    },
    {
      id: 'rotation',
      label: 'Rotation Deals',
      tagline: hoursLeft > 0 ? `New stock in ${hoursLeft}h ${minsLeft}m` : `New stock in ${minsLeft}m`,
      detail: 'Vault and Edition packs, a few at a time. Rotates on its own — what is here now will not be.',
      packIds: rotation.offers.map(o => o.packId),
    },
  ];

  const packsFull = packsHeld >= maxPacks;

  function handleBuy(pt) {
    if (balance < discountedCost(pt.cost, discountById[pt.id] ?? 0) || packsFull) return;
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

        {activeSection === 'goods' && (
          <div className="shop-section shop-section--goods">
            <div className="shop-section-header">
              <div className="shop-section-title-row">
                <h3 className="shop-section-title">Goods</h3>
                <span className="shop-section-tagline">Materials, delivered to your Bag</span>
              </div>
              <p className="shop-section-detail">
                Bought at a premium over what they sell for — a shortcut when a forge is idle, not a way to
                turn gold into more gold.
              </p>
            </div>

            <ul className="goods-shelf">
              {SHOP_MATERIALS.map(material => {
                const affordable = balance >= material.cost;
                return (
                  <li key={material.id} className="goods-item">
                    <span className="goods-item__qty">×{material.qty}</span>
                    <span className="goods-item__label">{material.label}</span>
                    <button
                      type="button"
                      className="goods-item__buy"
                      disabled={!affordable}
                      title={affordable ? undefined : 'Not enough gold'}
                      onClick={() => onBuyMaterial?.(material.id)}
                    >
                      <Gold amount={material.cost} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {SECTIONS.filter(section => section.id === activeSection && section.id !== 'goods').map(section => {
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
                    // Same pure function App uses to charge, so the tag cannot show a price that is not
                    // the one taken. See handleBuyPack.
                    const price = discountedCost(pt.cost, discountById[pt.id] ?? 0);
                    const canAfford = balance >= price;
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
                          aria-label={`Buy ${pt.name} Pack for ${price}. ${pt.description}`}
                        >
                          <span className="shop-pack-preview">
                            <PackCard size="shelf" packType={pt} />
                          </span>
                          <span className="shelf-pack__contact" aria-hidden="true" />
                        </button>

                        <div className="shelf-pack__tag">
                          <span className="shelf-pack__tag-name">{pt.name}</span>
                          <span className="shelf-pack__tag-price">
                            {blocked
                              ? <span className="shelf-pack__tag-short"><Gold amount={price} /></span>
                              : <Gold amount={price} />}
                            {discountById[pt.id] > 0 && (
                              <span className="shelf-pack__discount">−{discountById[pt.id]}%</span>
                            )}
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
