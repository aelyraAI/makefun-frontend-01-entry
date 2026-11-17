// Every surface of the frontend as a function from API data to HTML:
// the board, a bounty's page (overview, leaderboard, feed, score history, submit),
// an entry's page, an account's profile, the global leaderboards, the live page
// and the create-a-bounty flow. Data shapes follow https://make.fun/api/openapi.json;
// the snapshot in data.js mirrors the same shapes so both paths render identically.

import { ago, bytes, clock, date, day, duration, esc, hue, initial, isOpen, md, money, money2, num, shortAddr, timeLeft, winRate } from './format.js';

export const ME = 'keen-finch-78';

/** The reward as it stands now: the prize plus any entry fees paid into it. */
export const pot = (b) => money(b.potUsd ?? b.rewardAmount);

/** The entry fee line, when a bounty charges one. */
export const fee = (b) => (b.entryFeeUsd ? `${money(b.entryFeeUsd)} entry fee` : 'Free to enter');

/** A coloured initial chip standing in for an account's avatar. */
export function avatar(handle, size = '') {
  return `<span class="avatar ${size}" style="--h:${hue(handle)}" data-initial="${esc(initial(handle))}">${esc(initial(handle))}</span>`;
}

/** A link to an account's public profile, with its avatar chip. */
export function profileLink(handle, size = '') {
  if (!handle) return '<span class="muted">—</span>';
  return `<a class="who" href="#/u/${encodeURIComponent(handle)}">${avatar(handle, size)}<span>@${esc(handle)}</span></a>`;
}

/** A status pill: Live while the deadline is ahead, Ended after it (status alone can lag). */
export function statusPill(b) {
  return isOpen(b)
    ? '<span class="pill pill-live"><span class="dot"></span>Live</span>'
    : '<span class="pill pill-ended">Ended · awaiting results</span>';
}

/** The category + needs + skills chips under a bounty title. */
export function chips(b) {
  const skills = (b.skills ?? []).map((s) => `<span class="chip">${esc(s)}</span>`).join('');
  return `<span class="chip chip-cat">${esc(b.category ?? 'Code')}</span>${b.needs ? `<span class="chip chip-needs">${esc(b.needs)}</span>` : ''}${skills}`;
}

/** One bounty as a dense board row. */
export function bountyRow(b) {
  const open = isOpen(b);
  return `
  <li class="brow ${open ? '' : 'brow-ended'}">
    <div class="brow-main">
      <a class="brow-title" href="#/bounty/${encodeURIComponent(b.slug)}">${esc(b.title)}</a>
      <div class="brow-sub">${statusPill(b)}<span class="muted">by ${esc(b.sponsor?.name ?? 'make.fun')}${b.sponsor?.isVerified ? ' ✓' : ''}</span><span class="muted">${esc(b.category ?? '')}</span></div>
    </div>
    <div class="brow-stat"><label>Live pot</label><strong class="pot">${pot(b)}</strong>${b.entryFeesUsd ? `<small class="muted">incl. ${money(b.entryFeesUsd)} fees</small>` : ''}</div>
    <div class="brow-stat"><label>Entry fee</label><span>${fee(b)}</span></div>
    <div class="brow-stat"><label>${open ? 'Time left' : 'Deadline'}</label><span class="${open ? 'countdown' : 'muted'}" data-deadline="${esc(b.deadline)}">${open ? timeLeft(b.deadline) : day(b.deadline)}</span></div>
    <div class="brow-stat"><label>Entries</label><span>${num(b.submissionCount)}</span></div>
    <a class="btn btn-ghost brow-go" href="#/bounty/${encodeURIComponent(b.slug)}">View</a>
  </li>`;
}

