import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildSeed } from './engine/seed.js';
import { audit, commit, replay } from './engine/state.js';
import { findReceipt, rehashAll } from './engine/ledger.js';
import { TOPICS } from './engine/topics.js';
import { choiceLabel, describeEntry, nameOf, scopeLabel, shortHash } from './ui/format.js';
import { TOUR } from './ui/tour.js';
import PersonaBar from './components/PersonaBar.jsx';
import VoteTab from './components/VoteTab.jsx';
import TrustTab from './components/TrustTab.jsx';
import LedgerTab from './components/LedgerTab.jsx';
import Tour from './components/Tour.jsx';

export const AUTHOR = 'David Găvrișan';

const TABS = [
  { id: 'vote', label: 'Votul tău', sub: 'votează sau deleagă' },
  { id: 'trust', label: 'Încredere și mandate', sub: 'cine reprezintă pe cine' },
  { id: 'ledger', label: 'Registrul', sub: 'verifică și încearcă să trișezi' },
];

/** What just happened, in plain words. */
function describeAction(state, { type, payload, author }, actor, entry) {
  const n = (id) => nameOf(state, id);
  const own = author === actor;
  switch (type) {
    case 'delegare_setata':
      return own
        ? `Gata. ${n(payload.to)} decide de acum pentru tine ${scopeLabel(state, payload.scope)}.`
        : `${n(payload.from)} are acum încredere în ${n(payload.to)} ${scopeLabel(state, payload.scope)}.`;
    case 'delegare_retrasa':
      return own
        ? `Ți-ai retras încrederea ${scopeLabel(state, payload.scope)}.`
        : `${n(payload.from)} și-a retras încrederea ${scopeLabel(state, payload.scope)}.`;
    case 'vot_exprimat':
      return `${own ? 'Ai votat' : `${n(payload.voter)} a votat`} „${choiceLabel(payload.choice)}”. Chitanța votului: ${shortHash(entry.hash)}.`;
    case 'vot_retras':
      return 'Ți-ai retras votul. Dacă ai lăsat pe cineva să decidă pentru tine, delegarea se aplică din nou.';
    case 'parametri_recall':
      return `Reguli noi: mandat de la ${payload.thresholdPct}%, pierdut sub ${payload.thresholdPct - payload.bufferPct}%.`;
    default:
      return 'Acțiunea a fost înregistrată.';
  }
}

