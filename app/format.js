// Small helpers for showing API values: escaping, money, dates, countdowns, markdown-lite.

/** Text made safe to put inside HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A dollar amount ('1000.00' or 0.5) as '$1,000' or '$0.50'. */
export function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '$0';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: Number.isInteger(n) ? 0 : 2 });
}

/** Money that always shows cents, for reward tables. */
export function money2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '$0.00';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

/** A whole number with thousands separators. */
export function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US') : '0';
}

/** A date in UTC, e.g. 'Nov 17, 2026, 12:30 PM UTC'. */
export function date(iso) {
  if (!iso) return '—';
  return `${new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
}

/** A short date, e.g. 'Nov 17, 2026'. */
export function day(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' });
}

/** A time-of-day in UTC, e.g. '12:30 PM'. */
export function clock(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
}

/** The time until a deadline: '2d 4h left', '35m left', or 'ended'. */
export function timeLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms)) return '';
  if (ms <= 0) return 'ended';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  if (minutes > 0) return `${minutes}m ${seconds}s left`;
  return `${seconds}s left`;
}

/** True when a bounty's deadline is still in the future (its status alone can lag). */
export function isOpen(b) {
  return b && new Date(b.deadline).getTime() > Date.now();
}

/** '3 hours ago' style relative time for feed rows. */
export function ago(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** A win-rate stored in micro units (956000) as '95.6%'. */
export function winRate(micro) {
  const n = Number(micro);
  if (!Number.isFinite(n)) return '—';
  const pct = n > 1000 ? n / 10000 : n;
  return `${pct.toFixed(1)}%`;
}

/** A file size as '286 B', '12.4 KB' or '1.2 MB'. */
export function bytes(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  if (v < 1024) return `${v} B`;
  if (v < 1048576) return `${(v / 1024).toFixed(1)} KB`;
  return `${(v / 1048576).toFixed(2)} MB`;
}

/** A duration in milliseconds as '15m 01s' or '42s'. */
export function duration(ms) {
  const v = Number(ms);
  if (!Number.isFinite(v)) return '—';
  const s = Math.round(v / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

/** A wallet address shortened in the middle: 'vu7bFs…nZX4SY'. */
export function shortAddr(addr) {
  const a = String(addr ?? '');
  return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-6)}` : a;
}

/** The one-letter avatar initial for a handle. */
export function initial(handle) {
  return String(handle ?? '?').replace(/^@/, '').charAt(0).toLowerCase() || '?';
}

/** A stable hue (0-359) from a handle, for avatar colours. */
export function hue(handle) {
  let h = 0;
  for (const c of String(handle ?? '')) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

/**
 * A tiny, safe markdown renderer for bounty descriptions: escapes everything first,
 * then headings, bold, inline code, links to make.fun, bullet and numbered lists.
 */
export function md(source) {
  const lines = String(source ?? '').split('\n');
  const out = [];
  let list = null;
  const closeList = () => { if (list) { out.push(list === 'ul' ? '</ul>' : '</ol>'); list = null; } };
  const inline = (t) => esc(t)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https:\/\/make\.fun[^)\s]*)\)/g, '<a href="$2" rel="noopener">$1</a>');
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (h) { closeList(); out.push(`<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`); }
    else if (bullet) { if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(bullet[1])}</li>`); }
    else if (numbered) { if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(numbered[1])}</li>`); }
    else if (line.trim() === '') closeList();
    else { closeList(); out.push(`<p>${inline(line)}</p>`); }
  }
  closeList();
  return out.join('\n');
}
