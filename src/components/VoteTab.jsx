import { useState } from 'react';
import { VOTE_CHOICES, delegationForProposal, directVote, tallyProposal } from '../engine/delegation.js';
import { topicLabel } from '../engine/topics.js';
import { choiceLabel, nameOf, scopeLabel, shortHash } from '../ui/format.js';
import Term from './Term.jsx';

function verdict(t) {
  if (t.counted === 0) return 'Nimeni nu a votat încă.';
  if (t.totals.pentru > t.totals.impotriva) return 'Acum ar trece.';
  if (t.totals.pentru < t.totals.impotriva) return 'Acum ar fi respinsă.';
  return 'Acum e egalitate.';
}

/** Mihai → Bogdan → Ana → Pentru, drawn as a row of chips. */
function VotePath({ state, chain }) {
  const outcome =
    chain.status === 'direct'
      ? { cls: `out-${chain.choice}`, text: choiceLabel(chain.choice) }
      : { cls: 'out-lost', text: chain.status === 'ciclu' ? 'Buclă: se pierde' : 'Nu contează încă' };
  const shown = chain.status === 'ciclu' ? chain.path.slice(0, -1) : chain.path;
  const items = [
    ...shown.map((id, i) => ({ key: `${id}-${i}`, cls: i === 0 ? 'step me' : 'step', text: i === 0 ? 'Tu' : nameOf(state, id) })),
    ...(chain.status === 'ciclu' ? [{ key: 'loop', cls: 'step loop', text: `înapoi la ${nameOf(state, chain.path[chain.path.length - 1])}` }] : []),
    { key: 'out', cls: `step outcome ${outcome.cls}`, text: outcome.text },
  ];
  return (
    <ol className="vote-path" aria-label="Traseul votului tău">
      {items.map((it, i) => (
        <li key={it.key}>
          {i > 0 && <span className="path-arrow" aria-hidden="true">→</span>}
          <span className={it.cls}>{it.text}</span>
        </li>
      ))}
    </ol>
  );
}

function explain(state, chain, delegation) {
  const n = (id) => nameOf(state, id);
  if (chain.status === 'direct' && chain.path.length === 1) return <>Ai votat singur. Votul direct are mereu prioritate față de orice delegare.</>;
  const via = delegation ? <> (încrederea ta {scopeLabel(state, delegation.scope)})</> : null;
  if (chain.status === 'direct' && chain.path.length === 2)
    return <>Ai lăsat decizia la {n(chain.end)}{via}. {n(chain.end)} a votat {choiceLabel(chain.choice)}, deci și votul tău contează așa.</>;
  if (chain.status === 'direct')
    return (
      <>
        Ai lăsat decizia la {n(chain.path[1])}{via}, care la rândul lui are încredere în altcineva. Votul tău{' '}
        <Term k="tranzitiv">trece din om în om</Term> până la {n(chain.end)}, care a votat {choiceLabel(chain.choice)}.
      </>
    );
  if (chain.status === 'ciclu')
    return <>Delegarea ta intră într-o <Term k="bucla">buclă</Term> și votul se pierde. Votează singur sau alege pe altcineva.</>;
  if (chain.path.length > 1) return <>Ai lăsat decizia la {n(chain.path[1])}{via}, dar la capătul lanțului nimeni nu a votat încă.</>;
  return <>Nu ai votat și nu ai lăsat pe nimeni să decidă pentru tine. Deocamdată vocea ta nu contează.</>;
}