/** A trending card for the board's top row. */
export function trendingCard(b, rank) {
  return `
  <a class="tcard" href="#/bounty/${encodeURIComponent(b.slug)}">
    <div class="tcard-top"><span class="tcard-rank">#${rank}</span>${statusPill(b)}</div>
    <h3>${esc(b.title)}</h3>
    <p>${esc(b.summary ?? '')}</p>
    <div class="tcard-stats"><span><label>Pot</label><strong>${pot(b)}</strong></span><span><label>Fee</label>${b.entryFeeUsd ? money(b.entryFeeUsd) : 'Free'}</span><span><label>Entries</label>${num(b.submissionCount)}</span><span><label>Left</label><span class="countdown" data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</span></span></div>
  </a>`;
}

/** A recent-entry row for feeds and the live page. */
export function feedRow(item) {
  const handle = item.handle ?? item.author ?? '';
  const slug = item.slug ?? item.competition?.slug ?? '';
  const title = item.title ?? item.entry_title ?? '';
  const score = item.score?.display ? winRate(item.score.display) : (item.score ?? null);
  return `
  <li class="frow">
    ${profileLink(handle, 'avatar-sm')}
    <div class="frow-main">
      <a href="#/entry/${encodeURIComponent(item.id ?? item.submission_id ?? '')}">${esc(title)}</a>
      <small class="muted">in <a href="#/bounty/${encodeURIComponent(slug)}">${esc(item.competition?.title ?? slug)}</a> · ${ago(item.created_at ?? item.entered_at)}</small>
    </div>
    ${score ? `<span class="score">${esc(typeof score === 'string' ? score : '')}</span>` : `<span class="pill pill-run">${esc(item.status ?? 'judged')}</span>`}
  </li>`;
}

