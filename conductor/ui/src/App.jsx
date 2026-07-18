import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TruthStrip from './components/TruthStrip.jsx';
import Tree from './components/Tree.jsx';
import RunThread from './components/RunThread.jsx';
import HubThread from './components/HubThread.jsx';
import MilestoneThread from './components/MilestoneThread.jsx';
import LaunchThread from './components/LaunchThread.jsx';
import Overview from './components/Overview.jsx';
import CtxPanel from './components/CtxPanel.jsx';
import OfflineBanner from './components/OfflineBanner.jsx';
import { fetchState, fetchMission, postAnswer, postResume, ApiError } from './lib/api.js';
import { buildModel, formatMet } from './lib/model.js';
import { useHashRoute, useLocalStorage, useNow, usePoll } from './lib/hooks.js';
import './App.css';

function parseRoute(hash) {
  const clean = (hash || '#/hub').replace(/^#/, '');
  const parts = clean.split('/').filter(Boolean);
  if (parts[0] === 'overview') return { type: 'overview' };
  if (parts[0] === 'launch') return { type: 'launch' };
  if (parts[0] === 'run' && parts[1]) return { type: 'run', id: parts[1] };
  if (parts[0] === 'milestone' && parts[1]) return { type: 'milestone', id: parts[1] };
  return { type: 'hub' };
}

const isTypingTarget = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

export default function App() {
  const { data: raw, error: pollError, lastOkAt } = usePoll(() => fetchState(), 2000);
  const model = useMemo(() => buildModel(raw), [raw]);

  const [mission, setMission] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    fetchMission(controller.signal).then(setMission).catch(() => setMission(null));
    return () => controller.abort();
  }, []);

  const [hash, navigate] = useHashRoute();
  const route = useMemo(() => parseRoute(hash), [hash]);
  const prevRouteRef = useRef('#/hub');

  const [density, setDensity] = useLocalStorage('deck.density', 'norm');
  // On narrow viewports the ctx panel is an overlay drawer — it must start closed
  // there or it covers the thread on first paint.
  const [ctxCollapsed, setCtxCollapsed] = useState(() => window.matchMedia('(max-width: 1100px)').matches);
  const [treeOpen, setTreeOpen] = useState(false);
  const [soloRunId, setSoloRunId] = useState(null);

  const [optimisticByQuestion, setOptimisticByQuestion] = useState({});
  const [resumeStateByRun, setResumeStateByRun] = useState({});

  const metStartRef = useRef(null);
  const now = useNow(1000);
  if (metStartRef.current === null && model.runs.length > 0) metStartRef.current = Date.now();
  const met = formatMet(metStartRef.current, now);

  // clear optimistic answers once the server confirms them (question no longer pending)
  useEffect(() => {
    setOptimisticByQuestion((prev) => {
      const stillPending = new Set(model.pendingQuestions.map((q) => q.questionId));
      let changed = false;
      const next = { ...prev };
      for (const qid of Object.keys(next)) {
        if (!stillPending.has(qid) && next[qid].status !== 'sending') {
          delete next[qid];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [model.pendingQuestions]);

  const handleAnswer = useCallback(async (runId, questionId, text) => {
    setOptimisticByQuestion((prev) => ({ ...prev, [questionId]: { text, status: 'sending' } }));
    try {
      await postAnswer({ questionId, text });
      setOptimisticByQuestion((prev) => ({ ...prev, [questionId]: { text, status: 'sent' } }));
      setResumeStateByRun((prev) => ({ ...prev, [runId]: { status: 'pending' } }));
      try {
        await postResume({ runId });
        setResumeStateByRun((prev) => ({ ...prev, [runId]: { status: 'ok' } }));
      } catch (e) {
        const message = e instanceof ApiError && e.status === 404
          ? 'POST /api/resume ainda não existe (fase B) — retome manualmente.'
          : e.message;
        setResumeStateByRun((prev) => ({ ...prev, [runId]: { status: 'error', message } }));
      }
    } catch (e) {
      setOptimisticByQuestion((prev) => ({ ...prev, [questionId]: { text, status: 'error', error: e.message } }));
    }
  }, []);

  const handleResume = useCallback(async (runId) => {
    setResumeStateByRun((prev) => ({ ...prev, [runId]: { status: 'pending' } }));
    try {
      await postResume({ runId });
      setResumeStateByRun((prev) => ({ ...prev, [runId]: { status: 'ok' } }));
    } catch (e) {
      const message = e instanceof ApiError && e.status === 404
        ? 'POST /api/resume ainda não existe (fase B).'
        : e.message;
      setResumeStateByRun((prev) => ({ ...prev, [runId]: { status: 'error', message } }));
    }
  }, []);

  const selectRun = useCallback((runId) => {
    navigate(`#/run/${runId}`);
    setTreeOpen(false);
  }, [navigate]);

  const jumpToFirstQuestion = useCallback(() => {
    const q = model.pendingQuestions[0];
    if (q) selectRun(q.runId);
  }, [model.pendingQuestions, selectRun]);

  const openOverview = useCallback(() => {
    prevRouteRef.current = window.location.hash || '#/hub';
    navigate('#/overview');
  }, [navigate]);

  const closeOverlay = useCallback(() => {
    if (soloRunId) {
      setSoloRunId(null);
      return;
    }
    if (route.type === 'overview') {
      navigate(prevRouteRef.current || '#/hub');
    }
  }, [soloRunId, route.type, navigate]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (isTypingTarget(document.activeElement)) return;
      if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        openOverview();
      } else if (e.key === 'Escape') {
        closeOverlay();
      } else if (e.key === ']') {
        setCtxCollapsed((v) => !v);
      } else if (e.key === '[') {
        setTreeOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openOverview, closeOverlay]);

  const selectedRun = route.type === 'run' ? model.runs.find((r) => r.runId === route.id) : null;
  const selectedMilestone = route.type === 'milestone' && mission?.milestones
    ? mission.milestones.find((m) => m.id === route.id)
    : null;

  const treeSelected = route.type === 'run'
    ? { type: 'run', id: route.id }
    : route.type === 'milestone'
      ? { type: 'milestone', id: route.id }
      : { type: 'hub' };

  const ctxType = route.type === 'run' ? 'run' : route.type === 'launch' ? 'launch' : route.type === 'milestone' ? 'milestone' : 'hub';

  const showOffline = !!pollError;

  if (route.type === 'overview') {
    return (
      <div className="deck-shell deck-shell--overview">
        <Overview runs={model.runs} onSelectRun={selectRun} onClose={closeOverlay} />
      </div>
    );
  }

  return (
    <div className="deck-shell">
      <p className="sr-only" aria-live="polite" role="status">
        {model.pendingQuestions.length > 0
          ? `${model.pendingQuestions.length} pergunta${model.pendingQuestions.length === 1 ? '' : 's'} pendente${model.pendingQuestions.length === 1 ? '' : 's'} do operador`
          : ''}
      </p>
      <TruthStrip
        missionName={mission?.name}
        met={met}
        pendingCount={model.pendingQuestions.length}
        tallyCounts={model.tallyCounts}
        onJumpToFirstQuestion={jumpToFirstQuestion}
        onOpenOverview={openOverview}
        onToggleTree={() => setTreeOpen((v) => !v)}
      />
      <div className="deck-shell__row">
        <div className={`deck-shell__tree${treeOpen ? ' deck-shell__tree--open' : ''}`}>
          <Tree
            missionName={mission?.name}
            runs={model.runs}
            milestones={mission?.milestones}
            selected={treeSelected}
            onSelect={(node) => {
              if (node.kind === 'hub') navigate('#/hub');
              else if (node.kind === 'run') selectRun(node.id);
              else if (node.kind === 'milestone') navigate(`#/milestone/${node.id}`);
              setTreeOpen(false);
            }}
            onNewRun={() => { navigate('#/launch'); setTreeOpen(false); }}
          />
        </div>
        {treeOpen && <button type="button" className="deck-shell__scrim" aria-label="fechar árvore" onClick={() => setTreeOpen(false)} />}

        <main className={`deck-shell__thread${soloRunId ? ' deck-shell__thread--solo' : ''}`}>
          <OfflineBanner visible={showOffline} />
          {route.type === 'hub' && (
            <HubThread
              missionName={mission?.name}
              runs={model.runs}
              pendingQuestions={model.pendingQuestions}
              onSelectRun={selectRun}
            />
          )}
          {route.type === 'run' && selectedRun && (
            <RunThread
              run={selectedRun}
              density={density}
              onDensityChange={setDensity}
              onAnswer={(questionId, text) => handleAnswer(selectedRun.runId, questionId, text)}
              optimisticByQuestion={optimisticByQuestion}
              resumeState={resumeStateByRun[selectedRun.runId]}
              isSolo={soloRunId === selectedRun.runId}
              onToggleSolo={() => setSoloRunId((v) => (v === selectedRun.runId ? null : selectedRun.runId))}
            />
          )}
          {route.type === 'run' && !selectedRun && (
            <div className="run-thread"><p className="ghost thread-body__empty">Run não encontrada (pode ter sido encerrada e removida do estado).</p></div>
          )}
          {route.type === 'milestone' && selectedMilestone && <MilestoneThread milestone={selectedMilestone} />}
          {route.type === 'milestone' && !selectedMilestone && (
            <div className="run-thread"><p className="ghost thread-body__empty">Milestone sem dados (mission.json indisponível).</p></div>
          )}
          {route.type === 'launch' && <LaunchThread onDispatched={() => {}} />}
        </main>

        <CtxPanel
          type={ctxType}
          run={selectedRun}
          runs={model.runs}
          pendingQuestions={model.pendingQuestions}
          onSelectRun={selectRun}
          onResume={handleResume}
          resumeState={selectedRun ? resumeStateByRun[selectedRun.runId] : null}
          collapsed={ctxCollapsed}
          onToggleCollapse={() => setCtxCollapsed((v) => !v)}
        />
      </div>
    </div>
  );
}
