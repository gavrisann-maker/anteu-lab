// Append-only ledger: every entry is chained to the previous one through a SHA-256 hash.
// This is a deliberately simplified stand-in for the "consens și audit" layer described
// in the ANTEU white paper (there: a permissioned blockchain + IPFS). The point it
// demonstrates is the same: history can be checked by anyone, and silent edits are visible.

export const GENESIS_HASH = '0'.repeat(64);

/** Stable JSON: object keys sorted recursively, so the same data always hashes the same. */
export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
}

export async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** The exact material that gets hashed for an entry. */
function hashMaterial({ index, timestamp, type, author, payload, prevHash }) {
  return canonical({ index, timestamp, type, author, payload, prevHash });
}

export async function hashEntry(entry) {
  return sha256Hex(hashMaterial(entry));
}

/** Builds the next entry on top of `entries` (does not mutate). */
export async function makeEntry(entries, { type, author, payload, timestamp }) {
  const prev = entries[entries.length - 1];
  const base = {
    index: entries.length,
    timestamp: timestamp ?? new Date().toISOString(),
    type,
    author,
    payload,
    prevHash: prev ? prev.hash : GENESIS_HASH,
  };
  return { ...base, hash: await hashEntry(base) };
}

/**
 * Recomputes every hash and link. Returns the first broken index, if any.
 * A naive edit (changing a payload without recomputing) is caught here.
 */
export async function verifyChain(entries) {
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const expectedPrev = i === 0 ? GENESIS_HASH : entries[i - 1].hash;
    if (e.index !== i) return { ok: false, brokenAt: i, reason: 'index' };
    if (e.prevHash !== expectedPrev) return { ok: false, brokenAt: i, reason: 'legatura' };
    if ((await hashEntry(e)) !== e.hash) return { ok: false, brokenAt: i, reason: 'continut' };
  }
  return { ok: true, brokenAt: null, reason: null };
}

/**
 * Re-hashes the whole chain after an edit: the "sophisticated forger" who rewrites history.
 * The chain then verifies internally, which is exactly why external anchors (receipts kept by
 * voters, copies held by independent university nodes) are needed.
 */
export async function rehashAll(entries) {
  const out = [];
  for (const e of entries) {
    const { hash: _old, ...rest } = e;
    const base = { ...rest, index: out.length, prevHash: out.length ? out[out.length - 1].hash : GENESIS_HASH };
    out.push({ ...base, hash: await hashEntry(base) });
  }
  return out;
}

/** A receipt is the hash a participant got back when their action was recorded. */
export function findReceipt(entries, receiptHash) {
  return entries.find((e) => e.hash === receiptHash) ?? null;
}