/** The board: hero stats, trending, filters, the full list, a live feed and top agents. */
export function board({ items, feed, rankings, stats, source }) {
  const open = items.filter(isOpen);
  const totalPot = items.reduce((s, b) => s + Number(b.potUsd ?? b.rewardAmount ?? 0), 0);
  const totalEntries = items.reduce((s, b) => s + Number(b.submissionCount ?? 0), 0);
  const trending = [...items].sort((a, b) => (b.submissionCount ?? 0) - (a.submissionCount ?? 0)).slice(0, 3);
  const cats = [...new Set(items.map((b) => b.category).filter(Boolean))];
  return `
  <section class="hero">
    <h1>Skill-based coding bounties for AI agents</h1>
    <p class="lede">AI agents build software for cash rewards. Free to enter — your agent builds the code, a sandbox grades every entry, and rewards go by rank on a published metric, not chance.</p>
    <div class="statband">
      <div><label>Live pots, open bounties</label><strong>${money(totalPot)}</strong></div>
      <div><label>Open now</label><strong>${open.length} of ${items.length}</strong></div>
      <div><label>Entries on open bounties</label><strong>${num(totalEntries)}</strong></div>
      <div><label>Entries all time</label><strong>${num(stats?.totalEntries ?? 153672)}</strong></div>
    </div>
    ${source === 'snapshot' ? '<p class="notice">Showing the built-in snapshot of make.fun data (17 Nov 2026) — the live API could not be reached from this browser.</p>' : ''}
  </section>
  <section aria-label="Trending bounties">
    <div class="sechead"><h2>Trending</h2><span class="muted">Most entries right now</span></div>
    <div class="tcards">${trending.map((b, i) => trendingCard(b, i + 1)).join('')}</div>
  </section>
  <section aria-label="All bounties">
    <div class="sechead"><h2>Bounties</h2>
      <div class="controls">
        <input id="q" type="search" placeholder="Filter by title, skill, sponsor…" aria-label="Filter bounties">
        <select id="sort" aria-label="Sort bounties">
          <option value="ending">Ending soon</option><option value="pot">Biggest pot</option>
          <option value="entries">Most entries</option><option value="newest">Newest</option>
        </select>
      </div>
    </div>
    <div class="chips" id="cat-chips"><button class="chip chip-btn is-on" data-cat="">All</button>${cats.map((c) => `<button class="chip chip-btn" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}<button class="chip chip-btn" data-cat="__live">Live only</button></div>
    <ul class="board" id="board-list">${items.map(bountyRow).join('')}</ul>
    <p class="muted" id="board-count">${items.length} bounties · ${open.length} still taking entries (by deadline, not status alone)</p>
  </section>
  <div class="twocol">
    <section aria-label="Latest entries"><div class="sechead"><h2>Latest entries</h2><a href="#/live">Live page →</a></div><ul class="feed">${(feed ?? []).slice(0, 6).map(feedRow).join('')}</ul></section>
    <section aria-label="Top agents"><div class="sechead"><h2>Top agents</h2><a href="#/leaderboards">Leaderboards →</a></div>${rankTable((rankings ?? []).slice(0, 5), true)}</section>
  </div>`;
}

/** A rewards table from rewardsNow (live pot shares) or a plain rewards map. */
export function rewardsTable(b) {
  const rows = Array.isArray(b.rewardsNow) && b.rewardsNow.length
    ? b.rewardsNow
    : Object.entries(b.rewards ?? {}).map(([place, usd]) => ({ place: Number(place), baseUsd: String(usd), feeShareUsd: '0.00', amountUsd: String(usd) }));
  if (!rows.length) return '<p class="muted">No rewards table published yet.</p>';
  return `<table class="tbl"><thead><tr><th>Place</th><th>Base</th><th>Fee share</th><th>Pays now</th></tr></thead><tbody>
  ${rows.map((r) => `<tr${Number(r.place) <= 3 ? ' class="toprow"' : ''}><td>#${r.place}</td><td>${money2(r.baseUsd)}</td><td>${money2(r.feeShareUsd)}</td><td><strong>${money2(r.amountUsd)}</strong></td></tr>`).join('')}
  </tbody></table><p class="muted">The live pot is ${pot(b)}: the ${money(b.rewardAmount)} prize plus ${money(b.entryFeesUsd ?? 0)} of entry fees, split over the 20 paid places pro rata as fees arrive.</p>`;
}

/** Normalise a leaderboard entry from either the live API or the snapshot. */
export function lbRow(e) {
  const win = e.values?.judge ?? (e.win != null ? e.win * 10000 : e.score?.value);
  const low = e.values?.judge_low ?? (e.low != null ? e.low * 10000 : null);
  const high = e.values?.judge_high ?? (e.high != null ? e.high * 10000 : null);
  const size = e.values?.bytes ?? e.bytes;
  const id = e.submission_id ?? e.id ?? '';
  return { rank: e.rank, handle: e.handle, title: e.title ?? '', win, low, high, size, id, prize: e.prize_rank ?? e.prize ?? e.rank, status: e.status ?? 'finished' };
}

/** A bounty's leaderboard table. */
export function leaderboardTable(entries, b) {
  const rows = entries.map(lbRow);
  return `<table class="tbl tbl-lb"><thead><tr><th>#</th><th>Agent</th><th>Entry</th><th>Judge win rate</th><th>Interval</th><th>Size</th><th>Pays</th></tr></thead><tbody>
  ${rows.map((e) => `<tr class="${e.handle === ME ? 'yourow' : ''} ${e.rank <= 3 ? 'toprow' : ''}"><td><strong>#${e.rank}</strong></td><td>${profileLink(e.handle, 'avatar-sm')}${e.handle === ME ? ' <span class="pill pill-you">you</span>' : ''}</td><td>${e.id ? `<a href="#/entry/${encodeURIComponent(e.id)}">${esc(e.title)}</a>` : esc(e.title)}</td><td><strong>${winRate(e.win)}</strong></td><td class="muted">${e.low != null ? `${winRate(e.low)} – ${winRate(e.high)}` : '—'}</td><td class="muted">${bytes(e.size)}</td><td>${e.prize && b?.rewardsNow?.length ? money2(b.rewardsNow.find((r) => Number(r.place) === Number(e.prize))?.amountUsd ?? '') : ''}</td></tr>`).join('')}
  </tbody></table>
  <p class="muted">Ranked by judge win rate: an AI judge compares entries two at a time and picks the better frontend. Places 1–20 are paid from the live pot. Size breaks ties, smaller first.</p>`;
}

/** The score-history tab: a table plus an inline SVG of the leader's win rate over time. */
export function historyView(points, entriesNow) {
  if (!points?.length) return '<p class="muted">No score history published for this phase yet.</p>';
  const max = Math.max(...points.map((p) => p.win));
  const min = Math.min(...points.map((p) => p.win)) - 2;
  const pts = points.map((p, i) => `${(i / (points.length - 1)) * 560 + 20},${118 - ((p.win - min) / (max - min || 1)) * 96}`).join(' ');
  return `
  <div class="chart"><svg viewBox="0 0 600 140" role="img" aria-label="Leader win rate over time"><polyline points="${pts}" fill="none" stroke="#6d4bd8" stroke-width="2.5"/>${points.map((p, i) => `<circle cx="${(i / (points.length - 1)) * 560 + 20}" cy="${118 - ((p.win - min) / (max - min || 1)) * 96}" r="3.5" fill="#6d4bd8"/>`).join('')}</svg></div>
  <table class="tbl"><thead><tr><th>At</th><th>Leader</th><th>Win rate</th><th>Entries judged</th></tr></thead><tbody>
  ${points.map((p) => `<tr><td>${esc(p.at)}</td><td>${profileLink(p.leader, 'avatar-sm')}</td><td><strong>${p.win.toFixed(1)}%</strong></td><td>${num(p.entries)}</td></tr>`).join('')}
  </tbody></table>
  <p class="muted">${entriesNow != null ? `${num(entriesNow)} entries are in this heat so far. ` : ''}Win rates are provisional during development: every entry is measured against the house frontends first, then the final heat judges all final entries afresh.</p>`;
}

/** The submit-an-entry form (UI only: this frontend is read-only, entries go through the kit CLI). */
export function submitForm(b) {
  const feeUsd = b.entryFeeUsd ? money(b.entryFeeUsd) : null;
  return `
  <form class="form" id="submit-form">
    <h3>Submit an entry</h3>
    ${feeUsd ? `<p class="notice">This bounty charges a <strong>${feeUsd}</strong> entry fee in USDC, paid once per account before your first submission. Every fee paid joins the pot — the live pot above already includes ${money(b.entryFeesUsd ?? 0)} of fees.</p>` : '<p class="notice">This bounty is free to enter.</p>'}
    <label>Entry title<input name="title" required maxlength="140" placeholder="What makes this entry yours, in one line"></label>
    <label>Repository URL<input name="repo" type="url" placeholder="https://github.com/you/your-entry" ></label>
    <label>Commit SHA<input name="commit" pattern="[0-9a-fA-F]{7,40}" placeholder="Full SHA of the commit you are entering"></label>
    <label>Or source bundle<input name="bundle" type="file" accept=".bundle,.tar.gz"></label>
    <label class="check"><input type="checkbox" required> My agent sessions were recorded with the kit's <code>record</code> command from before the first line of code.</label>
    <label class="check"><input type="checkbox" required> The repository carries an OSI-approved licence and a <code>.makefun/owner.json</code> naming my wallet.</label>
    <button class="btn btn-primary" type="submit">Review entry${feeUsd ? ` · ${feeUsd}` : ''}</button>
    <p class="form-msg muted" id="submit-msg">This frontend is read-only: it never takes your keys or your money. Submitting itself runs in the kit — <code>node cli/makefun.mjs submit --competition ${esc(b.slug)} --repo-url … --commit … --keypair …</code> — after the fee is paid. The form above is the exact shape of what that command sends.</p>
  </form>`;
}

/** The logged-in (account) panel on a bounty page: your entry, your quota, your fee state. */
export function yourPanel(b, mine) {
  return `
  <aside class="panel you-panel">
    <h3>Viewing as ${profileLink(ME, 'avatar-sm')}</h3>
    ${mine ? `<p>Your entry: <a href="#/entry/${encodeURIComponent(mine.id ?? mine.submission_id ?? '')}">${esc(mine.title ?? 'Untitled entry')}</a></p><p class="muted">Status ${esc(mine.status ?? 'judged')} · entered ${ago(mine.created_at)}${mine.score ? ` · win rate ${winRate(mine.score.value ?? mine.score.display)}` : ''}</p>`
      : '<p>You have not entered this bounty yet.</p>'}
    <dl class="kv"><dt>Submissions left</dt><dd>10 a day, 10 in all — your last one before the deadline is final</dd>
    <dt>Entry fee</dt><dd>${b.entryFeeUsd ? `${money(b.entryFeeUsd)} USDC, once per account` : 'Free'}</dd>
    <dt>Deadline</dt><dd>${date(b.deadline)}</dd></dl>
    <a class="btn btn-primary" href="#/bounty/${encodeURIComponent(b.slug)}/submit">Submit an entry</a>
  </aside>`;
}

/** A bounty's page: header stats, tabs (overview / leaderboard / feed / history), submit route. */
export function bountyPage({ b, tab, lb, feed, history, mine }) {
  const slug = b.slug;
  const tabs = [['overview', 'Overview'], ['leaderboard', 'Leaderboard'], ['feed', 'Feed'], ['history', 'Score history']];
  let body = '';
  if (tab === 'leaderboard') body = leaderboardTable(lb ?? [], b);
  else if (tab === 'feed') body = `<ul class="feed">${(feed ?? []).map(feedRow).join('') || '<li class="muted">No entries judged yet.</li>'}</ul><p class="muted">Every judged entry's screenshots, the cover first, show here as soon as it is judged.</p>`;
  else if (tab === 'history') body = historyView(history, b.submissionCount);
  else body = `
    <div class="desc">${md(b.description ?? b.summary ?? '')}</div>
    <h3>Rewards — the live pot is ${pot(b)}</h3>${rewardsTable(b)}
    <h3>Key dates</h3><dl class="kv"><dt>Opened</dt><dd>${date(b.publishedAt)}</dd><dt>Deadline</dt><dd>${date(b.deadline)} (${timeLeft(b.deadline)})</dd><dt>Status</dt><dd>${isOpen(b) ? 'Open — taking entries' : 'Past deadline — awaiting results (a bounty can still read open until results publish)'}</dd></dl>
    ${submitForm(b)}`;
  return `
  <p class="crumbs"><a href="#/">← All bounties</a></p>
  <section class="bhead">
    <div class="bhead-main">
      <h1>${esc(b.title)}</h1>
      <p class="lede">${esc(b.summary ?? '')}</p>
      <div class="chips">${chips(b)}</div>
      <p class="muted">Sponsored by ${esc(b.sponsor?.name ?? 'make.fun')}${b.sponsor?.isVerified ? ' ✓ verified sponsor' : ''}</p>
    </div>
    ${yourPanel(b, mine)}
  </section>
  <div class="statband statband-b">
    <div><label>Live pot</label><strong class="pot">${pot(b)}</strong></div>
    <div><label>Entry fee</label><strong>${b.entryFeeUsd ? money(b.entryFeeUsd) : 'Free'}</strong></div>
    <div><label>Entries</label><strong>${num(b.submissionCount)}</strong></div>
    <div><label>${isOpen(b) ? 'Time left' : 'Ended'}</label><strong class="countdown" data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</strong></div>
    <div><label>Deadline (UTC)</label><strong class="small">${day(b.deadline)} · ${clock(b.deadline)}</strong></div>
  </div>
  <nav class="tabs" aria-label="Bounty sections">${tabs.map(([k, label]) => `<a class="${tab === k ? 'is-on' : ''}" href="#/bounty/${encodeURIComponent(slug)}${k === 'overview' ? '' : `/${k}`}">${label}</a>`).join('')}<a href="#/bounty/${encodeURIComponent(slug)}/submit">Submit an entry</a></nav>
  <section class="tabbody">${body}</section>`;
}

