'use client';

import { useApp, type Step } from '@/lib/store';

const STEPS: { id: Step; label: string; n: number }[] = [
  { id: 'address', label: 'Adresse', n: 1 },
  { id: 'roof', label: 'Dach', n: 2 },
  { id: 'configure', label: 'Konfiguration', n: 3 },
  { id: 'lead', label: 'Angebot', n: 4 },
];

export default function Stepper() {
  const step = useApp((s) => s.step);
  const setStep = useApp((s) => s.setStep);

  const currentIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <ol className="stepper" aria-label="Konfigurations-Fortschritt">
      {STEPS.map((s, i) => {
        const reachable = i <= currentIndex;
        const isCurrent = i === currentIndex;
        const isDone = i < currentIndex;
        return (
          <li
            key={s.id}
            className={`stepper__item${isCurrent ? ' is-current' : ''}${isDone ? ' is-done' : ''}`}
            aria-current={isCurrent ? 'step' : undefined}
          >
            <button
              type="button"
              className="stepper__btn"
              disabled={!reachable}
              onClick={() => reachable && setStep(s.id)}
            >
              <span className="stepper__num">{isDone ? '✓' : s.n}</span>
              <span className="stepper__label">{s.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
