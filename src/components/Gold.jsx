export default function Gold({ amount, className = '' }) {
  return (
    <span className={`gold-amount${className ? ` ${className}` : ''}`}>
      <span className="gold-coin" aria-hidden="true" />
      {Number(amount).toFixed(2)}
    </span>
  );
}
