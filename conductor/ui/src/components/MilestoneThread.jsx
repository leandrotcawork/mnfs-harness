import TallyDot from './TallyDot.jsx';
import Composer from './Composer.jsx';
import { tallyForState } from '../lib/model.js';

/**
 * Milestone thread — only reachable when GET /api/mission (fase B) returns data; the tree
 * never shows a milestone node otherwise (DESIGN-DECK §3.3: "sem dados não aparecem — nada
 * de placeholder morto"). ASSUMPTION: mission.json shape is not specified anywhere in the
 * repo, so this renders defensively off a guessed { id, name, state, features: [...] } shape
 * and shows raw JSON as a fallback if the shape doesn't match.
 */
export default function MilestoneThread({ milestone }) {
  const features = Array.isArray(milestone.features) ? milestone.features : [];
  return (
    <section className="run-thread" aria-label={`conversa com ${milestone.name || milestone.id}`}>
      <header className="thread-header">
        <div className="thread-header__title">
          <TallyDot tally={tallyForState(milestone.state)} size={10} />
          <h2>{milestone.name || milestone.id}</h2>
          <span className="mono thread-header__state">{milestone.state ?? 'sem estado'}</span>
        </div>
      </header>
      <div className="thread-body">
        {features.length === 0 && (
          <p className="ghost">Sem features estruturadas neste milestone (mission.json não trouxe a lista esperada).</p>
        )}
        {features.map((f) => (
          <div key={f.id} className="hub-card">
            <TallyDot tally={tallyForState(f.state)} />
            <div className="hub-card__body">
              <div className="hub-card__title mono">{f.name || f.id}</div>
              <div className="hub-card__desc">{f.state ?? 'sem estado'}</div>
            </div>
          </div>
        ))}
      </div>
      <Composer mode="disabled" disabledLabel="Conversar com milestones chega na fase C" />
    </section>
  );
}
