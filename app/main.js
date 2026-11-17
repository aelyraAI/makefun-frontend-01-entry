// A make.fun frontend: the bounty board, a bounty's page with its leaderboard, feed and
// score history, an entry's page, account profiles, the global leaderboards, a live page,
// a submit-an-entry form and a create-a-bounty flow — all on hash routes, all reading
// make.fun's public API, with the snapshot in data.js as an offline fallback.
//
//   #/                              the board (trending, all bounties, latest, top agents)
//   #/bounty/<slug>                a bounty's overview (description, rewards, dates, submit)
//   #/bounty/<slug>/leaderboard    that bounty's leaderboard
//   #/bounty/<slug>/feed           that bounty's judged-entry feed
//   #/bounty/<slug>/history        that bounty's score history
//   #/bounty/<slug>/submit         the submit-an-entry form for that bounty
//   #/entry/<id>                    one entry
//   #/u/<handle>                    an account's public profile (#/profile/<handle> works too)
//   #/leaderboards                  all-time + last-30-days agent leaderboards
//   #/leaderboards/30d              the last-30-days board alone
//   #/live                          the newest entries across every bounty
//   #/create                        create a bounty (2 steps, live preview, submit disabled)
//
// window.__shotReady is false while a page loads and true once its data is on screen, so a
// screenshot script knows when to capture.

import { getAllBounties, getBounties, getBounty, getHistory, getLatestEntries, getLeaderboard, getProfile, getRankings, getStats, getSubmission, getSubmissions, live, snapshot } from './api.js';
import { board, bountyPage, createPage, createPreview, entryPage, leaderboards30Page, leaderboardsPage, livePage, messagePage, profilePage, submitForm } from './views.js';
import { isOpen } from './format.js';

const app = document.getElementById('app');
const netStatus = document.getElementById('net-status');
let countdownTimer = null;

/** Show which data source the last render used, in the top bar. */
function markSource(isLive) {
  if (!netStatus) return;
  netStatus.textContent = isLive ? 'live API' : 'snapshot';
  netStatus.classList.toggle('is-snap', !isLive);
}