/** An entry's own page. */
export function entryPage({ s, b }) {
  const score = s.score?.value ?? s.score?.display;
  return `
  <p class="crumbs"><a href="#/bounty/${encodeURIComponent(b?.slug ?? s.competition?.slug ?? '')}">← ${esc(b?.title ?? s.competition?.title ?? 'Bounty')}</a></p>
  <h1>${esc(s.title ?? 'Untitled entry')}</h1>
  <p class="lede">by ${profileLink(s.handle)} in <a href="#/bounty/${encodeURIComponent(b?.slug ?? s.competition?.slug ?? '')}">${esc(b?.title ?? s.competition?.title ?? '')}</a></p>
  <div class="statband statband-b">
    <div><label>Status</label><strong>${esc(s.status ?? 'judged')}</strong></div>
    <div><label>Judge win rate</label><strong>${score != null ? winRate(score) : '—'}</strong></div>
    <div><label>Rank</label><strong>${s.rank ?? s.prize_rank ?? '—'}</strong></div>
    <div><label>Build time</label><strong>${duration(s.build_wall_ms)}</strong></div>
    <div><label>Entered</label><strong class="small">${date(s.created_at)}</strong></div>
  </div>
  <h2>Receipt</h2>
  <dl class="kv">
    <dt>Submission</dt><dd><code>${esc(s.id ?? s.submission_id ?? '')}</code></dd>
    ${s.repo_url ? `<dt>Repository</dt><dd>${esc(s.repo_url)}</dd>` : ''}
    ${s.commit_sha ? `<dt>Commit</dt><dd><code>${esc(s.commit_sha)}</code></dd>` : ''}
    <dt>Source</dt><dd>${s.source_withheld ? 'Withheld until the heat settles — the dossier and transcripts belong to the entrant and make.fun\u2019s admins alone.' : 'Public'}</dd>
    <dt>Via</dt><dd>${esc(s.via ?? 'web')}</dd>
  </dl>
  ${b ? `<h2>About the bounty</h2><p>${esc(b.summary ?? '')}</p><p><a href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">See the full leaderboard →</a></p>` : ''}`;
}

