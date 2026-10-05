import * as Sentry from '@sentry/react-native';

// The one place a caught error becomes words on the screen.
//
// Before this, ~60 call sites did showAlert(title, e.message), and e.message is
// whatever the layer that failed happened to say. Offline, Android's OkHttp says
// 'Unable to resolve host "api.fitlifesolutions.site": No address associated with
// hostname' - which a user on a dropped mobile connection (most of ours) reads as
// "the app is broken", and which never tells them the one thing they can act on:
// they are offline. Worse, a server 500 could carry a file path, a stack line or a
// third-party API's raw response straight into an alert.
//
// So: classify the error, show a sentence written for a person, and send the raw
// text to the logs (console + a Sentry breadcrumb, which only leaves the phone with
// an event, and every event passes the diagnostics opt-out in App.js beforeSend).
//
// Messages the app or server deliberately wrote for users ("That file is too large
// for the server to accept.") are kept - many screens do `throw new Error(data.error)`
// with good server text, and losing that would make every failure say the same
// vague thing. "Deliberately written" is judged by shape: a plain sentence with no
// hostname, path, stack frame, exception name, error code or JSON in it.
//
// No NetInfo: it is a native module the installed build (vc13) does not contain, and
// the error text already says everything needed to tell offline from timeout from a
// server fault.

export const OFFLINE_MESSAGE = 'You seem to be offline. Check your internet connection and try again.';
export const TIMEOUT_MESSAGE = 'The connection is too slow right now. Please try again in a moment.';
export const SERVER_MESSAGE = 'Our server is having a problem. Please try again shortly.';
const DEFAULT_FALLBACK = 'Something went wrong. Please try again.';

const OFFLINE_RE = new RegExp([
  'unable to resolve host', 'no address associated with hostname', 'unknownhostexception',
  'network request failed', 'network-request-failed', 'network error', 'networkerror',
  'failed to connect', 'could not connect to the server', 'connectexception',
  'enotfound', 'enetunreach', 'ehostunreach', 'eai_again', 'network is unreachable',
  'internet connection appears to be offline', 'not connected to the internet',
  'software caused connection abort', 'connection reset', 'econnreset', 'econnaborted',
  'unexpected end of stream', 'sslhandshakeexception', 'connection closed',
].join('|'), 'i');

const TIMEOUT_RE = /timed? ?out|timeout|aborterror|sockettimeoutexception|etimedout/i;

const SERVER_RE = /^server error \(\d{3}\)|unexpected token|json parse|not valid json|unexpected end of json|<html|<!doctype|bad gateway|service unavailable|internal server error|gateway time-?out|status code 5\d\d/i;

// Things a sentence written for a user never contains.
const RAW_RE = new RegExp([
  'https?://', '\\b[\\w-]+\\.(?:site|com|net|org|io|ai|app|dev|cloud)\\b',
  '(?:^|\\s)/[\\w.-]+/', '\\bat [\\w.$<>]+ \\(', '\\w+exception\\b',
  '[{}<>]', '\\b(?:errno|syscall|stack|undefined|null|NaN)\\b', 'cannot read propert', 'is not a function',
  'is not defined', '\\b(?:firebase|firestore|ffmpeg|ffprobe|okhttp|java\\.|android\\.)', '\\bstatus(?: ?code)? \\d{3}',
  '\\(\\d{3}\\)', 'auth/',
].join('|'), 'i');
// Error codes are upper case, and must be matched case-sensitively or 'every' and
// 'export' would count as one.
const CODE_RE = /\b(?:E[A-Z]{4,}|E_[A-Z_]+|[A-Z]+_[A-Z_]{3,})\b/;

function rawText(err) {
  if (err == null) return '';
  if (typeof err === 'string') return err;
  return String(err.message || err.error || err.code || err);
}

/**
 * 'offline' | 'timeout' | 'server' | 'message' (safe to show as is) | 'unknown'
 */
export function errorKind(err) {
  if (err && typeof err === 'object' && err.userMessage) return 'message';
  const code = err && typeof err === 'object' ? String(err.code || '') : '';
  const status = err && typeof err === 'object' ? Number(err.status) : NaN;
  const text = rawText(err);
  const both = `${code} ${err?.name || ''} ${text}`;
  if (OFFLINE_RE.test(both)) return 'offline';
  if (TIMEOUT_RE.test(both) || status === 408 || status === 504) return 'timeout';
  if (status >= 500 || SERVER_RE.test(text)) return 'server';
  const t = text.trim();
  if (t && t.length <= 300 && !RAW_RE.test(t) && !CODE_RE.test(t)) return 'message';
  return 'unknown';
}

export function isOfflineError(err) {
  return errorKind(err) === 'offline';
}

/**
 * The words to show for a caught error. `fallback` is the screen's own sentence for
 * a failure it cannot describe better ("Could not download the video.").
 * The raw error is logged, never returned.
 */
export function friendlyError(err, fallback = DEFAULT_FALLBACK) {
  const kind = errorKind(err);
  const raw = rawText(err);
  if (kind !== 'message') {
    console.warn('[error]', kind, raw);
    try {
      Sentry.addBreadcrumb({ category: 'user-error', level: 'warning', message: `${kind}: ${raw}`.slice(0, 500) });
    } catch (e) {}
  }
  switch (kind) {
    case 'offline': return OFFLINE_MESSAGE;
    case 'timeout': return TIMEOUT_MESSAGE;
    case 'server': return SERVER_MESSAGE;
    case 'message': return (err && err.userMessage) || raw.trim();
    default: return fallback || DEFAULT_FALLBACK;
  }
}

/**
 * A shape-only check for text that did not come from a caught error but from a
 * server field (job.error). Same rules, same fallback.
 */
export function friendlyText(text, fallback) {
  if (!text) return fallback || DEFAULT_FALLBACK;
  return friendlyError(String(text), fallback);
}

/**
 * True for text that is plainly a raw network failure. showAlert() uses it as a safety
 * net, so a screen written later that forgets friendlyError() still says "offline"
 * rather than 'Unable to resolve host ...'. Deliberately narrow: only the offline and
 * timeout shapes, which no sentence we write ourselves would match.
 */
export function isRawNetworkText(text) {
  if (typeof text !== 'string' || !text) return false;
  if (text === OFFLINE_MESSAGE || text === TIMEOUT_MESSAGE) return false;
  return OFFLINE_RE.test(text) || /sockettimeoutexception|etimedout|aborterror/i.test(text);
}
