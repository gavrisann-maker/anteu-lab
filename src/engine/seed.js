// Demo scenario: a small university community of 10 people, 4 topics, 3 proposals.
// It is built *through the ledger*, exactly like user actions, so it is fully auditable.

import { commit } from './state.js';

const PEOPLE = ['Ana', 'Bogdan', 'Cristina', 'Dan', 'Elena', 'Florin', 'Gabriela', 'Horia', 'Ioana', 'Mihai'];
const id = (name) => name.toLowerCase();

const PROPOSALS = [
  {
    id: 'p1',
    title: 'Buget participativ pentru reabilitarea bibliotecii',
    topic: 'educatie',
    description: 'Alocarea a 15% din bugetul de investiții al campusului pentru renovarea sălilor de lectură.',
  },
  {
    id: 'p2',
    title: 'Screening medical gratuit pentru studenți',
    topic: 'sanatate',
    description: 'Un program anual de controale preventive, organizat împreună cu policlinica universitară.',
  },
  {
    id: 'p3',
    title: 'Renunțarea la plasticul de unică folosință în campus',
    topic: 'mediu',
    description: 'Cantinele și automatele trec la ambalaje reutilizabile sau compostabile până la final de an.',
  },
];

const total = { kind: 'total' };
const sector = (topic) => ({ kind: 'sector', topic });
const punctual = (proposalId) => ({ kind: 'punctual', proposalId });

const DELEGATIONS = [
  ['bogdan', 'ana', total], // Bogdan trusts Ana on everything
  ['cristina', 'ana', sector('educatie')],
  ['dan', 'bogdan', sector('educatie')], // transitive: Dan -> Bogdan -> Ana
  ['elena', 'florin', sector('mediu')],
  ['gabriela', 'elena', sector('mediu')], // transitive: Gabriela -> Elena -> Florin
  ['horia', 'ioana', total],
  ['ioana', 'horia', sector('sanatate')], // cycle on health: Horia <-> Ioana
  ['mihai', 'cristina', punctual('p3')], // Mihai trusts Cristina only on the plastic proposal
];

const VOTES = [
  ['p1', 'ana', 'pentru'],
  ['p1', 'elena', 'impotriva'],
  ['p1', 'ioana', 'pentru'],
  ['p3', 'florin', 'impotriva'],
  ['p3', 'cristina', 'pentru'],
  ['p3', 'gabriela', 'pentru'], // Gabriela votes herself: her direct vote overrides her delegation
];

export async function buildSeed() {
  let entries = [];
  const receipts = {}; // participantId -> [{ proposalId, hash }]
  const user = 'sistem';

  for (const name of PEOPLE) {
    entries = await commit(entries, { type: 'participant_adaugat', author: user, payload: { id: id(name), name } });
  }
  for (const p of PROPOSALS) {
    entries = await commit(entries, { type: 'propunere_adaugata', author: user, payload: p });
  }
  for (const [from, to, scope] of DELEGATIONS) {
    entries = await commit(entries, { type: 'delegare_setata', author: from, payload: { from, to, scope } });
  }
  for (const [proposalId, voter, choice] of VOTES) {
    const at = entries.length;
    entries = await commit(entries, { type: 'vot_exprimat', author: voter, payload: { proposalId, voter, choice } });
    (receipts[voter] ??= []).push({ proposalId, hash: entries[at].hash });
  }
  return { entries, receipts };
}
