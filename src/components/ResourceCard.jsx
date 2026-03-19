function buildResourceBackground(resource) {
  return {
    '--essence-color': resource.color,
    '--essence-glow': resource.glow,
    background: [
      `radial-gradient(circle at 18% 18%, ${resource.glow}, transparent 28%)`,
      `radial-gradient(circle at 82% 20%, color-mix(in srgb, ${resource.color} 45%, white 10%), transparent 26%)`,
      `radial-gradient(circle at 50% 62%, color-mix(in srgb, ${resource.color} 55%, black 45%), transparent 46%)`,
      `linear-gradient(165deg, color-mix(in srgb, ${resource.color} 52%, #0f172a 48%), #0b1020 58%, color-mix(in srgb, ${resource.color} 24%, black 76%) 100%)`,
    ].join(', '),
  };
}

function fmtCount(count) {
  return new Intl.NumberFormat('en-US').format(count ?? 0);
}

export default function ResourceCard({
  resource,
  count = 0,
  artSrc,
  tagLabel = 'Resource',
  backLabel = 'RESOURCE',
  className = '',
}) {
  const faceStyle = buildResourceBackground(resource);

  return (
    <div
      className={`card-face-wrapper no-twirl essence-card-face${count === 0 ? ' essence-card-face--empty' : ''} ${className}`.trim()}
      style={{ '--glow-color': resource.color }}
    >
      <div className="card-face-inner">
        <div className="card-face-front essence-card-front" style={faceStyle}>
          <div className="card-header-row essence-card-header">
            <span className="card-name essence-card-name">{resource.name}</span>
            <span className="essence-card-count">{fmtCount(count)}</span>
          </div>

          <div className="essence-art-window">
            <img src={artSrc} alt={resource.name} className="essence-art-img" />
          </div>

          <div className="card-tags-row">
            <span className="card-tag-pill card-tag-pill--tag essence-card-pill essence-card-pill--resource">
              <span className="card-tag-pill__label">{tagLabel}</span>
            </span>
          </div>
        </div>

        <div className="card-face-back essence-card-back" style={faceStyle}>
          <div className="essence-art-window essence-art-window--back">
            <img src={artSrc} alt={resource.name} className="essence-art-img" />
          </div>
          <span className="card-back-text">{backLabel}</span>
          <span className="card-back-tier">{resource.family}</span>
        </div>
      </div>
    </div>
  );
}
