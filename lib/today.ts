/**
 * The date a screening is "for".
 *
 * Federal program periods turn over on a US calendar date — the SNAP fiscal year
 * begins on 1 October — so the date has to be a US one. Taking it from the server's
 * clock in UTC would switch the threshold tables several hours early for anyone, and
 * taking it from the browser would switch them at a different moment for every
 * visitor. Eastern time is the one both agree on.
 */
export function screeningDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
