// mnfs deck — API client
// Fase A (viewer.mjs, exists today): GET /api/state, POST /api/answer
// Fase B (contract per DESIGN-DECK.md §8, may 404 until built): POST /api/resume,
// POST /api/launch, GET /api/roles, GET /api/mission
// All POSTs require header x-conductor: 1 (localhost-origin guard on the server).

const JSON_HEADERS = { 'content-type': 'application/json', 'x-conductor': '1' };

class ApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function parseJsonSafe(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(path, options);
  } catch (error) {
    throw new ApiError(`network error: ${error.message}`, { status: 0 });
  }
  const body = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiError(body?.error || `request failed: ${res.status}`, { status: res.status, body });
  }
  return body;
}

export function fetchState(signal) {
  return request('/api/state', { signal });
}

export function postAnswer({ questionId, text }) {
  return request('/api/answer', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ questionId, text }),
  });
}

// --- fase B — endpoints may not exist yet; callers must handle rejection honestly ---

export function postResume({ runId }) {
  return request('/api/resume', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ runId }),
  });
}

export function postLaunch({ card }) {
  return request('/api/launch', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ card }),
  });
}

export function fetchRoles(signal) {
  return request('/api/roles', { signal });
}

export function fetchMission(signal) {
  return request('/api/mission', { signal });
}

export function fetchRepos(signal) {
  return request('/api/repos', { signal });
}

export { ApiError };
