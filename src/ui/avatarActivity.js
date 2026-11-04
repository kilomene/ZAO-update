/**
 * ZAO - Live avatar activity derivation.
 *
 * One pure source of truth for "what is ZAO doing RIGHT NOW", shared by
 * the ChatScreen header status line, the bottom typing indicator, and
 * the animated header avatar. The owner rule this implements: the small
 * status line streams the EXACT current action (like Muse's "Checking
 * gate output"), shortened to fit its one-line slot - never a generic
 * "Working… / Thinking…" loop while a real action is known. The FULL
 * process detail still lives in the Plan tab/screen; this module only
 * derives the short live feed from the signals chatStore already
 * publishes. No React, no side effects - plain data in, plain data out,
 * so it is directly unit-testable.
 *
 * Signal shapes (all from src/store/chatStore.js):
 *   planProgress   string stage label (planCoordinator.js, e.g.
 *                  "Planning execution steps for \"Fix the tests\"…")
 *                  OR { stage, message } (orchestrator.js deep-research
 *                  route, e.g. { stage: 'searching', message: 'Searching: …' })
 *   planSteps      array of completed-step labels: plain strings
 *                  (planExecutor.js onStep(step.description)), prefixed
 *                  strings ("Retrying: …"), or step objects
 *                  ({ ...step, status }) on failure paths - the label
 *                  is read from .description / .label / .title.
 *   browsingSteps  array of raw browser-agent step infos
 *                  ({ action: { action: 'navigate', url } }) - mapped
 *                  to friendly labels by formatBrowsingStepLabel below.
 *   streamingText / streamingThinking  in-progress reply / reasoning.
 */

/** Activity kinds the animated avatar understands. */
export const ACTIVITY_KINDS = Object.freeze([
  'idle',
  'thinking',
  'planning',
  'searching',
  'computer',
  'writing',
]);

const ELLIPSIS = '…';

/** Default width of the small one-line status slot in the header. */
export const DEFAULT_STATUS_MAX_LEN = 34;

/**
 * Smart shortening for the one-line status slot.
 *
 * Strategy, in order:
 *  1. Normalize whitespace and strip a dangling trailing ellipsis -
 *     the cut below re-adds exactly one.
 *  2. If it fits, return it untouched.
 *  3. Prefer cutting at the LAST word boundary that fits, so the label
 *     keeps its verb + as much of its key object as the slot allows
 *     ("Checking the gate output for the release" -> "Checking the gate
 *     output…").
 *  4. Quoted tails (plan-stage labels quote the task title, e.g.
 *     Planning execution steps for "Segregate the probes…") - if the
 *     opening quote sits inside the fitted prefix, close the quote
 *     after the ellipsis so the line never dangles an open quote.
 *  5. A single word longer than the slot is hard-cut.
 */