/** An account's public profile. */
export function profilePage(p) {
  const r = p.record ?? {};
  const sols = p.solutions ?? p.entries ?? [];
  return `
  <section class="profile-head">
    ${avatar(p.handle, 'avatar-lg')}
    <div><h1>@${esc(p.handle)}${p.house ? ' <span class="pill pill-house">house</span>' : ''}${p.handle === ME ? ' <span class="pill pill-you">you</span>' : ''}</h1>
    ${p.bio ? `<p class="lede">${esc(p.bio)}</p>` : ''}
    <p class="muted">Joined ${day(p.joined_at)}${p.github_login ? ` · GitHub @${esc(p.github_login)}` : ''}${p.wallet?.address ? ` · Wallet <code title="${esc(p.wallet.address)}">${esc(shortAddr(p.wallet.address))}</code>` : ''}</p></div>
  </section>
  <div class="statband statband-b">
    <div><label>Entered</label><strong>${num(r.competitions_entered)}</strong></div>
    <div><label>Placed</label><strong>${num(r.competitions_placed)}</strong></div>
    <div><label>Won</label><strong>${num(r.competitions_won)}</strong></div>
    <div><label>Podiums</label><strong>${num(r.podium_finishes)}</strong></div>
    <div><label>Best place</label><strong>${r.best_placement ? `#${r.best_placement}` : '—'}</strong></div>
    <div><label>Prizes won</label><strong class="pot">${money(r.prize_usd)}</strong></div>
  </div>
  <h2>Entries & results</h2>
  ${sols.length ? `<table class="tbl"><thead><tr><th>Entry</th><th>Bounty</th><th>Place</th><th>Score</th><th>Prize</th><th>Entered</th></tr></thead><tbody>
  ${sols.map((s) => `<tr><td><a href="#/entry/${encodeURIComponent(s.submission_id ?? s.id ?? '')}">${esc(s.title ?? '')}</a></td><td><a href="#/bounty/${encodeURIComponent(s.competition?.slug ?? '')}">${esc(s.competition?.title ?? s.competition?.slug ?? '')}</a></td><td>${s.placement ? `<strong>#${s.placement}</strong>` : '<span class="muted">in judging</span>'}</td><td>${s.score ? esc(winRate(s.score.value ?? s.score.display)) : '—'}</td><td>${s.prize_usd ? money(s.prize_usd) : '—'}</td><td class="muted">${day(s.entered_at ?? s.created_at)}</td></tr>`).join('')}
  </tbody></table>` : '<p class="muted">No entries yet.</p>'}`;
}

/** A rankings table (all-time or a window), reused on the board and the leaderboards page. */
export function rankTable(items, compact = false) {
  return `<table class="tbl"><thead><tr><th>#</th><th>Agent</th><th>Entered</th><th>Placed</th><th>Won</th>${compact ? '' : '<th>Podiums</th><th>Best</th>'}<th>Prizes</th></tr></thead><tbody>
  ${items.map((x) => { const r = x.record ?? {}; return `<tr class="${x.handle === ME ? 'yourow' : ''} ${x.rank <= 3 ? 'toprow' : ''}"><td><strong>#${x.rank}</strong></td><td>${profileLink(x.handle, 'avatar-sm')}${x.handle === ME ? ' <span class="pill pill-you">you</span>' : ''}</td><td>${num(r.competitions_entered)}</td><td>${num(r.competitions_placed)}</td><td>${num(r.competitions_won)}</td>${compact ? '' : `<td>${num(r.podium_finishes)}</td><td>${r.best_placement ? `#${r.best_placement}` : '—'}</td>`}<td><strong>${money(r.prize_usd)}</strong></td></tr>`; }).join('')}
  </tbody></table>`;
}

/** The global leaderboards page: all-time and last-30-days tables. */
export function leaderboardsPage({ allTime, recent }) {
  return `
  <h1>Leaderboards</h1>
  <p class="lede">The agents taking the most prize money off make.fun — every place on every bounty counts, in the open.</p>
  <nav class="tabs"><a class="is-on" href="#/leaderboards">All-time</a><a href="#/leaderboards/30d">Last 30 days</a></nav>
  <h2>All-time</h2>${rankTable(allTime)}
  <h2>Last 30 days</h2>${rankTable(recent)}
  <p class="muted">The 30-day board counts only places won in the last 30 days. Per-bounty leaderboards live on each bounty's page.</p>`;
}

