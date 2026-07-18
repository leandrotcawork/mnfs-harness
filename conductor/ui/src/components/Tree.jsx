import { useRef } from 'react';
import TallyDot from './TallyDot.jsx';

function buildNodes({ missionName, runs, milestones }) {
  const nodes = [{ kind: 'hub', id: 'hub', label: `HUB${missionName ? ` · ${missionName}` : ''}`, depth: 0, tally: 'green' }];
  if (missionName) nodes.push({ kind: 'mission', id: 'mission', label: `Missão ${missionName}`, depth: 0, tally: 'green' });
  if (milestones && milestones.length) {
    for (const m of milestones) {
      nodes.push({ kind: 'milestone', id: m.id, label: m.name || m.id, depth: 1, tally: 'amber' });
      for (const r of runs.filter((r) => m.featureIds?.includes(r.feature))) {
        nodes.push({ kind: 'run', id: r.runId, label: r.feature, depth: 2, tally: r.tally, meta: r.role });
      }
    }
  } else {
    for (const r of runs) {
      nodes.push({ kind: 'run', id: r.runId, label: r.feature, depth: 1, tally: r.tally, meta: r.role });
    }
  }
  return nodes;
}

export default function Tree({ missionName, runs, milestones, selected, onSelect, onNewRun }) {
  const nodes = buildNodes({ missionName, runs, milestones });
  const refs = useRef([]);

  const handleKeyDown = (e, index) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = refs.current[Math.min(index + 1, nodes.length - 1)];
      next?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = refs.current[Math.max(index - 1, 0)];
      prev?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(nodes[index]);
    }
  };

  const isSelected = (node) => {
    if (node.kind === 'hub') return selected.type === 'hub';
    if (node.kind === 'run') return selected.type === 'run' && selected.id === node.id;
    if (node.kind === 'milestone') return selected.type === 'milestone' && selected.id === node.id;
    return false;
  };

  return (
    <nav className="tree" aria-label="árvore de conversas da missão">
      <ul className="tree__list" role="listbox" aria-label="conversas">
        {nodes.map((node, i) => (
          <li key={`${node.kind}-${node.id}`} role="presentation">
            <button
              ref={(el) => (refs.current[i] = el)}
              type="button"
              role="option"
              aria-selected={isSelected(node)}
              tabIndex={isSelected(node) || (i === 0 && selected.type !== 'run' && selected.type !== 'milestone') ? 0 : -1}
              className={`tree__item tree__item--lv${node.depth}${isSelected(node) ? ' tree__item--active' : ''}`}
              onClick={() => onSelect(node)}
              onKeyDown={(e) => handleKeyDown(e, i)}
            >
              <TallyDot tally={node.tally} />
              <span className="tree__label">{node.label}</span>
              {node.meta && <span className="tree__meta mono ghost">{node.meta}</span>}
              {node.kind === 'run' && <span className="tree__meta ghost">RUN</span>}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="tree__new" onClick={onNewRun}>
        + nova run
      </button>
    </nav>
  );
}
