import { useEffect, useId, useRef, useState } from 'react';
import { GLOSSARY } from '../ui/glossary.js';

/** A word with a plain-language explanation that opens on click or tap. */
export default function Term({ k, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <span className="term" ref={ref}>
      <button type="button" className="term-word" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        {children}
      </button>
      {open && (
        <span className="term-pop" id={id} role="note">
          {GLOSSARY[k]}
        </span>
      )}
    </span>
  );
}
