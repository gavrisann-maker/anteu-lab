import { useState } from 'react';
import { EVENT_LABELS, SYSTEM_AUTHOR } from '../engine/state.js';
import { describeEntry, genitive, nameOf, shortHash } from '../ui/format.js';
import Term from './Term.jsx';

export default function LedgerTab({ state, entries, actor, report, receiptCheck, onAudit, onTamper, onCheckReceipts, tampered, reset, focusId }) {
  const [showAll, setShowAll] = useState(false);
  const ordered = [...entries].reverse();
  const brokenAt = report?.chain && !report.chain.ok ? report.chain.brokenAt : null;
  const visible = showAll || brokenAt !== null ? ordered : ordered.slice(0, 10);

  return (
    <div className="tab-body">
      <div className="intro">
        <h2>Registrul public</h2>
        <p>
          Tot ce se întâmplă se scrie într-un <Term k="registru">registru</Term>, ca într-un caiet cu pagini numerotate.
          Fiecare pagină are un <Term k="sigiliu">sigiliu</Term> calculat din conținutul ei și din sigiliul paginii
          dinainte. Rezultatele și mandatele nu sunt salvate separat: sunt recalculate din registru, așa că oricine are o
          copie le poate verifica singur.
        </p>
      </div>

      <div className="ledger-steps">
        <section className={`step-box ${focusId === 'audit-box' ? 'tour-focus' : ''}`} id="audit-box">
          <h3>Verifică registrul</h3>
          <p className="muted">Recalculează toate sigiliile și verifică dacă fiecare mandat acordat sau retras respectă regulile.</p>
          <button type="button" className="primary" onClick={() => onAudit()}>Verifică registrul</button>
          {report && (
            <div className={`audit ${report.ok ? 'audit-ok' : 'audit-bad'}`} role="status">
              {report.ok ? (
                <>
                  <p>Totul e în regulă: sigiliile se potrivesc și fiecare decizie a <Term k="contractCivic">contractului civic</Term> rezultă din reguli.</p>
                  {tampered && <p className="audit-note">Atenție: un registru rescris complet trece și de acest test. Verifică chitanțele.</p>}
                </>
              ) : (
                <>
                  {!report.chain.ok && <p>Pagina #{report.chain.brokenAt} a fost modificată: conținutul nu mai corespunde sigiliului.</p>}
                  {!report.consistency.ok && <p>Problemă la pagina #{report.consistency.at}: {report.consistency.reason}</p>}
                </>
              )}
            </div>
          )}
        </section>

        <section className="step-box">
          <h3>Încearcă să trișezi</h3>
          <p className="muted">Joacă rolul cuiva care are acces la baza de date și schimbă votul Anei din „Pentru” în „Împotrivă”.</p>
          <button type="button" className="danger" onClick={() => onTamper(false)} disabled={tampered}>Schimbă votul pe ascuns</button>
          <button type="button" className="danger" onClick={() => onTamper(true)} disabled={tampered}>Schimbă votul și refă toate sigiliile</button>
          {tampered && (
            <button type="button" className="quiet" onClick={reset}>Repornește scenariul</button>
          )}
        </section>

        <section className={`step-box ${focusId === 'receipts-box' ? 'tour-focus' : ''}`} id="receipts-box">
          <h3>Verifică chitanțele</h3>
          <p className="muted">
            Cine votează primește o <Term k="chitanta">chitanță</Term>. Verifică dacă chitanțele {genitive(nameOf(state, actor))} se
            mai găsesc în registru.
          </p>
          <button type="button" className="secondary" onClick={onCheckReceipts}>Verifică chitanțele {genitive(nameOf(state, actor))}</button>
          {receiptCheck && (
            <div className="audit" role="status">
              {receiptCheck.items.length === 0 ? (
                <p>{nameOf(state, receiptCheck.actor)} nu a votat încă, deci nu are chitanțe. Alege pe Ana sus, de exemplu.</p>
              ) : (
                receiptCheck.items.map((r) => (
                  <p key={r.hash} className={r.found ? 'ok' : 'bad'}>
                    „{state.proposals[r.proposalId]?.title}”: {r.found ? 'chitanța se găsește în registru.' : 'chitanța nu mai există. Registrul a fost rescris!'}
                  </p>
                ))
              )}
            </div>
          )}
        </section>
      </div>

      <p className="lesson">
        De ce contează: un registru pe care îl ține o singură instituție poate fi rescris integral. Garanția vine din copii
        independente și din chitanțele oamenilor. Carta albă ANTEU propune ca aceste copii să fie ținute de universități.
      </p>

      <h3 className="entries-title">Paginile registrului, cele mai noi primele</h3>
      <ol className="entries" reversed>
        {visible.map((e) => (
          <li key={e.index} className={`entry ${e.author === SYSTEM_AUTHOR ? 'sys' : ''} ${brokenAt === e.index ? 'broken' : ''}`}>
            <span className="entry-index">#{e.index}</span>
            <span className="entry-body">
              <span className="entry-type">{EVENT_LABELS[e.type] ?? e.type}</span>
              <span>{describeEntry(state, e)}</span>
            </span>
            <span className="entry-hash" title={e.hash}>
              <span className="sr-only">Sigiliu </span>
              <code>{shortHash(e.hash)}</code>
            </span>
          </li>
        ))}
      </ol>
      {entries.length > 10 && brokenAt === null && (
        <button type="button" className="link" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Arată doar ultimele 10' : `Arată toate cele ${entries.length} pagini`}
        </button>
      )}
    </div>
  );
}
