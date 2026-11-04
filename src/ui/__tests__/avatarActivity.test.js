import {
  ACTIVITY_KINDS,
  DEFAULT_STATUS_MAX_LEN,
  deriveActivity,
  formatBrowsingStepLabel,
  kindForLabel,
  shortenActionLabel,
} from '../avatarActivity';

describe('shortenActionLabel', () => {
  test('returns short labels untouched', () => {
    expect(shortenActionLabel('Checking gate output')).toBe('Checking gate output');
    expect(shortenActionLabel('Editing App.js')).toBe('Editing App.js');
  });

  test('normalizes whitespace and strips a dangling ellipsis', () => {
    expect(shortenActionLabel('  Planning   tasks…  ')).toBe('Planning tasks');
  });

  test('keeps verb + key object when shortening a long plan-step label', () => {
    const out = shortenActionLabel('Checking the gate output for the release build', 28);
    expect(out.length).toBeLessThanOrEqual(28);
    expect(out.startsWith('Checking the gate')).toBe(true);
    expect(out.endsWith('…')).toBe(true);
  });

  test('shortened output never exceeds maxLen (incl. the ellipsis)', () => {
    const label = 'Running the full verification suite against the production relay and dashboard';
    for (const maxLen of [12, 20, DEFAULT_STATUS_MAX_LEN, 40]) {
      expect(shortenActionLabel(label, maxLen).length).toBeLessThanOrEqual(maxLen);
    }
  });

  test('closes an open quote left dangling by the cut', () => {
    const out = shortenActionLabel('Steps: "Segregateprobesfrom the dashboard and clean up"', 20);
    expect(out).toBe('Steps: "Segregatepr…"');
    expect((out.match(/"/g) || []).length % 2).toBe(0);
  });

  test('a quoted plan-stage label shortens without a dangling quote', () => {
    const out = shortenActionLabel('Planning execution steps for "Segregate the probes and clean up"', 34);
    expect(out.length).toBeLessThanOrEqual(34);
    expect((out.match(/"/g) || []).length % 2).toBe(0);
    expect(out.endsWith('…') || out.endsWith('…"')).toBe(true);
  });

  test('hard-cuts a single word longer than the slot', () => {
    const out = shortenActionLabel('Supercalifragilisticexpialidociousness', 12);
    expect(out.length).toBe(12);
    expect(out.endsWith('…')).toBe(true);
  });

  test('non-string and empty input give an empty string', () => {
    expect(shortenActionLabel(null)).toBe('');
    expect(shortenActionLabel(undefined)).toBe('');
    expect(shortenActionLabel('   ')).toBe('');
    expect(shortenActionLabel({ label: 'x' })).toBe('');
  });
});

describe('kindForLabel', () => {
  test('maps editing / terminal / github work to computer', () => {
    expect(kindForLabel('Editing App.js')).toBe('computer');
    expect(kindForLabel('Running the test suite')).toBe('computer');
    expect(kindForLabel('Pushing the commit to GitHub')).toBe('computer');
    expect(kindForLabel('Creating report.pdf')).toBe('computer');
  });

  test('maps search / web / reading work to searching', () => {
    expect(kindForLabel('Searching the web')).toBe('searching');
    expect(kindForLabel('Reading the page')).toBe('searching');
    expect(kindForLabel('Opening github.com')).toBe('searching');
    expect(kindForLabel('Checking gate output')).toBe('searching');
  });

  test('maps plan-building labels to planning, even with task words inside', () => {
    expect(kindForLabel('Planning execution steps for "Edit the search page"')).toBe('planning');
    expect(kindForLabel('Breaking the goal into projects')).toBe('planning');
    expect(kindForLabel('Understanding the goal')).toBe('planning');
  });

  test('unknown labels fall back to thinking; every kind is a declared kind', () => {
    expect(kindForLabel('Pondering the options')).toBe('thinking');
    expect(kindForLabel(null)).toBe('thinking');
    for (const label of ['Editing x', 'Searching y', 'Planning z', 'zzz']) {
      expect(ACTIVITY_KINDS).toContain(kindForLabel(label));
    }
  });
});

describe('formatBrowsingStepLabel', () => {
  test('maps raw browser steps to friendly short labels', () => {
    expect(formatBrowsingStepLabel({ action: { action: 'navigate', url: 'https://www.github.com/x' } }))
      .toBe('Opening github.com');
    expect(formatBrowsingStepLabel({ action: { action: 'extractPageText' } })).toBe('Reading the page');
    expect(formatBrowsingStepLabel({ action: { action: 'click' } })).toBe('Clicking');
  });

  test('unknown / malformed steps fall back to Browsing', () => {
    expect(formatBrowsingStepLabel(null)).toBe('Browsing');
    expect(formatBrowsingStepLabel({ action: { action: 'teleport' } })).toBe('Browsing');
    expect(formatBrowsingStepLabel({ action: { action: 'navigate', url: 'not a url' } })).toBe('Opening page');
  });
});

describe('deriveActivity', () => {
  const sending = { isSending: true };

  test('not sending is idle with no label', () => {
    expect(deriveActivity({})).toEqual({ kind: 'idle', label: null });
    expect(deriveActivity({ isSending: false, planSteps: ['Editing App.js'] }))
      .toEqual({ kind: 'idle', label: null });
  });

  test('just sent, nothing specific yet -> thinking', () => {
    expect(deriveActivity(sending)).toEqual({ kind: 'thinking', label: 'Thinking' });
    expect(deriveActivity(null)).toEqual({ kind: 'idle', label: null });
  });

  test('plan step label wins over everything and keeps its exact action', () => {
    const out = deriveActivity({
      ...sending,
      planSteps: ['Editing App.js'],
      planProgress: 'Planning tasks…',
      browsingSteps: [{ action: { action: 'click' } }],
      streamingText: 'partial reply',
      streamingThinking: 'hmm',
    });
    expect(out).toEqual({ kind: 'computer', label: 'Editing App.js' });
  });

  test('plan step objects (failure path) read their description', () => {
    const out = deriveActivity({
      ...sending,
      planSteps: [{ description: 'Running the test suite', status: 'failed' }],
    });
    expect(out).toEqual({ kind: 'computer', label: 'Running the test suite' });
  });

  test('retry-prefixed plan steps keep the prefix and the action', () => {
    const out = deriveActivity({ ...sending, planSteps: ['Retrying: Editing App.js'] });
    expect(out.label).toBe('Retrying: Editing App.js');
    expect(out.kind).toBe('computer');
  });

  test('plan progress stage text beats browsing and streaming states', () => {
    const out = deriveActivity({
      ...sending,
      planProgress: 'Breaking the goal into projects…',
      browsingSteps: [{ action: { action: 'click' } }],
      streamingText: 'partial reply',
    });
    expect(out).toEqual({ kind: 'planning', label: 'Breaking the goal into projects' });
  });

  test('structured {stage,message} progress uses the stage kind', () => {
    expect(deriveActivity({ ...sending, planProgress: { stage: 'searching', message: 'Searching: best plush toys' } }))
      .toEqual({ kind: 'searching', label: 'Searching: best plush toys' });
    expect(deriveActivity({ ...sending, planProgress: { stage: 'writing', message: 'Writing the report…' } }))
      .toEqual({ kind: 'writing', label: 'Writing the report' });
    expect(deriveActivity({ ...sending, planProgress: { stage: 'reading', message: 'Reading: https://example.com/a' } }).kind)
      .toBe('searching');
  });

  test('long plan labels are shortened to the status slot', () => {
    const out = deriveActivity({
      ...sending,
      planSteps: ['Checking the gate output for the release build before pushing anything'],
    });
    expect(out.label.length).toBeLessThanOrEqual(DEFAULT_STATUS_MAX_LEN);
    expect(out.label.startsWith('Checking')).toBe(true);
  });

  test('browsing step beats streaming states', () => {
    const out = deriveActivity({
      ...sending,
      browsingSteps: [{ action: { action: 'navigate', url: 'https://example.com/x' } }],
      streamingText: 'partial reply',
      streamingThinking: 'hmm',
    });
    expect(out).toEqual({ kind: 'searching', label: 'Opening example.com' });
  });

  test('streaming text alone is writing; streaming thinking alone is thinking', () => {
    expect(deriveActivity({ ...sending, streamingText: 'The answer so far' }))
      .toEqual({ kind: 'writing', label: 'Writing' });
    expect(deriveActivity({ ...sending, streamingThinking: 'reasoning…' }))
      .toEqual({ kind: 'thinking', label: 'Thinking' });
  });

  test('malformed signal collections do not throw', () => {
    expect(deriveActivity({ ...sending, planSteps: 'nope', browsingSteps: 42, planProgress: 7 }))
      .toEqual({ kind: 'thinking', label: 'Thinking' });
    expect(deriveActivity({ ...sending, planSteps: [null, '', {}] }))
      .toEqual({ kind: 'thinking', label: 'Thinking' });
  });
});
