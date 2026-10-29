import { topicLabel } from '../engine/topics.js';
import { VOTE_CHOICES } from '../engine/delegation.js';

export const shortHash = (h) => (h ? `${h.slice(0, 8)}…${h.slice(-4)}` : '');

export const choiceLabel = (id) => VOTE_CHOICES.find((c) => c.id === id)?.label ?? id;

export function nameOf(state, id) {
  if (id === 'contract-civic') return 'Contract civic';
  if (id === 'sistem') return 'Sistem';
  return state.participants[id]?.name ?? id;
}

/** Romanian genitive for first names: Ana -> Anei, Mihai -> lui Mihai. */
export function genitive(name) {
  return name.endsWith('a') ? `${name.slice(0, -1)}ei` : `lui ${name}`;
}

export function scopeLabel(state, scope) {
  if (scope.kind === 'total') return 'pe toate temele';
  if (scope.kind === 'sector') return `pe ${topicLabel(scope.topic).toLowerCase()}`;
  const title = state.proposals[scope.proposalId]?.title ?? scope.proposalId;
  return `doar pe „${title}”`;
}

export function describeEntry(state, e) {
  const p = e.payload;
  const n = (id) => nameOf(state, id);
  switch (e.type) {
    case 'participant_adaugat':
      return `${p.name} intră în comunitate`;
    case 'propunere_adaugata':
      return `„${p.title}” (${topicLabel(p.topic)})`;
    case 'delegare_setata':
      return `${n(p.from)} deleagă către ${n(p.to)} ${scopeLabel(state, p.scope)}`;
    case 'delegare_retrasa':
      return `${n(p.from)} își retrage delegarea ${scopeLabel(state, p.scope)}`;
    case 'vot_exprimat':
      return `${n(p.voter)}: ${choiceLabel(p.choice)} la „${state.proposals[p.proposalId]?.title ?? p.proposalId}”`;
    case 'vot_retras':
      return `${n(p.voter)} își retrage votul direct la „${state.proposals[p.proposalId]?.title ?? p.proposalId}”`;
    case 'parametri_recall':
      return `Prag ${p.thresholdPct}%, zonă-tampon ${p.bufferPct}%`;
    case 'mandat_acordat':
      return `${n(p.participantId)} primește mandat pe ${topicLabel(p.topic).toLowerCase()} (${p.support}/${p.total} delegări)`;
    case 'mandat_retras':
      return `${n(p.participantId)} pierde mandatul pe ${topicLabel(p.topic).toLowerCase()} (${p.support}/${p.total} delegări)`;
    default:
      return e.type;
  }
}