export function shortenActionLabel(label, maxLen = DEFAULT_STATUS_MAX_LEN) {
  if (typeof label !== 'string') return '';
  const limit = Number.isFinite(maxLen) && maxLen >= 8 ? Math.floor(maxLen) : DEFAULT_STATUS_MAX_LEN;
  const clean = label.replace(/\s+/g, ' ').trim().replace(/[…]+$/, '').trim();
  if (!clean) return '';
  if (clean.length <= limit) return clean;

  const budget = limit - 1; // room for the ellipsis
  const head = clean.slice(0, budget);
  const boundary = head.lastIndexOf(' ');
  let cut = boundary >= Math.floor(budget * 0.55) ? head.slice(0, boundary) : head;
  cut = cut.replace(/[\s,;:.\-–—]+$/, '');
  if (!cut) cut = head;
  const quoteCount = (cut.match(/"/g) || []).length;
  return quoteCount % 2 === 1 ? `${cut}${ELLIPSIS}"` : `${cut}${ELLIPSIS}`;
}

/**
 * Turns one raw AgentStep (from the Browser Router backend - see
 * browser-router/app/agent.py's AgentStep) into a short, friendly label
 * for the live status area, e.g. "Opening github.com" or "Reading the
 * page". This is the mapping ChatScreen.js used to keep as a private
 * helper; it lives here now so the header, typing indicator and avatar
 * all phrase browsing steps identically. Falls back to "Browsing" for
 * step kinds this hasn't been taught a friendly phrasing for, rather
 * than showing the raw backend detail string (deliberately verbose -
 * useful for debugging, not for a live progress UI).
 */
export function formatBrowsingStepLabel(stepInfo) {
  if (!stepInfo?.action) return 'Browsing';
  const { action } = stepInfo;

  switch (action.action) {
    case 'navigate': {
      try {
        return `Opening ${new URL(action.url).hostname.replace('www.', '')}`;
      } catch (e) {
        return 'Opening page';
      }
    }
    case 'click': return 'Clicking';
    case 'fill': return 'Typing';
    case 'selectOption': return 'Selecting an option';
    case 'setChecked': return 'Toggling a checkbox';
    case 'submitForm': return 'Submitting';
    case 'scrollTo': return 'Scrolling';
    case 'waitForSelector': return 'Waiting for the page';
    case 'extractPageText': return 'Reading the page';
    case 'extractTables': return 'Reading a table';
    case 'newTab': return 'Opening a new tab';
    case 'switchTab': return 'Switching tabs';
    case 'closeTab': return 'Closing a tab';
    case 'goBack': return 'Going back';
    case 'download': return 'Downloading a file';
    case 'needsHuman': return 'Needs your input';
    case 'finish': return 'Wrapping up';
    default: return 'Browsing';
  }
}

// Keyword -> kind mapping. Order matters: the first list with a hit
// wins, so 'searching' is checked before 'computer' ("search GitHub
// for…" is a search, not terminal work) and 'planning' before both
// ("Planning execution steps…" must stay planning even though the
// quoted task title can contain words like "edit" or "search").
const SEARCH_WORDS = [
  'search', 'brows', 'web', 'visit', 'open', 'read', 'fetch', 'look', 'check', 'inspect',
  'review', 'verif', 'google',
];
const COMPUTER_WORDS = [
  'edit', 'creat', 'writ', 'cod', 'commit', 'push', 'pull request', 'github', 'terminal',
  'shell', 'command', 'run', 'execut', 'build', 'test', 'install', 'file', 'folder',
  'download', 'upload', 'fix', 'refactor', 'deploy',
];
const PLANNING_WORDS = [
  'plan', 'break', 'understand', 'checkpoint', 'goal into', 'decompos', 'organizing', 'organis',
];

/** Maps a free-text action label to an avatar activity kind. */
export function kindForLabel(label) {
  if (typeof label !== 'string') return 'thinking';
  const text = ` ${label.toLowerCase()} `;
  const has = (words) => words.some((w) => text.includes(w));
  if (has(PLANNING_WORDS)) return 'planning';
  if (has(SEARCH_WORDS)) return 'searching';
  if (has(COMPUTER_WORDS)) return 'computer';
  return 'thinking';
}

/** Reads a display label out of the many shapes a plan step arrives in. */
function labelFromStep(step) {
  if (!step) return '';
  if (typeof step === 'string') return step.trim();
  if (typeof step === 'object') {
    const raw = step.description || step.label || step.title || step.message || '';
    return typeof raw === 'string' ? raw.trim() : '';
  }
  return '';
}

/** Reads { label, stage } out of planProgress (string or {stage,message}). */
function labelFromProgress(progress) {
  if (!progress) return { label: '', stage: '' };
  if (typeof progress === 'string') return { label: progress.trim(), stage: '' };
  if (typeof progress === 'object') {
    const message = typeof progress.message === 'string' ? progress.message.trim() : '';
    const stage = typeof progress.stage === 'string' ? progress.stage.trim() : '';
    return { label: message || stage, stage };
  }
  return { label: '', stage: '' };
}

const STAGE_KINDS = Object.freeze({
  planning_searches: 'planning',
  planning: 'planning',
  searching: 'searching',
  search: 'searching',
  reading: 'searching',
  writing: 'writing',
});

/**
 * Derives the current activity from the chat store's live signals.
 *
 * Priority (highest first - a real, specific action always beats a
 * generic streaming state):
 *  1. Latest PLAN STEP label (planSteps) - the exact step that just
 *     ran / is being retried, e.g. "Editing App.js".
 *  2. PLAN PROGRESS stage text (planProgress) - what plan-building is
 *     doing right now, e.g. 'Planning execution steps for "…"'. A
 *     structured {stage,message} progress keeps its stage's kind when
 *     one is known (searching/reading/writing/planning).
 *  3. Latest BROWSING step (browsingSteps) via formatBrowsingStepLabel.
 *  4. streamingText - the reply itself is flowing: kind 'writing',
 *     label 'Writing'. Generic, but only reached when no plan or
 *     browsing action exists to name.
 *  5. streamingThinking - kind 'thinking', label 'Thinking'.
 *  6. isSending with nothing specific yet - kind 'thinking',
 *     label 'Thinking'.
 *  7. Not sending - kind 'idle', label null (no status line).
 *
 * @param {object} signals - { isSending, streamingText, streamingThinking,
 *   planProgress, planSteps, browsingSteps }
 * @param {number} [maxLen] - status slot width passed to shortenActionLabel.
 * @returns {{ kind: string, label: string|null }}
 */
export function deriveActivity(signals = {}, maxLen = DEFAULT_STATUS_MAX_LEN) {
  const {
    isSending = false,
    streamingText = null,
    streamingThinking = null,
    planProgress = null,
    planSteps = [],
    browsingSteps = [],
  } = signals || {};

  if (!isSending) return { kind: 'idle', label: null };

  const steps = Array.isArray(planSteps) ? planSteps : [];
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const label = labelFromStep(steps[i]);
    if (label) return { kind: kindForLabel(label), label: shortenActionLabel(label, maxLen) };
  }

  const progress = labelFromProgress(planProgress);
  if (progress.label) {
    const stageKind = STAGE_KINDS[progress.stage.toLowerCase()];
    return {
      kind: stageKind || kindForLabel(progress.label),
      label: shortenActionLabel(progress.label, maxLen),
    };
  }

  const brows = Array.isArray(browsingSteps) ? browsingSteps : [];
  if (brows.length > 0) {
    const label = formatBrowsingStepLabel(brows[brows.length - 1]);
    return { kind: 'searching', label: shortenActionLabel(label, maxLen) };
  }

  if (streamingText) return { kind: 'writing', label: 'Writing' };
  if (streamingThinking) return { kind: 'thinking', label: 'Thinking' };
  return { kind: 'thinking', label: 'Thinking' };
}
