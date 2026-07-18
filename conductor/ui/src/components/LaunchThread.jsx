import { useEffect, useMemo, useState } from 'react';
import { fetchRoles, fetchRepos, postLaunch, ApiError } from '../lib/api.js';

// Field names mirror the real conductor card contract (see demo-card.json /
// conductor.mjs manifest build): `maxBudgetUsd`, not a UI-invented `budget` —
// a wrong key here would silently drop the budget cap on dispatch.
function defaultCard() {
  return { feature: '', worktree: '', role: '', model: 'claude-sonnet-5', maxBudgetUsd: 2, instructions: '' };
}

/**
 * "+ nova run" opens this as a conversation, not a modal: fields build a card.json preview
 * live, editable as raw JSON, dispatched via POST /api/launch (fase B — may not exist yet;
 * failure surfaces as an honest inline message, not a silent no-op).
 */
export default function LaunchThread({ onDispatched }) {
  const [card, setCard] = useState(defaultCard());
  const [rawJson, setRawJson] = useState(() => JSON.stringify(defaultCard(), null, 2));
  const [jsonError, setJsonError] = useState(null);
  const [roles, setRoles] = useState(null);
  const [rolesError, setRolesError] = useState(null);
  const [repos, setRepos] = useState(null);
  const [dispatch, setDispatch] = useState({ status: 'idle' });

  useEffect(() => {
    const controller = new AbortController();
    fetchRoles(controller.signal)
      .then((r) => { setRoles(r); setRolesError(null); })
      .catch((e) => { if (e?.name !== 'AbortError') setRolesError(e); });
    fetchRepos(controller.signal).then(setRepos).catch(() => setRepos(null));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    setRawJson(JSON.stringify(card, null, 2));
  }, [card]);

  const updateField = (field, value) => {
    setCard((c) => ({ ...c, [field]: value }));
  };

  const handleRawChange = (text) => {
    setRawJson(text);
    try {
      const parsed = JSON.parse(text);
      setJsonError(null);
      setCard(parsed);
    } catch (e) {
      setJsonError(e.message);
    }
  };

  const canDispatch = !jsonError && typeof card.worktree === 'string' && card.worktree.trim().length > 0;

  const handleDispatch = async () => {
    if (!canDispatch) return;
    setDispatch({ status: 'pending' });
    try {
      const res = await postLaunch({ card });
      setDispatch({ status: 'ok', cardPath: res?.cardPath });
      onDispatched?.(res);
    } catch (e) {
      const message = e instanceof ApiError && e.status === 404
        ? 'POST /api/launch ainda não existe (fase B) — este dispatch não pode rodar ainda.'
        : e.message;
      setDispatch({ status: 'error', message });
    }
  };

  const roleOptions = useMemo(() => {
    if (Array.isArray(roles)) return roles.map((r) => r.name ?? r);
    if (roles && Array.isArray(roles.roles)) return roles.roles.map((r) => r.name ?? r);
    // roles.json real shape: a map keyed by role name ({ writer: {...}, reviewer: {...} })
    if (roles && typeof roles === 'object') return Object.keys(roles);
    return null;
  }, [roles]);

  return (
    <section className="run-thread" aria-label="lançar nova run">
      <header className="thread-header">
        <div className="thread-header__title">
          <h2>+ nova run</h2>
        </div>
      </header>
      <div className="thread-body">
        <div className="msg msg--agent">
          <span className="msg__tag mono">deck</span>
          <p>Descreva o run: repo/worktree, role, modelo, budget e instruções. Eu monto o card.json — você revisa e despacha.</p>
        </div>

        <div className="launch-form">
          <label className="launch-form__field">
            <span className="mono">feature</span>
            <input
              type="text"
              value={card.feature}
              onChange={(e) => updateField('feature', e.target.value)}
              placeholder="nome da feature/run"
            />
          </label>

          <label className="launch-form__field">
            <span className="mono">worktree</span>
            <input
              type="text"
              value={card.worktree}
              onChange={(e) => updateField('worktree', e.target.value)}
              placeholder="ex.: dazzling-williamson-f793a9"
              list={repos ? 'launch-repo-list' : undefined}
            />
            {repos && (
              <datalist id="launch-repo-list">
                {(Array.isArray(repos) ? repos : repos.repos ?? []).map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            )}
          </label>

          <label className="launch-form__field">
            <span className="mono">role</span>
            {roleOptions ? (
              <select value={card.role} onChange={(e) => updateField('role', e.target.value)}>
                <option value="">selecione…</option>
                {roleOptions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            ) : (
              <input type="text" value={card.role} onChange={(e) => updateField('role', e.target.value)} placeholder="writer, reviewer…" />
            )}
            {rolesError && <span className="ghost">/api/roles indisponível (fase B) — usando input livre.</span>}
          </label>

          <label className="launch-form__field">
            <span className="mono">modelo</span>
            <input type="text" value={card.model} onChange={(e) => updateField('model', e.target.value)} />
          </label>

          <label className="launch-form__field">
            <span className="mono">budget (USD)</span>
            <input type="number" min="0" step="0.1" value={card.maxBudgetUsd} onChange={(e) => updateField('maxBudgetUsd', Number(e.target.value))} />
          </label>

          <label className="launch-form__field launch-form__field--wide">
            <span className="mono">instructions</span>
            <textarea rows={4} value={card.instructions} onChange={(e) => updateField('instructions', e.target.value)} />
          </label>
        </div>

        <div className="msg msg--agent">
          <span className="msg__tag mono">deck</span>
          <p>Card montado — edite o JSON cru se precisar:</p>
          <textarea
            className="launch-json mono"
            rows={8}
            value={rawJson}
            onChange={(e) => handleRawChange(e.target.value)}
            aria-invalid={!!jsonError}
          />
          {jsonError && <p className="thread-body__error">JSON inválido: {jsonError}</p>}
        </div>

        {dispatch.status === 'ok' && (
          <div className="msg msg--agent deck-anim-in">
            <span className="msg__tag mono">deck</span>
            <p>Despachado. {dispatch.cardPath ? `card em ${dispatch.cardPath}` : ''}</p>
          </div>
        )}
        {dispatch.status === 'error' && (
          <div className="msg msg--agent deck-anim-in">
            <span className="msg__tag mono">deck</span>
            <p className="thread-body__error">{dispatch.message}</p>
          </div>
        )}
      </div>
      <div className="composer">
        <span className="composer__hint ghost">ajustar acima ou confirmar…</span>
        <div className="composer__actions">
          <button type="button" className="composer__send composer__send--launch" disabled={!canDispatch || dispatch.status === 'pending'} onClick={handleDispatch}>
            {dispatch.status === 'pending' ? 'despachando…' : 'DESPACHAR ▸'}
          </button>
        </div>
      </div>
    </section>
  );
}
