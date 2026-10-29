import { useEffect, useRef } from 'react';
import { TOUR } from '../ui/tour.js';

export default function Tour({ index, busy, onNext, onExit }) {
  const step = TOUR[index];
  const titleRef = useRef(null);

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, [index]);

  return (
    <aside className="tour" aria-labelledby="tour-title" aria-live="polite">
      <div className="tour-progress" aria-hidden="true">
        <span style={{ width: `${((index + 1) / TOUR.length) * 100}%` }} />
      </div>
      <p className="tour-count">Pasul {index + 1} din {TOUR.length}</p>
      <h2 id="tour-title" ref={titleRef} tabIndex={-1}>{step.title}</h2>
      <p>{step.text}</p>
      <div className="tour-actions">
        <button type="button" className="primary" onClick={onNext} disabled={busy}>
          {step.last ? 'Termină turul' : busy ? 'Se aplică…' : 'Mai departe'}
        </button>
        {!step.last && (
          <button type="button" className="quiet" onClick={onExit}>Ieși din tur</button>
        )}
      </div>
    </aside>
  );
}
