import PackCard from './PackCard';
import { PACK_TYPES } from '../game/cards';

export default function Packs({ packs, onOpenPack }) {
  if (packs.length === 0) {
    return (
      <div className="packs-view">
        <h2>Your Packs</h2>
        <p className="empty-msg">No packs — visit the shop to buy some!</p>
      </div>
    );
  }

  return (
    <div className="packs-view">
      <h2>Your Packs <span className="card-count">({packs.length} unopened)</span></h2>
      <div className="packs-grid">
        {packs.map(pack => {
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
    </div>
  );
}
