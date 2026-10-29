// Native recall ("recall nativ"), as described in section 5.2 of the ANTEU white paper:
// a mandate exists only while enough delegated trust stands behind it.
//
// To avoid volatility, the rule uses hysteresis (the white paper's "zonă-tampon"):
//   - a mandate is GRANTED when support >= threshold
//   - a mandate is LOST only when support < threshold - buffer
// Between those two values, nothing changes: small fluctuations don't flip mandates.

import { topicSupport } from './delegation.js';
import { TOPICS } from './topics.js';

/** Integer arithmetic only, so 20% of 10 people is exactly 2, never 1.9999. */
export function meetsThreshold(support, total, pct) {
  return support * 100 >= pct * total;
}

export function mandateTransitions(state) {
  const total = Object.keys(state.participants).length;
  if (total === 0) return [];
  const { thresholdPct, bufferPct } = state.params;
  const lossPct = Math.max(0, thresholdPct - bufferPct);
  const out = [];

  for (const topic of TOPICS) {
    const { support } = topicSupport(state, topic.id);
    for (const pid of Object.keys(state.participants)) {
      const s = support[pid];
      const has = Boolean(state.mandates[topic.id]?.[pid]);
      const payload = { topic: topic.id, participantId: pid, support: s, total };
      if (!has && s > 0 && meetsThreshold(s, total, thresholdPct)) {
        out.push({ type: 'mandat_acordat', payload });
      } else if (has && !meetsThreshold(s, total, lossPct)) {
        out.push({ type: 'mandat_retras', payload });
      } else if (has && s === 0) {
        // a mandate with zero trust behind it never survives, whatever the buffer
        out.push({ type: 'mandat_retras', payload });
      }
    }
  }
  return out;
}

/** Where a holder currently sits relative to the two limits (for the UI). */
export function mandateZone(support, total, params) {
  const lossPct = Math.max(0, params.thresholdPct - params.bufferPct);
  if (meetsThreshold(support, total, params.thresholdPct)) return 'peste-prag';
  if (meetsThreshold(support, total, lossPct) && support > 0) return 'zona-tampon';
  return 'sub-prag';
}