function DelegateForm({ state, actor, proposal, act, onDone, disabled }) {
  const others = Object.values(state.participants).filter((p) => p.id !== actor);
  const [to, setTo] = useState(others[0].id);
  const [kind, setKind] = useState('sector');
  const scope = kind === 'total' ? { kind } : kind === 'sector' ? { kind, topic: proposal.topic } : { kind, proposalId: proposal.id };
  const votedHere = Boolean(directVote(state, proposal.id, actor));

  return (
    <form
      className="delegate-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await act('delegare_setata', { from: actor, to, scope })) onDone();
      }}
    >
      <p className="sentence">
        <span>Am încredere în</span>
        <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="Persoana">
          {others.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Pentru ce">
          <option value="punctual">doar pentru această propunere</option>
          <option value="sector">pentru toată tema {topicLabel(proposal.topic)}</option>
          <option value="total">pentru toate temele</option>
        </select>
      </p>
      {votedHere && (
        <p className="hint warn">Ai votat deja singur aici, iar votul tău direct are prioritate. Retrage-ți votul dacă vrei ca delegarea să se aplice și la această propunere.</p>
      )}
      <div className="btn-row">
        <button type="submit" className="primary" disabled={disabled}>Deleagă</button>
        <button type="button" className="quiet" onClick={onDone}>Renunță</button>
      </div>
    </form>
  );
}

