import './TallyDot.css';

const LABEL = {
  red: 'precisa do operador',
  green: 'rodando',
  amber: 'atenção',
  off: 'encerrado',
};

/** Tally dot — always paired with a text label (state is never color-only, WCAG). */
export default function TallyDot({ tally, size = 8 }) {
  return (
    <span
      className={`tally-dot tally-dot--${tally}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={LABEL[tally] || tally}
      title={LABEL[tally] || tally}
    />
  );
}
