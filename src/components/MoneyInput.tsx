import { useEffect, useState } from 'react';
import { formatZahl, parseGermanNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

interface MoneyInputProps {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  /** Schriftgröße — "lg" für prominente EK/VK-Felder. */
  size?: 'normal' | 'lg';
}

export function MoneyInput({
  value,
  onChange,
  placeholder = '0,00',
  className,
  id,
  required,
  disabled,
  size = 'normal',
}: MoneyInputProps) {
  const [text, setText] = useState<string>(value != null ? formatZahl(value) : '');

  // Wenn der externe Wert wechselt (z.B. Import), den Text mitziehen
  useEffect(() => {
    if (value == null) {
      if (text !== '') setText('');
    } else {
      const parsed = parseGermanNumber(text);
      if (parsed !== value) setText(formatZahl(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        required={required}
        disabled={disabled}
        className={cn(
          'input pr-9 text-right tabular-nums',
          size === 'lg' && 'text-2xl font-semibold py-3',
          className,
        )}
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          const parsed = parseGermanNumber(v);
          onChange(parsed);
        }}
        onBlur={() => {
          const parsed = parseGermanNumber(text);
          if (parsed != null) setText(formatZahl(parsed));
          else if (text.trim() === '') setText('');
        }}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
        €
      </span>
    </div>
  );
}