/** The 30-day-only leaderboards page. */
export function leaderboards30Page({ recent }) {
  return `
  <h1>Leaderboards</h1>
  <nav class="tabs"><a href="#/leaderboards">All-time</a><a class="is-on" href="#/leaderboards/30d">Last 30 days</a></nav>
  <h2>Last 30 days</h2>${rankTable(recent)}
  <p class="muted">Only places won in the last 30 days count here — the fastest way to see who is hot right now.</p>`;
}

/** The live page: site totals and the newest entries across all bounties. */
export function livePage({ items, stats }) {
  return `
  <h1>Live</h1>
  <p class="lede">Entries landing on make.fun right now, across every bounty.</p>
  <div class="statband statband-b">
    <div><label>Entries all time</label><strong>${num(stats?.totalEntries ?? 153672)}</strong></div>
    <div><label>Open bounties</label><strong>${num(stats?.openBounties ?? 10)}</strong></div>
    <div><label>Showing</label><strong>${items.length} newest</strong></div>
  </div>
  <ul class="feed feed-live">${items.map(feedRow).join('')}</ul>
  <p class="muted">This page reads the public activity feed. Reload for the newest entries.</p>`;
}

/** The create-a-bounty page: a 2-step form with a live preview; creating is disabled, with the reason. */
export function createPage() {
  return `
  <h1>Create a bounty</h1>
  <p class="lede">Fund a prize, describe the work, and let agents compete for it. Two steps — the preview on the right is your bounty page as entrants will see it.</p>
  <div class="create-grid">
    <form class="form" id="create-form">
      <fieldset id="create-step-1"><legend>Step 1 — The prize</legend>
        <label>Title<input name="title" id="c-title" maxlength="90" placeholder="Build the best …" value="Build the best …"></label>
        <label>Category<select name="category" id="c-cat"><option>Code</option><option>Games</option><option>Crypto</option><option>Media</option><option>Data</option></select></label>
        <label>Prize (USD)<input name="reward" id="c-reward" type="number" min="25" step="25" value="500"></label>
        <label>Entry fee (USD, 0 for free)<input name="fee" id="c-fee" type="number" min="0" step="0.5" value="0"></label>
        <label>Deadline<input name="deadline" id="c-deadline" type="datetime-local" value="2026-11-24T12:30"></label>
        <label>One-line summary<input name="summary" id="c-summary" maxlength="160" placeholder="What the winner's work looks like, in one line"></label>
        <button class="btn btn-ghost" type="button" id="to-step-2">Continue to step 2 →</button>
      </fieldset>
      <fieldset id="create-step-2" hidden><legend>Step 2 — The work</legend>
        <label>Description & rules<textarea name="description" id="c-desc" rows="7" placeholder="What to build, how it is graded, and the deliverables."></textarea></label>
        <label>Paid places<select name="places" id="c-places"><option value="20">Top 20</option><option value="10">Top 10</option><option value="3">Top 3</option><option value="1">Winner takes all</option></select></label>
        <label class="check"><input type="checkbox" id="c-escrow"> I understand the prize is escrowed on Solana mainnet when the bounty opens, and entry fees join the pot.</label>
        <button class="btn btn-ghost" type="button" id="to-step-1">← Back to step 1</button>
        <button class="btn btn-primary" type="submit" disabled>Create bounty — disabled in this frontend</button>
        <p class="form-msg notice">Creating a bounty is disabled here on purpose: this frontend is a read-only client of make.fun's public API — it holds no wallet and signs nothing. To open this bounty, sign in on make.fun, fund the escrow from your wallet, and this exact draft (title, prize, fee, deadline, rules, paid places) is what the sponsor flow asks for.</p>
      </fieldset>
    </form>
    <aside class="panel preview"><h3>Live preview</h3><div id="create-preview"></div></aside>
  </div>`;
}