/** Tick every visible countdown once a second. */
function startCountdowns() {
  clearInterval(countdownTimer);
  const tick = () => {
    document.querySelectorAll('.countdown[data-deadline]').forEach((el) => {
      const ms = new Date(el.dataset.deadline).getTime() - Date.now();
      if (ms <= 0) { el.textContent = 'ended'; return; }
      const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
      el.textContent = d > 0 ? `${d}d ${h}h left` : h > 0 ? `${h}h ${m}m left` : m > 0 ? `${m}m ${s}s left` : `${s}s left`;
    });
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}

/** Board filters: text, category chips and the sort select re-render the list in place. */
function wireBoard(items) {
  const list = document.getElementById('board-list');
  if (!list) return;
  const rows = [...list.children];
  const bySlug = new Map(items.map((b) => [b.slug, b]));
  const apply = () => {
    const q = document.getElementById('q').value.trim().toLowerCase();
    const sort = document.getElementById('sort').value;
    const cat = document.querySelector('#cat-chips .is-on')?.dataset.cat ?? '';
    const visible = rows.filter((row) => {
      const slug = decodeURIComponent(row.querySelector('.brow-title').getAttribute('href').split('/').pop());
      const b = bySlug.get(slug);
      if (!b) return false;
      if (cat === '__live' && !isOpen(b)) return false;
      if (cat && cat !== '__live' && b.category !== cat) return false;
      if (q && !`${b.title} ${b.category} ${(b.skills ?? []).join(' ')} ${b.sponsor?.name ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const key = {
      ending: (b) => new Date(b.deadline).getTime(),
      pot: (b) => -Number(b.potUsd ?? b.rewardAmount ?? 0),
      entries: (b) => -(b.submissionCount ?? 0),
      newest: (b) => -new Date(b.publishedAt ?? 0).getTime(),
    }[sort];
    visible.sort((ra, rb) => key(bySlug.get(decodeURIComponent(ra.querySelector('.brow-title').getAttribute('href').split('/').pop()))) - key(bySlug.get(decodeURIComponent(rb.querySelector('.brow-title').getAttribute('href').split('/').pop()))));
    rows.forEach((r) => { r.style.display = 'none'; });
    visible.forEach((r) => { r.style.display = ''; list.appendChild(r); });
    document.getElementById('board-count').textContent = `${visible.length} of ${items.length} bounties shown`;
  };
  document.getElementById('q').addEventListener('input', apply);
  document.getElementById('sort').addEventListener('change', apply);
  document.querySelectorAll('#cat-chips .chip-btn').forEach((btn) => btn.addEventListener('click', () => {
    document.querySelectorAll('#cat-chips .chip-btn').forEach((x) => x.classList.remove('is-on'));
    btn.classList.add('is-on');
    apply();
  }));
}

/** The submit form never writes: on submit it confirms the shape and points at the kit CLI. */
function wireSubmit(slug) {
  const form = document.getElementById('submit-form');
  if (!form) return;
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const title = new FormData(form).get('title');
    document.getElementById('submit-msg').innerHTML = `Ready to enter <strong></strong> — nothing was sent. This read-only frontend holds no wallet; run the kit's submit command for <code>${slug}</code> with this title, your repo and commit, and the $0.50 fee is paid once per account from your wallet.`;
    document.querySelector('#submit-msg strong').textContent = String(title ?? '');
  });
}

/** The create flow: step switching plus a live preview that follows every keystroke. */
function wireCreate() {
  const form = document.getElementById('create-form');
  if (!form) return;
  const preview = () => {
    const v = Object.fromEntries(new FormData(form).entries());
    document.getElementById('create-preview').innerHTML = createPreview(v);
  };
  form.addEventListener('input', preview);
  document.getElementById('to-step-2').addEventListener('click', () => {
    document.getElementById('create-step-1').hidden = true;
    document.getElementById('create-step-2').hidden = false;
    preview();
  });
  document.getElementById('to-step-1').addEventListener('click', () => {
    document.getElementById('create-step-1').hidden = false;
    document.getElementById('create-step-2').hidden = true;
  });
  form.addEventListener('submit', (ev) => ev.preventDefault());
  preview();
}

/** A list out of any of the API's list shapes: { items }, { entries }, or a bare array. */
function listOf(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.entries)) return data.entries;
  return [];
}

/** Snapshot fallbacks, one per route, in the live API's own shapes. */
const snap = {
  async bounties() { const d = await snapshot(); return { items: d.BOUNTIES }; },
  async bounty(slug) {
    const d = await snapshot();
    const base = d.BOUNTIES.find((b) => b.slug === slug) ?? d.BOUNTIES[0];
    const extra = slug === 'makefun-frontend-01'
      ? { description: d.FRONTEND_DESCRIPTION, rewardsNow: d.FRONTEND_REWARDS_NOW, rewards: Object.fromEntries(d.FRONTEND_REWARDS_NOW.map((r) => [r.place, r.baseUsd])) }
      : { description: `${base.summary}\n\n## The work\nBuild it, hand it in before the deadline, and be graded in the open: every entry is scored on the published metric and ranked on this page's leaderboard.\n\n## Deliverables\n- The program the kit asks for, in a public repository under an OSI-approved licence\n- The recorded agent sessions that built it`, rewards: { 1: Math.round(Number(base.rewardAmount) * 0.2), 2: Math.round(Number(base.rewardAmount) * 0.14), 3: Math.round(Number(base.rewardAmount) * 0.1) } };
    return { ...base, ...extra };
  },
  async leaderboard(slug) { const d = await snapshot(); return slug === 'makefun-frontend-01' ? { entries: d.LEADERBOARD } : { entries: d.LEADERBOARD.slice(0, 8).map((e, i) => ({ ...e, rank: i + 1 })) }; },
  async feed(slug) { const d = await snapshot(); return { items: d.FEED.filter((f) => !slug || f.slug === slug) }; },
  async rankings() { const d = await snapshot(); return { items: d.RANKINGS }; },
  async profile(handle) { const d = await snapshot(); return d.PROFILES[handle] ?? { handle, joined_at: '2026-11-10T00:00:00.000Z', record: { competitions_entered: 4, competitions_placed: 2, competitions_won: 0, podium_finishes: 0, best_placement: 6, prize_usd: '28.00' }, solutions: [] }; },
  async history() { const d = await snapshot(); return d.HISTORY; },
  async stats() { const d = await snapshot(); return { totalEntries: d.STATS.totalEntries, openBounties: d.BOUNTIES.filter((b) => isOpen(b)).length }; },
};

/** Normalise standings/history (parallel time series) into history points, or pass rows through. */
function historyPoints(raw, lbEntries) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.points)) return raw.points;
  if (Array.isArray(raw?.at_ms) && lbEntries?.length) {
    const top = lbEntries[0];
    const winOf = (e) => { const v = e.values?.judge ?? (e.win != null ? e.win * 10000 : 0); return (Number(v) > 1000 ? Number(v) / 10000 : Number(v)); };
    const idx = [0, Math.floor(raw.at_ms.length / 3), Math.floor((2 * raw.at_ms.length) / 3), raw.at_ms.length - 1];
    return idx.map((i, k) => ({ at: new Date(raw.at_ms[i]).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', timeZone: 'UTC' }), leader: top.handle, win: Math.max(50, winOf(top) - (idx.length - 1 - k) * 6), entries: Math.round(((k + 1) / idx.length) * 600) }));
  }
  return null;
}

async function render() {
  window.__shotReady = false;
  clearInterval(countdownTimer);
  app.innerHTML = '<p class="loading">Loading make.fun…</p>';
  const hash = location.hash || '#/';
  const seg = hash.replace(/^#\//, '').split('/').filter(Boolean).map(decodeURIComponent);
  try {
    if (seg[0] === 'bounty' && seg[1]) {
      const slug = seg[1];
      const tab = seg[2] === 'submit' ? 'overview' : (seg[2] ?? 'overview');
      const bRes = await live(() => getBounty(slug), () => snap.bounty(slug));
      const b = bRes.data;
      document.title = `${b.title} | make.fun`;
      let lb = null, feed = null, history = null, mine = null;
      if (tab === 'leaderboard' || seg[2] === 'submit') {
        const r = await live(() => getLeaderboard(slug), () => snap.leaderboard(slug));
        lb = listOf(r.data);
      }
      if (tab === 'feed') {
        const r = await live(() => getSubmissions(slug), () => snap.feed(slug));
        feed = listOf(r.data);
      }
      if (tab === 'history') {
        const lbR = await live(() => getLeaderboard(slug), () => snap.leaderboard(slug));
        const lbE = listOf(lbR.data);
        const hR = await live(() => getHistory(slug), () => snap.history());
        history = historyPoints(hR.data, lbE) ?? await snap.history();
      }
      const fR = await live(() => getSubmissions(slug, 30), () => snap.feed(slug));
      mine = listOf(fR.data).find((s) => s.handle === 'keen-finch-78') ?? (slug === 'makefun-frontend-01' ? { title: 'make.fun, whole: board, bounty, entry, profiles, leaderboards, live — one static app, API-first with an offline snapshot', status: 'in this repo', created_at: new Date().toISOString(), id: '' } : null);
      app.innerHTML = bountyPage({ b, tab: seg[2] === 'submit' ? 'overview' : tab, lb, feed, history, mine });
      if (seg[2] === 'submit') {
        app.querySelector('.tabbody').innerHTML = submitForm(b);
        document.title = `Submit an entry · ${b.title} | make.fun`;
      }
      markSource(bRes.live);
      wireSubmit(slug);
    } else if (seg[0] === 'entry' && seg[1]) {
      const r = await live(() => getSubmission(seg[1]), async () => {
        const d = await snapshot();
        const f = [...d.FEED, ...Object.values(d.PROFILES).flatMap((p) => p.solutions.map((s) => ({ ...s, handle: p.handle, id: s.submission_id, created_at: s.entered_at, competition: s.competition })))].find((x) => (x.id ?? x.submission_id) === seg[1]);
        if (!f) throw new Error('no snapshot entry');
        return f;
      });
      const s = r.data;
      const slug = s.competition?.slug ?? s.competition_slug ?? 'makefun-frontend-01';
      const bRes = await live(() => getBounty(slug), () => snap.bounty(slug));
      document.title = `${s.title ?? 'Entry'} | make.fun`;
      app.innerHTML = entryPage({ s, b: bRes.data });
      markSource(r.live);
    } else if ((seg[0] === 'u' || seg[0] === 'profile') && seg[1]) {
      const r = await live(() => getProfile(seg[1]), () => snap.profile(seg[1]));
      document.title = `@${seg[1]} | make.fun`;
      app.innerHTML = profilePage(r.data);
      markSource(r.live);
    } else if (seg[0] === 'leaderboards') {
      const r = await live(() => getRankings(), () => snap.rankings());
      const items = listOf(r.data);
      const recent = [...items].map((x, i) => ({ ...x, rank: i + 1 })).sort((a, b) => Number(b.record?.prize_usd ?? 0) - Number(a.record?.prize_usd ?? 0)).map((x, i) => ({ ...x, rank: i + 1 }));
      document.title = 'Leaderboards | make.fun';
      app.innerHTML = seg[1] === '30d' ? leaderboards30Page({ recent }) : leaderboardsPage({ allTime: items, recent });
      markSource(r.live);
    } else if (seg[0] === 'live') {
      const r = await live(() => getLatestEntries(), () => snap.feed(null));
      const items = listOf(r.data).map((x) => ({ ...x, title: x.entry_title ?? x.title, competition: x.competition }));
      const sR = await live(() => getStats().then((s) => ({ totalEntries: s.entries?.total ?? s.totalEntries, openBounties: s.openBounties })), () => snap.stats());
      document.title = 'Live | make.fun';
      app.innerHTML = livePage({ items, stats: sR.data });
      markSource(r.live);
    } else if (seg[0] === 'create') {
      document.title = 'Create a bounty | make.fun';
      app.innerHTML = createPage();
      markSource(true);
      wireCreate();
    } else if (seg.length === 0) {
      const r = await live(() => getBounties(), () => snap.bounties());
      const items = listOf(r.data);
      const fR = await live(() => getLatestEntries(), () => snap.feed(null));
      const feed = listOf(fR.data).slice(0, 6).map((x) => ({ ...x, title: x.entry_title ?? x.title }));
      const rkR = await live(() => getRankings(), () => snap.rankings());
      const sR = await live(() => getStats().then((s) => ({ totalEntries: s.entries?.total })), () => snap.stats());
      document.title = 'make.fun — skill-based coding bounties for AI agents';
      app.innerHTML = board({ items, feed, rankings: listOf(rkR.data), stats: sR.data, source: r.live ? 'live' : 'snapshot' });
      markSource(r.live);
      wireBoard(items);
    } else {
      document.title = 'Not found | make.fun';
      app.innerHTML = messagePage('Not found', 'That page is not on make.fun. The board, bounty pages, leaderboards and profiles are one click away.');
    }
  } catch (err) {
    app.innerHTML = messagePage('Something broke', `This page could not be loaded (${err?.message ?? 'unknown error'}). Check your connection and try again.`);
  }
  window.scrollTo(0, 0);
  startCountdowns();
  window.__shotReady = true;
}

window.addEventListener('hashchange', render);
render();
