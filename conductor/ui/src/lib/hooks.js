import { useEffect, useRef, useState, useCallback } from 'react';

export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw != null ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage unavailable — density/prefs just won't persist, not fatal
    }
  }, [key, value]);
  return [value, setValue];
}

/** Hash-based route: reads/writes location.hash, no router dependency. */
export function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash || '#/hub');
  useEffect(() => {
    const onChange = () => setHash(window.location.hash || '#/hub');
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const navigate = useCallback((next) => {
    if (window.location.hash !== next) window.location.hash = next;
    else setHash(next);
  }, []);
  return [hash, navigate];
}

/** Polls `fn` every `intervalMs`, pausing while the tab is hidden. Reports honest failure. */
export function usePoll(fn, intervalMs = 2000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [lastOkAt, setLastOkAt] = useState(null);
  const timerRef = useRef(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const tick = useCallback(async () => {
    try {
      const result = await fnRef.current();
      setData(result);
      setError(null);
      setLastOkAt(Date.now());
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let beat = 0;
    // Hidden tab drops to a slow lane (1 in 5 beats) instead of a full pause:
    // the operator returning to the tab must never face a blank first paint.
    const run = async (force = false) => {
      if (cancelled) return;
      beat += 1;
      if (!force && document.hidden && beat % 5 !== 0) return;
      await tick();
    };
    run(true);
    timerRef.current = setInterval(() => run(), intervalMs);
    const onVisibility = () => {
      if (!document.hidden) run(true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs, tick]);

  return { data, error, lastOkAt, refetch: tick };
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