function ProposalCard({ state, proposal, actor, act, receipt, disabled, focused }) {
  const [delegating, setDelegating] = useState(false);
  const t = tallyProposal(state, proposal.id);
  const chain = t.chains[actor];
  const mine = directVote(state, proposal.id, actor);
  const delegation = mine ? null : delegationForProposal(state, actor, proposal);
  const lostCount = t.total - t.counted;
  const segs = [
    { id: 'pentru', n: t.totals.pentru, label: 'pentru' },
    { id: 'impotriva', n: t.totals.impotriva, label: 'împotrivă' },
    { id: 'abtinere', n: t.totals.abtinere, label: 'abțineri' },
    { id: 'pierdut', n: lostCount, label: 'nu contează' },
  ];
  const carriers = Object.entries(t.weights).sort((a, b) => b[1] - a[1]);

  return (
    <article className={`card ${focused ? 'tour-focus' : ''}`} id={`card-${proposal.id}`}>
      <header className="card-head">
        <span className="topic-tag">{topicLabel(proposal.topic)}</span>
        <h3>{proposal.title}</h3>
        <p className="muted">{proposal.description}</p>
      </header>

      <div className="mini-result">
        <div className="mini-bar" aria-hidden="true">
          {segs.map((s) => (s.n > 0 ? <span key={s.id} className={`seg-${s.id}`} style={{ flexGrow: s.n }} /> : null))}
        </div>
        <p className="mini-legend">
          {segs.filter((s) => s.n > 0).map((s) => (
            <span key={s.id}><i className={`dot seg-${s.id}`} />{s.n} {s.label}</span>
          ))}
          <strong>{verdict(t)}</strong>
        </p>
      </div>

      <div className="your-vote">
        <h4>Votul tău</h4>
        <VotePath state={state} chain={chain} />
        <p>{explain(state, chain, delegation)}</p>
        {receipt && mine && (
          <p className="receipt">
            <Term k="chitanta">Chitanța</Term> ta: <code title={receipt.hash}>{shortHash(receipt.hash)}</code>
          </p>
        )}
      </div>

      <div className="vote-row" role="group" aria-label="Votează">
        {VOTE_CHOICES.map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={disabled}
            className={`vote vote-${c.id} ${mine?.choice === c.id ? 'cast' : ''}`}
            aria-pressed={mine?.choice === c.id}
            onClick={() => act('vot_exprimat', { proposalId: proposal.id, voter: actor, choice: c.id })}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="card-actions">
        {!delegating && (
          <button type="button" className="secondary" disabled={disabled} onClick={() => setDelegating(true)}>
            Lasă pe altcineva să decidă
          </button>
        )}
        {mine && (
          <button type="button" className="quiet" disabled={disabled} onClick={() => act('vot_retras', { proposalId: proposal.id, voter: actor })}>
            Retrage-mi votul
          </button>
        )}
      </div>
      {delegating && <DelegateForm state={state} actor={actor} proposal={proposal} act={act} onDone={() => setDelegating(false)} disabled={disabled} />}

      <details className="more">
        <summary>Cine poartă voturile la această propunere</summary>
        <ul className="plain-list">
          {carriers.map(([id, w]) => (
            <li key={id} className="row">
              <span>
                {nameOf(state, id)} <span className={`choice choice-${t.chains[id].choice}`}>{choiceLabel(t.chains[id].choice).toLowerCase()}</span>
              </span>
              <span className="weight">{w === 1 ? 'doar votul propriu' : `${w} voturi`}</span>
            </li>
          ))}
        </ul>
        {t.lost.ciclu.length > 0 && <p className="muted">Pierdute în buclă: {t.lost.ciclu.map((id) => nameOf(state, id)).join(', ')}.</p>}
        {t.lost.delegareBlocata.length > 0 && <p className="muted">Au delegat, dar nimeni nu a votat la capăt: {t.lost.delegareBlocata.map((id) => nameOf(state, id)).join(', ')}.</p>}
        {t.lost.neexprimat.length > 0 && <p className="muted">Nu au participat: {t.lost.neexprimat.map((id) => nameOf(state, id)).join(', ')}.</p>}
      </details>
    </article>
  );
}

function TrustList({ state, actor, act, disabled }) {
  const mine = Object.values(state.delegations).filter((d) => d.from === actor);
  const toMe = Object.values(state.delegations).filter((d) => d.to === actor);
  return (
    <div className="side-box">
      <h3>Oamenii în care ai încredere</h3>
      {mine.length === 0 ? (
        <p className="muted">Nu ai delegat nimănui. Pentru fiecare propunere decizi doar tu.</p>
      ) : (
        <ul className="plain-list">
          {mine.map((d) => (
            <li key={`${d.scope.kind}-${d.scope.topic ?? d.scope.proposalId ?? ''}`} className="row">
              <span><strong>{nameOf(state, d.to)}</strong> {scopeLabel(state, d.scope)}</span>
              <button type="button" className="link" disabled={disabled} onClick={() => act('delegare_retrasa', { from: actor, scope: d.scope })}>
                Retrage
              </button>
            </li>
          ))}
        </ul>
      )}
      <h3 className="gap">Cine are încredere în tine</h3>
      {toMe.length === 0 ? (
        <p className="muted">Deocamdată nimeni nu ți-a lăsat votul.</p>
      ) : (
        <ul className="plain-list">
          {toMe.map((d) => (
            <li key={`${d.from}-${d.scope.kind}-${d.scope.topic ?? d.scope.proposalId ?? ''}`} className="row">
              <span><strong>{nameOf(state, d.from)}</strong> {scopeLabel(state, d.scope)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function VoteTab({ state, actor, act, receipts, disabled, focusId }) {
  const myReceipts = receipts[actor] ?? [];
  return (
    <div className="tab-body">
      <div className="intro">
        <h2>Votul tău</h2>
        <p>
          La fiecare propunere ai două variante: votezi singur sau lași pe cineva în care ai încredere să decidă pentru
          tine (<Term k="delegare">delegare</Term>). Poți schimba oricând oricare dintre ele.
        </p>
      </div>
      <div className="vote-grid">
        <div className="cards">
          {Object.values(state.proposals).map((p) => (
            <ProposalCard
              key={`${p.id}-${actor}`}
              state={state}
              proposal={p}
              actor={actor}
              act={act}
              receipt={myReceipts.find((r) => r.proposalId === p.id)}
              disabled={disabled}
              focused={focusId === `card-${p.id}`}
            />
          ))}
        </div>
        <aside className="side">
          <TrustList state={state} actor={actor} act={act} disabled={disabled} />
          <div className="side-box">
            <h3>Unde ajunge votul tău</h3>
            <ol className="rules">
              <li>Dacă ai votat singur, contează votul tău.</li>
              <li>Dacă nu, merge la omul în care ai încredere: întâi cel ales pentru propunerea respectivă, apoi cel pentru temă, apoi cel pentru toate temele.</li>
              <li>Dacă nici el n-a votat, votul merge mai departe, la cel în care are el încredere.</li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
