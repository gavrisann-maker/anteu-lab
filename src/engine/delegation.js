// Liquid delegation: direct vote, or delegation that is punctual (one proposal),
// sectorial (one topic) or total. The most specific delegation wins:
//   punctual > sectorial > total
// A direct vote always overrides any delegation the voter has given.

export const VOTE_CHOICES = [
  { id: 'pentru', label: 'Pentru' },
  { id: 'impotriva', label: 'Împotrivă' },
  { id: 'abtinere', label: 'Abținere' },
];

export function scopeKey(scope) {
  if (scope.kind === 'total') return 'total';
  if (scope.kind === 'sector') return `sector:${scope.topic}`;
  if (scope.kind === 'punctual') return `punctual:${scope.proposalId}`;
  throw new Error(`Tip de delegare necunoscut: ${scope.kind}`);
}

export function delegationKey(from, scope) {
  return `${from}|${scopeKey(scope)}`;
}

function lookup(state, from, scope) {
  return state.delegations[delegationKey(from, scope)] ?? null;
}

/** Delegation that applies to `participantId` for a given proposal, or null. */
export function delegationForProposal(state, participantId, proposal) {
  return (
    lookup(state, participantId, { kind: 'punctual', proposalId: proposal.id }) ??
    lookup(state, participantId, { kind: 'sector', topic: proposal.topic }) ??
    lookup(state, participantId, { kind: 'total' })
  );
}

/** Delegation that applies to `participantId` for a whole topic (used for mandates/recall). */
export function delegationForTopic(state, participantId, topic) {
  return lookup(state, participantId, { kind: 'sector', topic }) ?? lookup(state, participantId, { kind: 'total' });
}

export function directVote(state, proposalId, participantId) {
  return state.votes[`${proposalId}|${participantId}`] ?? null;
}

/**
 * Follows a participant's chain for one proposal.
 * status: 'direct'      – chain ends at someone who voted (possibly themselves)
 *         'neexprimat'  – chain ends at someone who neither voted nor delegated
 *         'ciclu'       – chain loops back on itself; the vote cannot be attributed
 */
export function resolveForProposal(state, proposal, startId) {
  const path = [startId];
  const seen = new Set(path);
  let current = startId;
  for (;;) {
    const vote = directVote(state, proposal.id, current);
    if (vote) return { status: 'direct', path, end: current, choice: vote.choice };
    const d = delegationForProposal(state, current, proposal);
    if (!d) return { status: 'neexprimat', path, end: current, choice: null };
    if (seen.has(d.to)) return { status: 'ciclu', path: [...path, d.to], end: null, choice: null };
    path.push(d.to);
    seen.add(d.to);
    current = d.to;
  }
}

/** Weighted result for one proposal. */
export function tallyProposal(state, proposalId) {
  const proposal = state.proposals[proposalId];
  const totals = Object.fromEntries(VOTE_CHOICES.map((c) => [c.id, 0]));
  const weights = {}; // direct voter -> how many votes they carry (including their own)
  const chains = {};
  const lost = { ciclu: [], neexprimat: [], delegareBlocata: [] };

  for (const pid of Object.keys(state.participants)) {
    const r = resolveForProposal(state, proposal, pid);
    chains[pid] = r;
    if (r.status === 'direct') {
      totals[r.choice] += 1;
      weights[r.end] = (weights[r.end] ?? 0) + 1;
    } else if (r.status === 'ciclu') {
      lost.ciclu.push(pid);
    } else if (r.path.length > 1) {
      // delegated, but nobody at the end of the chain voted
      lost.delegareBlocata.push(pid);
    } else {
      lost.neexprimat.push(pid);
    }
  }

  const counted = Object.values(totals).reduce((a, b) => a + b, 0);
  return { proposal, totals, weights, chains, lost, counted, total: Object.keys(state.participants).length };
}

/**
 * Trust a participant holds in a topic: how many *other* participants' topic-delegation
 * chains pass through them (directly or transitively).
 */
export function topicSupport(state, topic) {
  const support = Object.fromEntries(Object.keys(state.participants).map((p) => [p, 0]));
  const cycles = new Set();
  for (const start of Object.keys(state.participants)) {
    const seen = new Set([start]);
    let current = start;
    for (;;) {
      const d = delegationForTopic(state, current, topic);
      if (!d) break;
      if (seen.has(d.to)) {
        cycles.add(start);
        break;
      }
      support[d.to] += 1;
      seen.add(d.to);
      current = d.to;
    }
  }
  return { support, cycles };
}
