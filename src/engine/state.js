// Event sourcing: the ledger is the single source of truth. The current state is never
// stored separately, it is always *replayed* from the ledger. Anyone holding a copy of the
// ledger can therefore recompute every result and every mandate change on their own.

import { canonical, makeEntry, verifyChain } from './ledger.js';
import { delegationKey } from './delegation.js';
import { mandateTransitions } from './recall.js';
import { TOPICS } from './topics.js';

export const SYSTEM_AUTHOR = 'contract-civic';

export const EVENT_LABELS = {
  participant_adaugat: 'Participant adăugat',
  propunere_adaugata: 'Propunere adăugată',
  delegare_setata: 'Delegare',
  delegare_retrasa: 'Delegare retrasă',
  vot_exprimat: 'Vot exprimat',
  vot_retras: 'Vot retras',
  parametri_recall: 'Parametri recall',
  mandat_acordat: 'Mandat acordat',
  mandat_retras: 'Mandat retras (recall)',
};

export function emptyState() {
  return {
    participants: {},
    proposals: {},
    delegations: {},
    votes: {},
    mandates: Object.fromEntries(TOPICS.map((t) => [t.id, {}])),
    params: { thresholdPct: 20, bufferPct: 10 },
  };
}

function need(cond, message) {
  if (!cond) throw new Error(message);
}

/** Pure reducer. Throws on events that break the rules, so invalid actions never reach the ledger. */
export function applyEvent(state, { type, payload }) {
  const s = state;
  switch (type) {
    case 'participant_adaugat': {
      need(payload.id && payload.name, 'Participant fără nume.');
      need(!s.participants[payload.id], 'Participantul există deja.');
      return { ...s, participants: { ...s.participants, [payload.id]: { id: payload.id, name: payload.name } } };
    }
    case 'propunere_adaugata': {
      need(payload.id && payload.title, 'Propunere fără titlu.');
      need(TOPICS.some((t) => t.id === payload.topic), 'Domeniu necunoscut.');
      need(!s.proposals[payload.id], 'Propunerea există deja.');
      return { ...s, proposals: { ...s.proposals, [payload.id]: { ...payload } } };
    }
    case 'delegare_setata': {
      const { from, to, scope } = payload;
      need(s.participants[from] && s.participants[to], 'Participant necunoscut.');
      need(from !== to, 'Nu îți poți delega votul ție însuți.');
      if (scope.kind === 'punctual') need(s.proposals[scope.proposalId], 'Propunere necunoscută.');
      if (scope.kind === 'sector') need(TOPICS.some((t) => t.id === scope.topic), 'Domeniu necunoscut.');
      return { ...s, delegations: { ...s.delegations, [delegationKey(from, scope)]: { from, to, scope } } };
    }
    case 'delegare_retrasa': {
      const key = delegationKey(payload.from, payload.scope);
      need(s.delegations[key], 'Nu există această delegare.');
      const { [key]: _removed, ...rest } = s.delegations;
      return { ...s, delegations: rest };
    }
    case 'vot_exprimat': {
      const { proposalId, voter, choice } = payload;
      need(s.proposals[proposalId] && s.participants[voter], 'Vot invalid.');
      need(['pentru', 'impotriva', 'abtinere'].includes(choice), 'Opțiune de vot invalidă.');
      return { ...s, votes: { ...s.votes, [`${proposalId}|${voter}`]: { proposalId, voter, choice } } };
    }
    case 'vot_retras': {
      const key = `${payload.proposalId}|${payload.voter}`;
      need(s.votes[key], 'Nu există un vot de retras.');
      const { [key]: _removed, ...rest } = s.votes;
      return { ...s, votes: rest };
    }
    case 'parametri_recall': {
      const { thresholdPct, bufferPct } = payload;
      need(Number.isInteger(thresholdPct) && thresholdPct > 0 && thresholdPct <= 100, 'Prag invalid.');
      need(Number.isInteger(bufferPct) && bufferPct >= 0 && bufferPct <= thresholdPct, 'Zonă-tampon invalidă.');
      return { ...s, params: { thresholdPct, bufferPct } };
    }
    case 'mandat_acordat':
    case 'mandat_retras': {
      const { topic, participantId } = payload;
      const topicMandates = { ...s.mandates[topic] };
      if (type === 'mandat_acordat') topicMandates[participantId] = true;
      else delete topicMandates[participantId];
      return { ...s, mandates: { ...s.mandates, [topic]: topicMandates } };
    }
    default:
      throw new Error(`Eveniment necunoscut: ${type}`);
  }
}

export function replay(entries) {
  return entries.reduce((state, e) => applyEvent(state, e), emptyState());
}

/**
 * Records a participant's action, then lets the "civic contract" record any mandate changes
 * it causes. Returns the new ledger (the old one is untouched).
 */
export async function commit(entries, { type, author, payload, timestamp }) {
  let state = applyEvent(replay(entries), { type, payload }); // throws if invalid
  let out = [...entries, await makeEntry(entries, { type, author, payload, timestamp })];
  for (const t of mandateTransitions(state)) {
    state = applyEvent(state, t);
    out = [...out, await makeEntry(out, { type: t.type, author: SYSTEM_AUTHOR, payload: t.payload, timestamp })];
  }
  return out;
}

/**
 * Full independent audit:
 *  1. every hash and link in the chain is intact;
 *  2. replaying the events reproduces *exactly* the mandate changes recorded by the civic contract
 *     (nobody inserted, removed or altered a recall by hand).
 */
export async function audit(entries) {
  const chain = await verifyChain(entries);
  let consistency = { ok: true, at: null, reason: null };
  let i = 0;
  try {
    let state = emptyState();
    while (i < entries.length) {
      const e = entries[i];
      if (e.author === SYSTEM_AUTHOR) {
        consistency = { ok: false, at: i, reason: 'Decizie a contractului civic care nu rezultă din reguli.' };
        break;
      }
      state = applyEvent(state, e);
      i++;
      for (const exp of mandateTransitions(state)) {
        const got = entries[i];
        if (!got || got.author !== SYSTEM_AUTHOR || got.type !== exp.type || canonical(got.payload) !== canonical(exp.payload)) {
          consistency = { ok: false, at: i, reason: 'Lipsește o decizie de mandat pe care regulile o impun.' };
          throw new Error('stop');
        }
        state = applyEvent(state, got);
        i++;
      }
    }
  } catch (err) {
    if (consistency.ok) consistency = { ok: false, at: i, reason: `Eveniment invalid: ${err.message}` };
  }
  return { chain, consistency, ok: chain.ok && consistency.ok };
}
