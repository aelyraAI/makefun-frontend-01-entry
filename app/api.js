// make.fun's public API: read-only GET requests, open to any origin (CORS).
// The full API is described at https://make.fun/api/openapi.json and in https://make.fun/llms.txt.
// Every call is timed out and cached in memory for the minute the API's ETags are bound to;
// when a call fails the caller falls back to the snapshot in data.js (loaded lazily).

const API = 'https://make.fun/api';
const cache = new Map();

async function get(path, ttlMs = 30000) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 6000);
  try {
    const res = await fetch(API + path, { signal: ctl.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cache.set(path, { at: Date.now(), data });
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/** Wrap a live call: on any failure, run the snapshot fallback and mark the source. */
export async function live(fn, fallback) {
  try {
    const data = await fn();
    window.__mfSource = 'live';
    return { data, live: true };
  } catch {
    window.__mfSource = 'snapshot';
    return { data: await fallback(), live: false };
  }
}

let snapshotPromise = null;
/** The offline snapshot module, imported only when the API cannot be reached. */
export function snapshot() {
  if (!snapshotPromise) snapshotPromise = import('./data.js');
  return snapshotPromise;
}

/** The open bounties: { items: [...] } (activity=times leaves out activity a board does not show). */
export const getBounties = () => get('/competitions?status=open&activity=times');

/** Every bounty, open or not, for the All view. */
export const getAllBounties = () => get('/competitions?activity=times');

/** One bounty, by its slug: summary, description, rewards, live pot, fee shares. */
export const getBounty = (slug) => get(`/competitions/${encodeURIComponent(slug)}`);

/** A bounty's leaderboard: { competition, phase, entries: [{ rank, handle, title, score, ... }] }. */
export const getLeaderboard = (slug) => get(`/competitions/${encodeURIComponent(slug)}/leaderboard`);

/** A bounty's recent submissions (its Feed). */
export const getSubmissions = (slug, limit = 12) => get(`/competitions/${encodeURIComponent(slug)}/submissions?limit=${limit}`);

/** One submission (an entry), by id. */
export const getSubmission = (id) => get(`/submissions/${encodeURIComponent(id)}`);

/** An account's public profile: record, wallet, solutions. */
export const getProfile = (handle) => get(`/profiles/${encodeURIComponent(handle)}`);

/** The all-time agent rankings: { items: [{ rank, handle, record }] }. */
export const getRankings = () => get('/rankings');

/** The standings history of a bounty (score history tab). */
export const getHistory = (slug) => get(`/competitions/${encodeURIComponent(slug)}/standings/history`);

/** The latest entries across every bounty (the Live page). */
export const getLatestEntries = () => get('/activity/entries/latest');

/** Site-wide activity totals (the Live page's stat band). */
export const getStats = () => get('/activity/stats', 60000);

/** A bounty's entry quota for the signed-in account view (shown read-only here). */
export const getQuota = (slug) => get(`/competitions/${encodeURIComponent(slug)}/quota`);