export default function App() {
  const [entries, setEntriesState] = useState(null);
  const [receipts, setReceiptsState] = useState({});
  const [actor, setActorState] = useState('mihai');
  const [tab, setTab] = useState('vote');
  const [topic, setTopic] = useState(TOPICS[0].id);
  const [toast, setToast] = useState(null);
  const [tampered, setTampered] = useState(false);
  const [report, setReport] = useState(null);
  const [receiptCheck, setReceiptCheck] = useState(null);
  const [tourIndex, setTourIndex] = useState(null);
  const [tourBusy, setTourBusy] = useState(false);
  const [focusId, setFocusId] = useState(null);

  // Refs keep the latest values available to actions chained inside the tour.
  const entriesRef = useRef(null);
  const receiptsRef = useRef({});
  const actorRef = useRef('mihai');
  const setEntries = (next) => {
    entriesRef.current = next;
    setEntriesState(next);
  };
  const setReceipts = (next) => {
    receiptsRef.current = next;
    setReceiptsState(next);
  };
  const setActor = (id) => {
    actorRef.current = id;
    setActorState(id);
    setReceiptCheck(null);
  };

  const reset = useCallback(async () => {
    const seed = await buildSeed();
    setEntries(seed.entries);
    setReceipts(seed.receipts);
    setTampered(false);
    setReport(null);
    setReceiptCheck(null);
    setToast(null);
  }, []);

  useEffect(() => {
    reset();
  }, [reset]);

  const state = useMemo(() => (entries ? replay(entries) : null), [entries]);

  const act = async (type, payload, author = actorRef.current) => {
    const before = entriesRef.current;
    try {
      const next = await commit(before, { type, author, payload });
      setEntries(next);
      const entry = next[before.length];
      if (type === 'vot_exprimat' || type === 'vot_retras') {
        const list = (receiptsRef.current[author] ?? []).filter((r) => r.proposalId !== payload.proposalId);
        setReceipts({ ...receiptsRef.current, [author]: type === 'vot_exprimat' ? [...list, { proposalId: payload.proposalId, hash: entry.hash }] : list });
      }
      const after = replay(next);
      setToast({
        kind: 'ok',
        text: describeAction(after, { type, payload, author }, actorRef.current, entry),
        civic: next.slice(before.length + 1).map((e) => describeEntry(after, e)),
      });
      return true;
    } catch (err) {
      setToast({ kind: 'error', text: err.message, civic: [] });
      return false;
    }
  };

  const runAudit = async () => {
    const r = await audit(entriesRef.current);
    setReport(r);
    return r;
  };

  // Plays an attacker with database access: flips Ana's "Pentru" vote.
  const tamper = async (rewriteHistory) => {
    const cur = entriesRef.current;
    const i = cur.findIndex((e) => e.type === 'vot_exprimat' && e.payload.voter === 'ana' && e.payload.choice === 'pentru');
    if (i < 0) return;
    let next = cur.map((e, k) => (k === i ? { ...e, payload: { ...e.payload, choice: 'impotriva' } } : e));
    if (rewriteHistory) next = await rehashAll(next);
    setEntries(next);
    setTampered(true);
    setReport(null);
    setReceiptCheck(null);
    setToast(null);
  };

  const checkReceipts = (who = actorRef.current) => {
    const mine = receiptsRef.current[who] ?? [];
    setReceiptCheck({ actor: who, items: mine.map((r) => ({ ...r, found: Boolean(findReceipt(entriesRef.current, r.hash)) })) });
  };

  const goToStep = async (i) => {
    const step = TOUR[i];
    setTourBusy(true);
    setFocusId(null);
    setToast(null);
    setTourIndex(i);
    if (step.actor) setActor(step.actor);
    if (step.tab) setTab(step.tab);
    if (step.topic) setTopic(step.topic);
    if (step.run) await step.run({ act, audit: runAudit, tamper, checkReceipts, reset });
    setFocusId(step.focus ?? null);
    setTourBusy(false);
    if (step.focus) {
      const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(() => document.getElementById(step.focus)?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' }), 80);
    } else {
      window.scrollTo({ top: 0 });
    }
  };

  const startTour = async () => {
    await reset();
    await goToStep(0);
  };

  const endTour = async () => {
    setTourIndex(null);
    setFocusId(null);
    await reset();
    setActor('mihai');
    setTab('vote');
    window.scrollTo({ top: 0 });
  };

  const nextStep = () => (TOUR[tourIndex].last ? endTour() : goToStep(tourIndex + 1));

  if (!state) return <div className="loading">Se pregătește simularea…</div>;

  return (
    <div className={`app ${tourIndex !== null ? 'touring' : ''}`}>
      <header className="masthead">
        <h1>ANTEU Lab</h1>
        <p className="lede-big">
          Cum ar arăta o democrație în care poți vota singur la orice propunere sau poți lăsa pe cineva în care ai
          încredere să voteze pentru tine, iar reprezentanții își pierd mandatul imediat ce oamenii nu mai au încredere în ei?
        </p>
        <div className="cta-row">
          <button type="button" className="primary big" onClick={startTour} disabled={tourIndex !== null}>
            Pornește turul ghidat
          </button>
          <span className="muted">durează cam două minute</span>
          <button type="button" className="quiet" onClick={reset}>Repornește scenariul</button>
        </div>
      </header>

      <PersonaBar state={state} actor={actor} setActor={setActor} />

      <nav className="tabs-bar" aria-label="Secțiuni">
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'tab on' : 'tab'} onClick={() => setTab(t.id)}>
              <span className="tab-label">{t.label}</span>
              <span className="tab-sub">{t.sub}</span>
            </button>
          ))}
        </div>
      </nav>

      <div aria-live="polite">
        {tampered && (
          <div className="banner banner-danger" role="alert">
            <span>Registrul a fost modificat pentru demonstrație. Până nu repornești scenariul, rezultatele nu sunt de încredere și nu poți vota.</span>
            <button type="button" onClick={reset}>Repornește scenariul</button>
          </div>
        )}
        {toast && (
          <div className={`banner ${toast.kind === 'error' ? 'banner-danger' : 'banner-info'}`}>
            <span>
              {toast.kind === 'error' ? `Nu s-a putut: ${toast.text}` : toast.text}
              {toast.civic.map((c) => (
                <span key={c} className="civic-line">Contractul civic: {c}.</span>
              ))}
            </span>
            <button type="button" onClick={() => setToast(null)}>Închide</button>
          </div>
        )}
      </div>

      <main>
        {tab === 'vote' && <VoteTab state={state} actor={actor} act={act} receipts={receipts} disabled={tampered} focusId={focusId} />}
        {tab === 'trust' && <TrustTab state={state} entries={entries} actor={actor} act={act} topic={topic} setTopic={setTopic} disabled={tampered} focusId={focusId} />}
        {tab === 'ledger' && (
          <LedgerTab
            state={state}
            entries={entries}
            actor={actor}
            report={report}
            receiptCheck={receiptCheck}
            onAudit={runAudit}
            onTamper={tamper}
            onCheckReceipts={() => checkReceipts()}
            tampered={tampered}
            reset={reset}
            focusId={focusId}
          />
        )}
      </main>

      <footer className="foot">
        Prototip educațional open source, pornit de la Carta albă ANTEU 2027. Nu folosește identitate electronică reală și
        nu păstrează votul secret: tot ce se întâmplă e vizibil, ca mecanismele să poată fi înțelese.
      </footer>

      <p className="author"><span>Realizat de</span> {AUTHOR}</p>

      {tourIndex !== null && <Tour index={tourIndex} busy={tourBusy} onNext={nextStep} onExit={endTour} />}
    </div>
  );
}
