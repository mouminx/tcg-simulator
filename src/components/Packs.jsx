import { useState } from 'react';
import PackCard from './PackCard';
import { PACK_TYPES } from '../game/cards';

const PACK_PAGE = 20;

export default function Packs({ packs, onOpenPack }) {
  const [showAll, setShowAll] = useState(false);

  if (packs.length === 0) {
    return (
      <div className="packs-view">
        <h2>Your Packs</h2>
        <p className="empty-msg">No packs — visit the shop to buy some!</p>
      </div>
    );
  }

  const visible = showAll ? packs : packs.slice(0, PACK_PAGE);
  const hidden  = packs.length - visible.length;

  return (
    <div className="packs-view">
      <h2>Your Packs <span className="card-count">({packs.length} unopened)</span></h2>
      <div className="packs-grid">
        {visible.map(pack => {
          const packType = PACK_TYPES[pack.packTypeId] ?? PACK_TYPES.iron;
          return (
            <div key={pack.id} className="pack-grid-item">
              <PackCard size="sm" packType={packType} />
              <div className="open-overlay">
                <button className="open-btn" onClick={() => onOpenPack(pack.id)}>Open</button>
              </div>
            </div>
          );
        })}
      </div>
      {hidden > 0 && (
        <div className="load-more-row">
          <button className="load-more-btn" onClick={() => setShowAll(true)}>
            Show all ({hidden} more)
          </button>
        </div>
      )}
    </div>
  );
}