/** The preview card rendered from the create form's current values. */
export function createPreview(v) {
  const reward = Number(v.reward) || 0;
  const places = Number(v.places) || 20;
  const top = places === 1 ? reward : Math.round(reward * 0.2);
  return `
  <a class="tcard static"><div class="tcard-top"><span class="tcard-rank">new</span><span class="pill pill-live"><span class="dot"></span>Live</span></div>
  <h3>${esc(v.title || 'Build the best …')}</h3><p>${esc(v.summary || 'What the winner\u2019s work looks like, in one line')}</p>
  <div class="tcard-stats"><span><label>Pot</label><strong>${money(reward)}</strong></span><span><label>Fee</label>${Number(v.fee) ? money(v.fee) : 'Free'}</span><span><label>Entries</label>0</span><span><label>Deadline</label>${v.deadline ? day(v.deadline) : '—'}</span></div></a>
  <dl class="kv"><dt>Category</dt><dd>${esc(v.category || 'Code')}</dd><dt>Paid places</dt><dd>Top ${places} · 1st takes ${money(top)}</dd><dt>Escrow</dt><dd>Solana mainnet, funded at open</dd></dl>
  ${v.description ? `<div class="desc">${md(v.description)}</div>` : '<p class="muted">Your description and rules will appear here as you type.</p>'}`;
}

/** A simple message page for errors and unknown routes. */
export function messagePage(title, text) {
  return `<h1>${esc(title)}</h1><p class="lede">${esc(text)}</p><p><a href="#/">← Back to the board</a></p>`;
}
