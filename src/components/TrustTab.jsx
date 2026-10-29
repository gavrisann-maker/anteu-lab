import { useEffect, useState } from 'react';
import { delegationKey, topicSupport } from '../engine/delegation.js';
import { mandateZone } from '../engine/recall.js';
import { TOPICS, topicLabel } from '../engine/topics.js';
import { nameOf } from '../ui/format.js';
import Term from './Term.jsx';
import TrustGraph from './TrustGraph.jsx';

const SCALE_MAX = 60;
const scale = (pct) => Math.min(100, (pct / SCALE_MAX) * 100);

const SCENARIOS = [
  { from: 'gabriela', scope: { kind: 'sector', topic: 'mediu' }, title: 'Gabriela nu mai are încredere', effect: 'Florin pierde puțin sprijin, dar rămâne în zona-tampon și își păstrează mandatul pe mediu.' },
  { from: 'elena', scope: { kind: 'sector', topic: 'mediu' }, title: 'Elena nu mai are încredere', effect: 'Dacă Gabriela a plecat deja, Florin coboară sub zona-tampon și pierde automat mandatul.' },
  { from: 'bogdan', scope: { kind: 'total' }, title: 'Bogdan nu mai are încredere în Ana', effect: 'Bogdan îi lua cu el și votul lui Dan. Ana pierde doi susținători pe educație.' },
];

function MandateRow({ state, topic, id, support, total, lost }) {
  const has = Boolean(state.mandates[topic]?.[id]);
  const zone = mandateZone(support, total, state.params);
  const pct = Math.round((support / total) * 100);
  const loss = Math.max(0, state.params.thresholdPct - state.params.bufferPct);
  let status;
  if (has && zone === 'zona-tampon') status = { cls: 'chip-buffer', text: 'Are mandat, dar e în zona-tampon' };
  else if (has) status = { cls: 'chip-on', text: 'Are mandat' };
  else if (lost) status = { cls: 'chip-lost', text: 'Mandat retras' };
  else status = { cls: '', text: 'Fără mandat' };
  return (
    <li className="support-row">
      <div className="support-head">
        <span>
          <strong>{nameOf(state, id)}</strong>{' '}
          <span className="muted">{support === 0 ? 'nimeni nu mai are încredere' : support === 1 ? '1 om are încredere' : `${support} oameni au încredere`} ({pct}%)</span>
        </span>
        <span className={`chip ${status.cls}`}>{status.text}</span>
      </div>
      <div className="meter" aria-hidden="true">
        <div className={`meter-fill ${has ? 'fill-on' : ''}`} style={{ width: `${scale(pct)}%` }} />
        <div className="meter-mark loss" style={{ left: `${scale(loss)}%` }} />
        <div className="meter-mark gain" style={{ left: `${scale(state.params.thresholdPct)}%` }} />
      </div>
    </li>
  );
}

