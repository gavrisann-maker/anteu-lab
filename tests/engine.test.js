import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildSeed } from '../src/engine/seed.js';
import { replay, commit, audit } from '../src/engine/state.js';
import { tallyProposal, resolveForProposal, topicSupport } from '../src/engine/delegation.js';
import { rehashAll, findReceipt, verifyChain } from '../src/engine/ledger.js';

const seed = await buildSeed();
const act = (entries, type, author, payload) => commit(entries, { type, author, payload });

test('o delegare tranzitivă duce votul la capătul lanțului', () => {
  const s = replay(seed.entries);
  const r = resolveForProposal(s, s.proposals.p1, 'dan');
  assert.equal(r.status, 'direct');
  assert.deepEqual(r.path, ['dan', 'bogdan', 'ana']);
  assert.equal(r.choice, 'pentru');
});

test('delegarea punctuală are prioritate față de cea sectorială și totală', async () => {
  // Bogdan delegates everything to Ana, but on p1 specifically to Elena
  const entries = await act(seed.entries, 'delegare_setata', 'bogdan', {
    from: 'bogdan', to: 'elena', scope: { kind: 'punctual', proposalId: 'p1' },
  });
  const s = replay(entries);
  const r = resolveForProposal(s, s.proposals.p1, 'bogdan');
  assert.deepEqual(r.path, ['bogdan', 'elena']);
  assert.equal(r.choice, 'impotriva');
});

test('votul direct anulează delegarea proprie', () => {
  const s = replay(seed.entries);
  const r = resolveForProposal(s, s.proposals.p3, 'gabriela');
  assert.deepEqual(r.path, ['gabriela']);
  assert.equal(r.choice, 'pentru');
});

test('ciclurile de delegare sunt detectate, iar voturile nu se pierd în buclă infinită', () => {
  const s = replay(seed.entries);
  const t = tallyProposal(s, 'p2');
  // Horia -> Ioana (total), Ioana -> Horia (sănătate): on a health proposal both votes loop
  assert.ok(t.lost.ciclu.includes('horia'));
  assert.ok(t.lost.ciclu.includes('ioana'));
  // on an education proposal the loop does not exist (Ioana's health delegation does not apply)
  assert.equal(tallyProposal(s, 'p1').chains.horia.status, 'direct');
});

test('rezultatul ponderat numără fiecare participant exact o dată', () => {
  const s = replay(seed.entries);
  const t = tallyProposal(s, 'p1');
  const lost = t.lost.ciclu.length + t.lost.neexprimat.length + t.lost.delegareBlocata.length;
  assert.equal(t.counted + lost, t.total);
  // Ana carries her own vote + Bogdan + Cristina + Dan
  assert.equal(t.weights.ana, 4);
});

test('sprijinul pe domeniu include delegările tranzitive', () => {
  const s = replay(seed.entries);
  const { support } = topicSupport(s, 'educatie');
  assert.equal(support.ana, 3); // Bogdan (total), Cristina, Dan via Bogdan
  assert.equal(support.bogdan, 1);
});

test('mandatele se acordă automat la atingerea pragului', () => {
  const s = replay(seed.entries);
  assert.equal(s.mandates.educatie.ana, true); // 3/10 = 30% >= 20%
  assert.equal(s.mandates.mediu.florin, true); // 2/10 = 20% >= 20%
});

test('zona-tampon: o scădere mică nu retrage mandatul', async () => {
  // Gabriela withdraws: Florin drops from 20% to 10%, still inside the buffer (loss below 10%)
  const entries = await act(seed.entries, 'delegare_retrasa', 'gabriela', {
    from: 'gabriela', scope: { kind: 'sector', topic: 'mediu' },
  });
  assert.equal(replay(entries).mandates.mediu.florin, true);
});

test('recall nativ: sub zona-tampon, mandatul se stinge automat', async () => {
  const entries = await act(seed.entries, 'delegare_retrasa', 'elena', {
    from: 'elena', scope: { kind: 'sector', topic: 'mediu' },
  });
  const s = replay(entries);
  assert.equal(s.mandates.mediu.florin, undefined);
  const last = entries[entries.length - 1];
  assert.equal(last.type, 'mandat_retras');
  assert.equal(last.author, 'contract-civic');
});

test('după retragerea votului direct, delegarea se aplică din nou', async () => {
  const entries = await act(seed.entries, 'vot_retras', 'gabriela', { proposalId: 'p3', voter: 'gabriela' });
  const s = replay(entries);
  const r = resolveForProposal(s, s.proposals.p3, 'gabriela');
  assert.deepEqual(r.path, ['gabriela', 'elena', 'florin']);
  assert.equal(r.choice, 'impotriva');
});

test('acțiunile invalide nu ajung în registru', async () => {
  await assert.rejects(() => act(seed.entries, 'delegare_setata', 'ana', {
    from: 'ana', to: 'ana', scope: { kind: 'total' },
  }));
});

test('auditul trece pe un registru corect', async () => {
  const r = await audit(seed.entries);
  assert.equal(r.ok, true);
});

test('o modificare naivă a unui vot este detectată de lanțul de hash-uri', async () => {
  const tampered = seed.entries.map((e) => ({ ...e, payload: { ...e.payload } }));
  const i = tampered.findIndex((e) => e.type === 'vot_exprimat');
  tampered[i].payload.choice = 'impotriva';
  const r = await verifyChain(tampered);
  assert.equal(r.ok, false);
  assert.equal(r.brokenAt, i);
});

test('rescrierea întregii istorii trece de lanț, dar nu și de chitanțele votanților', async () => {
  const tampered = seed.entries.map((e) => ({ ...e, payload: { ...e.payload } }));
  const i = tampered.findIndex((e) => e.type === 'vot_exprimat' && e.payload.voter === 'ana');
  tampered[i].payload.choice = 'impotriva';
  const forged = await rehashAll(tampered);
  assert.equal((await verifyChain(forged)).ok, true); // internally consistent...
  const anaReceipt = seed.receipts.ana[0].hash;
  assert.equal(findReceipt(forged, anaReceipt), null); // ...but Ana's receipt no longer matches
});

test('auditul detectează un recall eliminat din registru', async () => {
  const entries = await act(seed.entries, 'delegare_retrasa', 'elena', {
    from: 'elena', scope: { kind: 'sector', topic: 'mediu' },
  });
  const forged = await rehashAll(entries.slice(0, -1)); // drop the recall, keep the chain valid
  const r = await audit(forged);
  assert.equal(r.chain.ok, true);
  assert.equal(r.consistency.ok, false);
});
