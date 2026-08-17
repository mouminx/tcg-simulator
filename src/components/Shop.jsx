import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PackCard from './PackCard';
import { PACK_TYPES } from '../game/cards';
import Gold from './Gold';
import {
  SHOP_MATERIALS,
  getEscalatingShopPrice,
  getGoodsRotation,
  getRotationOffers,
  normalizeShopPurchases,
} from '../game/shop';
import { getShopMaterialArt } from '../game/resourceArt';
import { getLootTier } from '../game/lootTiers';
import LootTierBadge from './LootTierBadge';

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

function FlyingGood({ startX, startY, endX, endY, material, artSrc, onDone }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transform = `translate(${endX - startX}px, ${endY - startY}px) scale(0.08)`;
      el.style.opacity = '0';
    }));
    const timer = setTimeout(onDone, 620);
    return () => clearTimeout(timer);
  }, []);
  return createPortal(
    <div ref={ref} className="flying-good" style={{ left: startX, top: startY }} aria-hidden="true">
      <div className="card-face-wrapper no-twirl foundry-square-resource foundry-square-resource--owned goods-card__tile">
        <div className="card-face-inner">
          <div className="card-face-front foundry-square-resource__front">
            <div className="foundry-square-resource__art-wrap">
              {artSrc
                ? <img src={artSrc} alt="" className="foundry-square-resource__art" />
                : <span className="goods-card__no-art">⬡</span>}
            </div>
            <LootTierBadge tier={getLootTier(material.inventory, material.id)} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function Shop({
  balance, onBuyPack, onBuyMaterial, packsNavRef, inventoryTargetRef, shopPurchases,
  packsHeld = 0, maxPacks = Infinity,
  /**
   * Permanent upgrades, as `{ id, label, detail, unit, cost, current, max }`.
   *
   * Supplied by App rather than defined here, because the costs and the caps already live beside the
   * handlers that spend the gold — and `onBuyUpgrade` takes an ID ONLY, never a price, for the same
   * reason `handleBuyMaterial` does: a handler that accepts an amount from the UI is a handler that can
   * be told to charge nothing.
   */
  upgrades = [],
  onBuyUpgrade,
}) {
  const buyBtnRefs = useRef({});
  const goodsTileRefs = useRef({});
  const [flyingPacks, setFlyingPacks] = useState([]);
  const [flyingGoods, setFlyingGoods] = useState([]);
  const [goodsTooltip, setGoodsTooltip] = useState(null);
  const [activeSection, setActiveSection] = useState('goods');

  /**
   * The rotation shelf, rebuilt as the window turns.
   *
   * `now` ticks once a second so the five-minute countdown reaches the next shelf without a stale minute.
   * The offers themselves are a pure function of the clock (see `getRotationOffers`), so nothing is stored
   * and a reload cannot reroll them.
   */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const rotation = getRotationOffers(now);
  const goodsRotation = getGoodsRotation(now);
  const purchases = normalizeShopPurchases(shopPurchases, now);
  const minsLeft = Math.floor(Math.max(0, rotation.msRemaining) / 60_000);
  const secsLeft = Math.floor(Math.max(0, rotation.msRemaining % 60_000) / 1000);
  const countdown = `${minsLeft}:${String(secsLeft).padStart(2, '0')}`;
  const rotatedGoods = goodsRotation.offers
    .map(offer => SHOP_MATERIALS.find(material => material.shopId === offer.materialId))
    .filter(Boolean);

  const SECTIONS = [
    {
      id: 'packs',
      label: 'Card Packs',
      packIds: ['blankSlate', ...rotation.offers.map(offer => offer.packId)],
    },
    {
      id: 'goods',
      label: 'Goods',
      packIds: rotatedGoods.map(material => material.shopId),
    },
    {
      id: 'upgrades',
      label: 'Upgrades',
      // Only what can still be bought. A shelf of maxed-out upgrades is a shelf of things you cannot
      // buy, even though the category itself remains available in the rail.
      packIds: upgrades.filter(u => u.cost != null && u.current < u.max).map(u => u.id),
    },
  ];
  const activeSectionMeta = SECTIONS.find(section => section.id === activeSection) ?? SECTIONS[0];
  const activeSectionStatus = activeSection === 'upgrades' ? 'Permanent' : `New stock in ${countdown}`;

  const packsFull = packsHeld >= maxPacks;

  function handleBuy(pt) {
    if (packsFull) return;
    const price = getEscalatingShopPrice(pt.cost, purchases.packs[pt.id] ?? 0);
    if (balance < price) return;
    if (onBuyPack?.(pt.id) !== true) return;
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
  }

  function handleBuyGood(material) {
    const price = getEscalatingShopPrice(material.cost, purchases.goods[material.shopId] ?? 0);
    if (balance < price || onBuyMaterial?.(material.shopId) !== true) return;
    const source = goodsTileRefs.current[material.shopId];
    const target = inventoryTargetRef?.current;
    if (source && target) {
      const start = source.getBoundingClientRect();
      const end = target.getBoundingClientRect();
      const id = Date.now() + Math.random();
      setFlyingGoods(previous => [...previous, {
        id,
        material,
        artSrc: getShopMaterialArt(material),
        startX: start.left,
        startY: start.top,
        endX: end.left + end.width / 2 - start.width / 2,
        endY: end.top + end.height / 2 - start.height / 2,
      }]);
    }
  }

  return (
    <>
      <div className={`shop${packsFull ? ' shop--packs-full' : ''}`}>
        <div className="shop-topbar">
          <div className="shop-categories" role="tablist" aria-label="Shop sections">
            {SECTIONS.map(section => (
              <button
                key={section.id}
                role="tab"
                aria-selected={activeSection === section.id}
                className={`shop-category${activeSection === section.id ? ' shop-category--active' : ''}`}
                onClick={() => setActiveSection(section.id)}
              >
                <span className="shop-category__label">{section.label}</span>
              </button>
            ))}
          </div>

          <div className="shop-header">
            <h2>Shop</h2>
            <h3 className="shop-header__section">{activeSectionMeta.label}</h3>
            <p className="shop-header__status">{activeSectionStatus}</p>
          </div>
        </div>

        <div className="shop-layout">

          {activeSection === 'goods' && (
            <div className="shop-section shop-section--goods">
              {/* The goods themselves, as the same square resource cards the Bag and the production
                  queues draw — so what you are buying looks like what you will receive. It was a list of
                  text rows with a price button, which read as a spreadsheet rather than a shop. */}
              <ul className="goods-grid">
                {rotatedGoods.map(material => {
                  const bought = purchases.goods[material.shopId] ?? 0;
                  const price = getEscalatingShopPrice(material.cost, bought);
                  const affordable = balance >= price;
                  const artSrc = getShopMaterialArt(material);
                  return (
                    <li
                      key={material.shopId}
                      className="goods-card"
                      onMouseEnter={event => setGoodsTooltip({
                        x: event.clientX,
                        y: event.clientY,
                        name: material.label,
                        body: `Buy 1 · ${bought} purchased this rotation · Current price ${price} gold`,
                      })}
                      onMouseMove={event => setGoodsTooltip(previous => previous && ({ ...previous, x: event.clientX, y: event.clientY }))}
                      onMouseLeave={() => setGoodsTooltip(null)}
                    >
                      {/* `card-face-wrapper no-twirl foundry-square-resource` is the shared inventory tile
                          treatment, reused rather than restyled so the two cannot drift apart. */}
                      <div
                        ref={element => { goodsTileRefs.current[material.shopId] = element; }}
                        className="card-face-wrapper no-twirl foundry-square-resource foundry-square-resource--owned goods-card__tile"
                      >
                        <div className="card-face-inner">
                          <div className="card-face-front foundry-square-resource__front">
                            <div className="foundry-square-resource__art-wrap">
                              {artSrc
                                ? <img src={artSrc} alt={material.label} className="foundry-square-resource__art" />
                                : <span className="goods-card__no-art" aria-hidden="true">⬡</span>}
                            </div>
                            <LootTierBadge tier={getLootTier(material.inventory, material.id)} />
                            <button
                              type="button"
                              className="goods-item__buy goods-card__buy"
                              disabled={!affordable}
                              aria-label={`Buy one ${material.label} for ${price}`}
                              onClick={() => handleBuyGood(material)}
                            >
                              <Gold amount={price} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {activeSection === 'upgrades' && (
            <div className="shop-section shop-section--upgrades">
              <ul className="goods-shelf upgrade-shelf">
                {upgrades.map(upgrade => {
                  const maxed = upgrade.current >= upgrade.max || upgrade.cost == null;
                  const affordable = !maxed && balance >= upgrade.cost;
                  return (
                    <li key={upgrade.id} className={`goods-item upgrade-item${maxed ? ' upgrade-item--maxed' : ''}`}>
                      <span className="upgrade-item__level">
                        {/* The current and next value, not a bare cost. "45 gold" says nothing about what
                            you get; "3 → 4" is the whole proposition. */}
                        {upgrade.current}
                        {!maxed && <span className="upgrade-item__arrow" aria-hidden="true"> → </span>}
                        {!maxed && upgrade.current + 1}
                      </span>
                      <span className="upgrade-item__text">
                        <span className="goods-item__label">{upgrade.label}</span>
                        <span className="upgrade-item__detail">{upgrade.detail}</span>
                      </span>
                      {maxed ? (
                        <span className="upgrade-item__maxed">Maxed</span>
                      ) : (
                        <button
                          type="button"
                          className="goods-item__buy"
                          disabled={!affordable}
                          onClick={() => onBuyUpgrade?.(upgrade.id)}
                        >
                          <Gold amount={upgrade.cost} />
                        </button>
                      )}
                    </li>
                  );
                })}
                {upgrades.length === 0 && (
                  <li className="goods-item upgrade-item--empty">Nothing left to upgrade.</li>
                )}
              </ul>
            </div>
          )}

          {SECTIONS.filter(section => section.id === activeSection && section.id === 'packs').map(section => {
            const packs = section.packIds.map(id => PACK_TYPES[id]).filter(Boolean);
            return (
              <div key={section.id} className={`shop-section shop-section--${section.id}`}>
                {/* Shelf: packs stand on a plank, price tags hang off its front edge.
                    The `shop-pack-card--{id}` modifier is kept on each pack so the
                    existing per-pack glow and hover-colour rules still apply. */}
                <div className="shop-shelf">
                  <div className="shop-shelf__plank" aria-hidden="true" />
                  <div className="shop-shelf__packs">
                    {packs.map(pt => {
                      // Same pure function App uses to charge, so the tag cannot show a price that is not
                      // the one taken. See handleBuyPack.
                      const price = getEscalatingShopPrice(pt.cost, purchases.packs[pt.id] ?? 0);
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
      {flyingGoods.map(item => (
        <FlyingGood
          key={item.id}
          {...item}
          onDone={() => setFlyingGoods(previous => previous.filter(entry => entry.id !== item.id))}
        />
      ))}
      {goodsTooltip && createPortal(
        <div className="resource-tooltip shop-goods-tooltip" style={{ left: goodsTooltip.x, top: goodsTooltip.y }}>
          <span className="resource-tooltip__name">{goodsTooltip.name}</span>
          <span className="resource-tooltip__desc">{goodsTooltip.body}</span>
        </div>,
        document.body,
      )}
    </>
  );
}
