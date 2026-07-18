import './DensityDial.css';

const OPTIONS = [
  { value: 'sum', label: 'Sum' },
  { value: 'norm', label: 'Norm' },
  { value: 'verb', label: 'Verb' },
];

export default function DensityDial({ value, onChange }) {
  return (
    <div className="density-dial" role="radiogroup" aria-label="densidade do transcript">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          className={`density-dial__opt${value === opt.value ? ' density-dial__opt--active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
