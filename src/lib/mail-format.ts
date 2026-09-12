/**
 * Pure display helpers for the inbox list.
 *
 * These live in src/lib/ rather than src/server/ because the route renders
 * them in the browser, and they touch nothing server-only. Keeping them pure
 * is what makes the list's fiddliest decisions testable without a database.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Who the row is about: everyone on the thread except us.
 *
 * A list whose sender column reads our own address on every line tells the
 * reader nothing, so our address is filtered out. When that leaves nothing,
 * a note to ourselves, we fall back to it rather than render a blank cell.
 */
export function senderLabel(participants: string[], accountEmail: string): string {
  if (!participants.length) return "Unknown sender";
  const mine = accountEmail.trim().toLowerCase();
  const others = participants.filter((p) => p.trim().toLowerCase() !== mine);
  if (!others.length) return participants[0];
  return others.join(", ");
}

/**
 * Short enough for a 38px row. Anything older than a week is a date, because
 * "37d" is not something anyone converts in their head.
 */
export function relativeTime(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "—";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "—";

  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${then.getUTCDate()} ${MONTHS[then.getUTCMonth()]}`;
}

/** Gmail allows an empty subject; a blank row reads as a rendering fault. */
export function threadTitle(subject: string | null): string {
  const s = (subject ?? "").trim();
  return s.length ? s : "No subject";
}
