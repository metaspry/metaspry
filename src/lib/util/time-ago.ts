/**
 * "5s ago" / "3m ago" / "2h ago" / "4d ago". Shared by the History rows and the Audit tab's
 * "Changed since" row so the two never disagree on wording.
 */
export function timeAgo(ts: number, now: number = Date.now()): string {
  const sec = Math.max(0, Math.floor((now - ts) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
