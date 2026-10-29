import { delegationForTopic, topicSupport } from '../engine/delegation.js';
import { mandateZone } from '../engine/recall.js';
import { topicLabel } from '../engine/topics.js';

const W = 560;
const H = 440;
const R = 168;

/** Is the edge from -> to part of a delegation loop? */
function inLoop(state, topic, from) {
  const seen = new Set([from]);
  let cur = from;
  for (;;) {
    const d = delegationForTopic(state, cur, topic);
    if (!d) return false;
    if (d.to === from) return true;
    if (seen.has(d.to)) return false;
    seen.add(d.to);
    cur = d.to;
  }
}

export default function TrustGraph({ state, topic, actor }) {
  const ids = Object.keys(state.participants);
  const total = ids.length;
  const { support } = topicSupport(state, topic);
  const pos = Object.fromEntries(
    ids.map((id, i) => {
      const a = (i / total) * Math.PI * 2 - Math.PI / 2;
      return [id, { x: W / 2 + R * Math.cos(a), y: H / 2 + R * Math.sin(a), a }];
    }),
  );
  const radius = (id) => 15 + support[id] * 4;

  const edges = ids
    .map((from) => {
      const d = delegationForTopic(state, from, topic);
      if (!d) return null;
      const p = pos[from];
      const q = pos[d.to];
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const len = Math.hypot(dx, dy);
      const ux = dx / len;
      const uy = dy / len;
      return {
        from,
        to: d.to,
        kind: d.scope.kind,
        loop: inLoop(state, topic, from),
        x1: p.x + ux * (radius(from) + 2),
        y1: p.y + uy * (radius(from) + 2),
        x2: q.x - ux * (radius(d.to) + 8),
        y2: q.y - uy * (radius(d.to) + 8),
      };
    })
    .filter(Boolean);

  const holders = ids.filter((id) => state.mandates[topic]?.[id]);

  return (
    <figure className="graph">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Delegările pe ${topicLabel(topic)}`}>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="arrowhead" />
          </marker>
          <marker id="arrow-loop" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="arrowhead loop" />
          </marker>
        </defs>

        {edges.map((e) => {
          // gentle curve so A->B and B->A don't overlap
          const mx = (e.x1 + e.x2) / 2 + (e.y2 - e.y1) * 0.12;
          const my = (e.y1 + e.y2) / 2 - (e.x2 - e.x1) * 0.12;
          return (
            <path
              key={e.from}
              d={`M${e.x1},${e.y1} Q${mx},${my} ${e.x2},${e.y2}`}
              className={`edge ${e.kind} ${e.loop ? 'loop' : ''}`}
              markerEnd={e.loop ? 'url(#arrow-loop)' : 'url(#arrow)'}
            />
          );
        })}

        {ids.map((id) => {
          const { x, y, a } = pos[id];
          const r = radius(id);
          const has = Boolean(state.mandates[topic]?.[id]);
          const zone = has ? mandateZone(support[id], total, state.params) : null;
          const lx = W / 2 + (R + r + 18) * Math.cos(a);
          const ly = H / 2 + (R + r + 18) * Math.sin(a);
          const anchor = Math.abs(Math.cos(a)) < 0.3 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
          return (
            <g key={id} className={`node ${id === actor ? 'me' : ''} ${has ? 'holder' : ''} ${zone === 'zona-tampon' ? 'buffer' : ''}`}>
              {has && <circle cx={x} cy={y} r={r + 6} className="stamp-ring" />}
              <circle cx={x} cy={y} r={r} className="dot" />
              <text x={x} y={y} className="count" dominantBaseline="central" textAnchor="middle">
                {support[id] || ''}
              </text>
              <text x={lx} y={ly} className="name" dominantBaseline="central" textAnchor={anchor}>
                {state.participants[id].name}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="legend">
        <span><i className="sw sw-total" /> încredere pe toate temele</span>
        <span><i className="sw sw-sector" /> încredere doar pe {topicLabel(topic).toLowerCase()}</span>
        <span><i className="sw sw-loop" /> buclă (votul se pierde)</span>
        <span><i className="sw sw-ring" /> are mandat</span>
        <span className="legend-note">
          Săgeata merge de la cine are încredere spre cel în care are încredere. Cifra din cerc arată câți oameni își lasă votul, direct sau prin alții, la acea persoană. Cercul plin ești tu.
          {holders.length === 0 ? ' Nimeni nu are încă mandat pe această temă.' : ''}
        </span>
      </figcaption>
    </figure>
  );
}
