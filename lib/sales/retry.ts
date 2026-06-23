/**
 * Smart-calling retry schedule. Given a campaign intensity and how many attempts
 * have already been made, returns the delay (ms) before the next attempt.
 *
 * "attempts" is the number of calls already placed (incl. the one that just
 * finished), so the first retry uses index 0.
 */

const H = 60 * 60 * 1000;
const D = 24 * H;

// dicht / ausgewogen / sparsam
const AGGRESSIV = [2 * H, 4 * H, 1 * D, 2 * D];
const MODERAT = [1 * D, 2 * D, 3 * D];
const KONSERVATIV = [2 * D, 4 * D, 7 * D];

function tableFor(intensity: string | null | undefined): number[] {
  if (intensity === 'aggressiv') return AGGRESSIV;
  if (intensity === 'konservativ') return KONSERVATIV;
  return MODERAT;
}

export function nextAttemptDelayMs(intensity: string | null | undefined, attempts: number): number {
  const arr = tableFor(intensity);
  const idx = Math.min(Math.max(attempts - 1, 0), arr.length - 1);
  return arr[idx] ?? 2 * D;
}

/** Callback requested ("ruf in X zurück") — sooner than a missed-call retry. */
export function callbackDelayMs(intensity: string | null | undefined): number {
  if (intensity === 'aggressiv') return 1 * H;
  if (intensity === 'konservativ') return 1 * D;
  return 3 * H;
}