export default function TrustTab({ state, entries, actor, act, topic, setTopic, disabled, focusId }) {
  const total = Object.keys(state.participants).length;
  const { support } = topicSupport(state, topic);
  // people who lost a mandate on this topic stay listed, so a recall is visible
  const lostHere = new Set(
    entries.filter((e) => e.type === 'mandat_retras' && e.payload.topic === topic).map((e) => e.payload.participantId),
  );
  const rows = Object.keys(state.participants)
    .filter((id) => support[id] > 0 || state.mandates[topic]?.[id] || lostHere.has(id))
    .sort((a, b) => support[b] - support[a]);
  const loss = Math.max(0, state.params.thresholdPct - state.params.bufferPct);
  const need = Math.ceil((state.params.thresholdPct * total) / 100);

  const [threshold, setThreshold] = useState(state.params.thresholdPct);
  const [buffer, setBuffer] = useState(state.params.bufferPct);
  useEffect(() => {
    setThreshold(state.params.thresholdPct);
    setBuffer(state.params.bufferPct);
  }, [state.params.thresholdPct, state.params.bufferPct]);
  const changed = threshold !== state.params.thresholdPct || buffer !== state.params.bufferPct;

  return (
    <div className="tab-body">
      <div className="intro">
        <h2>Încredere și mandate</h2>
        <p>
          Aici nu există alegeri o dată la patru ani. Cine adună încrederea a cel puțin {state.params.thresholdPct}% din
          comunitate pe o temă ({need} din {total} oameni) primește <Term k="mandat">mandat</Term>. Când încrederea scade
          sub {loss}%, mandatul se pierde singur: acesta este <Term k="recall">recall-ul nativ</Term>.
        </p>
      </div>

      <div className="seg-control" role="tablist" aria-label="Alege tema">
        {TOPICS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={topic === t.id} className={topic === t.id ? 'on' : ''} onClick={() => setTopic(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="trust-grid">
        <section className={`graph-box ${focusId === 'graph' ? 'tour-focus' : ''}`} id="graph" aria-label={`Graful încrederii pe ${topicLabel(topic)}`}>
          <TrustGraph state={state} topic={topic} actor={actor} />
        </section>

        <section className={`side-box mandates-box ${focusId === 'mandates' ? 'tour-focus' : ''}`} id="mandates">
          <h3>Cine are mandat pe {topicLabel(topic).toLowerCase()}</h3>
          {rows.length === 0 ? (
            <p className="muted">Nimeni nu și-a lăsat încrederea la altcineva pe această temă.</p>
          ) : (
            <ul className="plain-list">
              {rows.map((id) => (
                <MandateRow key={id} state={state} topic={topic} lost={lostHere.has(id) && !state.mandates[topic]?.[id]} id={id} support={support[id]} total={total} />
              ))}
            </ul>
          )}
          <p className="meter-key">
            <span><i className="mk mk-gain" /> pragul pentru mandat ({state.params.thresholdPct}%)</span>
            <span><i className="mk mk-loss" /> sub această linie se pierde mandatul ({loss}%)</span>
          </p>
          <p className="hint">
            Între cele două linii e <Term k="zonaTampon">zona-tampon</Term>: cine are deja mandat îl păstrează, cine nu are nu
            îl primește încă.
          </p>
        </section>
      </div>

      <section className="whatif">
        <h3>Ce s-ar întâmpla dacă…</h3>
        <p className="muted">Apasă pe un scenariu și urmărește graful și mandatele de pe tema afectată.</p>
        <div className="whatif-list">
          {SCENARIOS.map((s) => {
            const exists = Boolean(state.delegations[delegationKey(s.from, s.scope)]);
            return (
              <button
                key={s.title}
                type="button"
                className="scenario"
                disabled={!exists || disabled}
                onClick={async () => {
                  setTopic(s.scope.topic ?? 'educatie');
                  await act('delegare_retrasa', { from: s.from, scope: s.scope }, s.from);
                }}
              >
                <strong>{s.title}</strong>
                <span>{exists ? s.effect : 'S-a întâmplat deja. Repornește scenariul ca să încerci din nou.'}</span>
              </button>
            );
          })}
        </div>
      </section>

      <details className="rules-box">
        <summary>Schimbă regulile comunității</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            act('parametri_recall', { thresholdPct: threshold, bufferPct: Math.min(buffer, threshold) }, 'sistem');
          }}
        >
          <label className="slider">
            <span>Ai nevoie de încrederea a <strong>{threshold}%</strong> din comunitate ca să primești mandat</span>
            <input type="range" min="10" max="60" step="5" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
          </label>
          <label className="slider">
            <span>Marja de siguranță (zona-tampon): <strong>{Math.min(buffer, threshold)}%</strong>, deci mandatul se pierde sub <strong>{threshold - Math.min(buffer, threshold)}%</strong></span>
            <input type="range" min="0" max="30" step="5" value={buffer} onChange={(e) => setBuffer(Number(e.target.value))} />
          </label>
          <button type="submit" className="primary" disabled={!changed || disabled}>Aplică regulile noi</button>
          <p className="hint">Și schimbarea regulilor se scrie în registru, ca oricine să vadă cine a schimbat-o și când.</p>
        </form>
      </details>
    </div>
  );
}
