/**
 * Email addresses as people actually enter them on a phone.
 *
 * A soft keyboard in a right-to-left locale wraps Latin text in directional
 * marks (U+200E and friends). They are invisible, they survive a copy-paste,
 * and they make an address that looks perfect on screen fail validation — the
 * user is told to "enter a valid email address" while staring at one. The same
 * goes for a contact picker handing over `Name <addr>` or a `mailto:` link.
 *
 * So: strip what cannot be seen, unwrap the common containers, and only then
 * decide whether the address is well formed. Client and server share this, so
 * they can never disagree about what a given input means.
 */

/**
 * Zero-width and bidirectional formatting characters, plus the soft hyphen and
 * the byte-order mark. None of them can legally appear in an address, and none
 * of them is visible to whoever typed it.
 */
const INVISIBLE = /[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

/** Non-breaking space: a keyboard's idea of a space, but not one to keep. */
const NBSP = /\u00A0/g;

/** `Display Name <address@example.com>` — from a contact picker or a paste. */
const ANGLE_WRAPPED = /<([^<>]+)>\s*$/;

export function normalizeEmail(input: string): string {
  let text = input.normalize('NFKC').replace(INVISIBLE, '').replace(NBSP, ' ').trim();
  text = text.replace(/^mailto:/i, '').trim();
  // Unwrap before stripping spaces, because the wrapper needs them to be found.
  const wrapped = ANGLE_WRAPPED.exec(text);
  if (wrapped?.[1]) text = wrapped[1].trim();
  // An unquoted address cannot contain a space, so one is always a typo — most
  // often autocorrect adding a space after a dot. Repairing beats rejecting.
  return text.replace(/\s+/g, '');
}

/**
 * Why an address was rejected, in words that point at the fix. A form that can
 * only say "invalid" is useless when what is wrong is invisible.
 */
export function describeEmailProblem(input: string): string | null {
  const text = normalizeEmail(input);
  if (!text) return 'Enter your email address.';
  const at = text.indexOf('@');
  if (at === -1) return 'An email address needs an @ — for example name@example.com.';
  if (text.indexOf('@', at + 1) !== -1) return 'An email address can only contain one @.';
  if (at === 0) return 'Add the part before the @ — for example name@example.com.';
  const domain = text.slice(at + 1);
  if (!domain) return 'Add the part after the @ — for example name@example.com.';
  if (!domain.includes('.')) return 'The part after the @ needs a dot — for example example.com.';
  if (domain.startsWith('.') || domain.endsWith('.')) return 'The part after the @ cannot start or end with a dot.';
  return EMAIL_PATTERN.test(text) ? null : 'Enter a valid email address, for example name@example.com.';
}

/**
 * Deliberately permissive: something with one @ and a dotted domain. The
 * server's schema is the authority; this exists so the form can complain
 * before a round trip, not so it can invent stricter rules of its own.
 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isLikelyEmail(value: string): boolean {
  return EMAIL_PATTERN.test(normalizeEmail(value));
}
