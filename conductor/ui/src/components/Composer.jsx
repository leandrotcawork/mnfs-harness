import { useEffect, useRef, useState } from 'react';

/**
 * The composer is ALWAYS present at the base of a thread (per DESIGN-DECK §3.1). Its
 * behavior is honest per-state: active only when there is something real fase A can do
 * with the input (answering a pending ask_operator question). Every other state disables
 * the textarea with a plain-language label explaining why — no fake affordance.
 *
 * mode: 'answer' | 'disabled'
 */
export default function Composer({ mode, disabledLabel, placeholder, value, onChange, onSubmit, sending, extraActions }) {
  const ref = useRef(null);
  const [localValue, setLocalValue] = useState(value ?? '');

  useEffect(() => {
    if (value !== undefined) setLocalValue(value);
  }, [value]);

  const autoGrow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  };

  useEffect(autoGrow, [localValue]);

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  };

  const submit = () => {
    if (mode !== 'answer' || sending) return;
    const text = localValue.trim();
    if (!text) return;
    onSubmit(text);
    setLocalValue('');
    onChange?.('');
  };

  const disabled = mode !== 'answer' || sending;

  return (
    <div className={`composer${disabled ? ' composer--disabled' : ''}`}>
      <textarea
        ref={ref}
        className="composer__input mono"
        value={localValue}
        disabled={disabled}
        placeholder={disabled ? disabledLabel : placeholder}
        onChange={(e) => {
          setLocalValue(e.target.value);
          onChange?.(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        rows={1}
        aria-label="composer"
      />
      <div className="composer__actions">
        {extraActions}
        <button type="button" className="composer__send" disabled={disabled || !localValue.trim()} onClick={submit}>
          {sending ? 'enviando…' : 'enviar ⏎'}
        </button>
      </div>
    </div>
  );
}
