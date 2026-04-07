import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';

import {
  runThink,
  createThinkContext,
} from '../fixtures/think.js';

import {
  createGitRepo,
  runGit,
} from '../fixtures/git.js';

import {
  assertChronologicalOrder,
  assertContains,
  assertFailure,
  assertNotContains,
  assertOccurrences,
  assertSuccess,
  combinedOutput,
  parseJsonLines,
} from '../support/assertions.js';

test('think --recent --count limits output to the newest N raw captures', async () => {
  const context = await createThinkContext();
  const entries = [
    'alpha capture',
    'beta capture',
    'gamma capture',
  ];

  for (const entry of entries) {
    assertSuccess(runThink(context, [entry]), `Expected capture to succeed for entry: ${entry}`);
  }

  const recent = runThink(context, ['--recent', '--count=2']);

  assertSuccess(recent, 'Expected filtered recent to succeed.');
  assertChronologicalOrder(
    combinedOutput(recent),
    ['gamma capture', 'beta capture'],
    'Expected count-limited recent output to remain newest-first.'
  );
  assertNotContains(
    recent,
    'alpha capture',
    'Expected --count to omit older entries beyond the requested limit.'
  );
});

test('think --recent --query filters raw captures by case-insensitive text match', async () => {
  const context = await createThinkContext();
  const matchingOld = 'warp replay needs better receipts';
  const nonMatch = 'turkey burritos remain underrated';
  const matchingNew = 'Warp graph should stay local-first';

  captureWithEntryId(context, matchingOld);
  captureWithEntryId(context, nonMatch);
  captureWithEntryId(context, matchingNew);

  const recent = runThink(context, ['--recent', '--query=warp']);

  assertSuccess(recent, 'Expected query-filtered recent to succeed.');
  assertChronologicalOrder(
    combinedOutput(recent),
    [matchingNew, matchingOld],
    'Expected query-filtered recent output to remain newest-first among matches.'
  );
  assertContains(recent, matchingNew, 'Expected recent query filtering to keep matching entries.');
  assertContains(recent, matchingOld, 'Expected recent query filtering to keep matching entries.');
  assertNotContains(
    recent,
    nonMatch,
    'Expected recent query filtering to exclude non-matching entries.'
  );
});

test('removed recent alias flags fail clearly and point to the scoped forms', async () => {
  const context = await createThinkContext();
  captureWithEntryId(context, 'warp replay needs better receipts');

  const countAlias = runThink(context, ['--recent', '--recent-count=2']);
  assertFailure(countAlias, 'Expected removed --recent-count alias to fail loudly.');
  assertContains(
    countAlias,
    'Use --count instead of --recent-count',
    'Expected removed --recent-count alias to point at the supported --count form.'
  );

  const queryAlias = runThink(context, ['--recent', '--recent-query=warp']);
  assertFailure(queryAlias, 'Expected removed --recent-query alias to fail loudly.');
  assertContains(
    queryAlias,
    'Use --query instead of --recent-query',
    'Expected removed --recent-query alias to point at the supported --query form.'
  );
});

test('think --json --recent applies count and query filters while remaining JSONL-only', async () => {
  const context = await createThinkContext();
  const matchingOld = 'warp replay needs better receipts';
  const nonMatch = 'turkey burritos remain underrated';
  const matchingNew = 'Warp graph should stay local-first';
  const { entryId: matchingOldId } = captureWithEntryId(context, matchingOld);
  captureWithEntryId(context, nonMatch);
  const { entryId: matchingNewId } = captureWithEntryId(context, matchingNew);

  const recent = runThink(context, ['--json', '--recent', '--query=warp', '--count=2']);

  assertSuccess(recent, 'Expected JSON filtered recent to succeed.');
  assertJsonStreams(recent);
  assert.equal((recent.stderr || '').trim(), '', 'Expected successful JSON recent to keep stderr quiet.');

  const events = parseJsonLines(
    recent.stdout,
    'Expected filtered JSON recent output to emit valid JSONL.'
  );

  assert.deepEqual(
    events.map((event) => event.event),
    [
      'cli.start',
      'recent.start',
      'recent.done',
      'recent.entry',
      'recent.entry',
      'cli.success',
    ],
    'Expected JSON recent to emit the filtered entry rows plus the usual recent command envelope rows.'
  );

  const entryEvents = events.filter((event) => event.event === 'recent.entry');
  assert.deepEqual(
    entryEvents.map((event) => event.entryId),
    [matchingNewId, matchingOldId],
    'Expected JSON recent to preserve newest-first order among filtered matches.'
  );
  assert.deepEqual(
    entryEvents.map((event) => event.text),
    [matchingNew, matchingOld],
    'Expected JSON recent to emit only matching entry text.'
  );
});

test('think --remember uses the current project context to recall relevant prior thoughts', async () => {
  const context = await createThinkContext();
  const alphaRepoDir = await createProjectRepo('alpha-project');
  const betaRepoDir = await createProjectRepo('beta-project');
  const alphaThought = 'Need to tighten the handoff note format before the next session.';
  const betaThought = 'The cache invalidation story is still too hand-wavy.';

  captureWithEntryId(context, alphaThought, {}, { cwd: alphaRepoDir });
  captureWithEntryId(context, betaThought, {}, { cwd: betaRepoDir });

  const remember = runThink(context, ['--remember'], {}, { cwd: alphaRepoDir });

  assertSuccess(remember, 'Expected ambient remember to succeed from a project working directory.');
  assertContains(remember, 'Remember', 'Expected remember mode to identify itself explicitly.');
  assertContains(remember, 'Scope: current project', 'Expected ambient remember to state that it is using project scope.');
  assertContains(remember, alphaThought, 'Expected ambient remember to surface prior thoughts from the current project.');
  assertContains(remember, 'Why:', 'Expected ambient remember to expose an explicit retrieval receipt.');
  assertContains(
    remember,
    'matched current git remote',
    'Expected ambient remember to explain project-scoped recall through ambient project receipts.'
  );
  assertNotContains(
    remember,
    betaThought,
    'Expected ambient remember not to surface unrelated thoughts from a different project context.'
  );
});

test('think --remember with an explicit phrase recalls matching thoughts without turning into generic recent listing', async () => {
  const context = await createThinkContext();
  const matchingOld = 'warp receipts need better explainability in inspect mode';
  const nonMatch = 'turkey burritos remain underrated';
  const matchingNew = 'Warp browse should stay local-first even when remember exists';

  captureWithEntryId(context, matchingOld);
  captureWithEntryId(context, nonMatch);
  captureWithEntryId(context, matchingNew);

  const remember = runThink(context, ['--remember', 'warp receipts']);

  assertSuccess(remember, 'Expected explicit remember query to succeed.');
  assertContains(remember, 'Scope: query', 'Expected explicit remember to identify query-based scope.');
  assertChronologicalOrder(
    combinedOutput(remember),
    [matchingNew, matchingOld],
    'Expected explicit remember to preserve deterministic newest-first order among the matching recall set.'
  );
  assertContains(remember, matchingNew, 'Expected explicit remember to include the newer matching thought.');
  assertContains(remember, matchingOld, 'Expected explicit remember to include the older matching thought.');
  assertNotContains(
    remember,
    nonMatch,
    'Expected explicit remember not to degrade into plain recent listing for unrelated thoughts.'
  );
});

test('think --json --remember emits explicit ambient scope and match receipts for agents', async () => {
  const context = await createThinkContext();
  const alphaRepoDir = await createProjectRepo('alpha-project');
  const betaRepoDir = await createProjectRepo('beta-project');
  const alphaThought = 'Need to tighten the handoff note format before the next session.';
  const betaThought = 'The cache invalidation story is still too hand-wavy.';

  const { entryId: alphaEntryId } = captureWithEntryId(context, alphaThought, {}, { cwd: alphaRepoDir });
  captureWithEntryId(context, betaThought, {}, { cwd: betaRepoDir });

  const remember = runThink(context, ['--json', '--remember'], {}, { cwd: alphaRepoDir });

  assertSuccess(remember, 'Expected JSON ambient remember to succeed.');
  assertJsonStreams(remember);
  assert.equal((remember.stderr || '').trim(), '', 'Expected successful JSON remember to keep stderr quiet.');

  const events = parseJsonLines(
    remember.stdout,
    'Expected JSON remember output to emit valid JSONL.'
  );

  const scope = getEvent(
    events,
    'remember.scope',
    'Expected JSON remember to expose an explicit scope row.'
  );
  assert.equal(scope.scopeKind, 'ambient_project', 'Expected ambient remember to identify the current project scope explicitly.');
  assert.equal(typeof scope.cwd, 'string', 'Expected ambient remember scope to expose cwd.');
  assert.equal(typeof scope.gitRoot, 'string', 'Expected ambient remember scope to expose git root.');
  assert.equal(typeof scope.gitRemote, 'string', 'Expected ambient remember scope to expose git remote when available.');

  const matches = events.filter((event) => event.event === 'remember.match');
  assert.ok(matches.length > 0, 'Expected JSON remember to expose at least one explicit match row.');
  assert.equal(matches[0].entryId, alphaEntryId, 'Expected the current-project thought to rank first in ambient remember.');
  assert.equal(matches[0].text, alphaThought, 'Expected ambient remember to preserve exact raw text in the match row.');
  assert.ok(Array.isArray(matches[0].matchKinds), 'Expected remember match rows to expose explicit match kinds.');
  assert.equal(typeof matches[0].score, 'number', 'Expected remember match rows to expose deterministic scores.');
});

test('think --remember falls back honestly to textual project-token matching for entries without ambient project receipts', async () => {
  const context = await createThinkContext();
  const widgetRepoDir = await createProjectRepo('widget-app');
  const fallbackThought = 'widget-app needs better receipts in inspect mode';
  const nonMatch = 'git-warp timelines still need calmer metadata';

  captureWithEntryId(context, fallbackThought);
  captureWithEntryId(context, nonMatch);

  const remember = runThink(context, ['--remember'], {}, { cwd: widgetRepoDir });

  assertSuccess(remember, 'Expected ambient remember to stay useful even when older entries lack project receipts.');
  assertContains(remember, fallbackThought, 'Expected ambient remember to recover older relevant thoughts through textual fallback.');
  assertContains(
    remember,
    'Why: fallback textual match',
    'Expected ambient remember to stay honest when it is relying on textual fallback instead of stored project receipts.'
  );
  assertNotContains(
    remember,
    nonMatch,
    'Expected ambient remember not to surface unrelated archive entries just because project receipts are missing.'
  );
});

test('think --remember --limit returns only the top N matching thoughts in deterministic order', async () => {
  const context = await createThinkContext();
  const matchingOld = 'warp receipts need better explainability in inspect mode';
  const matchingMiddle = 'warp receipts should stay explicit even in brief recall';
  const matchingNew = 'warp receipts are still the right boundary for honest remember';
  const nonMatch = 'turkey burritos remain underrated';

  captureWithEntryId(context, matchingOld);
  captureWithEntryId(context, nonMatch);
  captureWithEntryId(context, matchingMiddle);
  captureWithEntryId(context, matchingNew);

  const remember = runThink(context, ['--remember', '--limit=2', 'warp receipts']);

  assertSuccess(remember, 'Expected remember --limit to succeed.');
  assertContains(remember, 'Scope: query', 'Expected limited remember to preserve explicit query scope.');
  assertChronologicalOrder(
    combinedOutput(remember),
    [matchingNew, matchingMiddle],
    'Expected remember --limit to preserve deterministic newest-first order among the bounded matches.'
  );
  assertContains(remember, matchingNew, 'Expected remember --limit to keep the top-ranked newer match.');
  assertContains(remember, matchingMiddle, 'Expected remember --limit to keep the second-ranked match.');
  assertNotContains(
    remember,
    matchingOld,
    'Expected remember --limit to omit older matching thoughts beyond the requested result cap.'
  );
  assertNotContains(
    remember,
    nonMatch,
    'Expected remember --limit not to degrade into generic recent listing.'
  );
});

test('think --remember --brief returns a triage-friendly snippet instead of the full multiline thought', async () => {
  const context = await createThinkContext();
  const firstLine = 'bijou receipts should be triaged before we read the whole archive';
  const hiddenLine = 'this follow-up detail should stay out of brief remember output';
  const fullThought = `${firstLine}\n${hiddenLine}`;
  const otherThought = 'bijou graph reads should stay local-first and explicit';

  captureWithEntryId(context, fullThought);
  captureWithEntryId(context, otherThought);

  const remember = runThink(context, ['--remember', '--brief', '--limit=1', 'triaged before']);

  assertSuccess(remember, 'Expected remember --brief to succeed.');
  assertContains(remember, 'Remember', 'Expected brief remember to identify itself explicitly.');
  assertContains(remember, firstLine, 'Expected brief remember to keep a useful first-line snippet.');
  assertNotContains(
    remember,
    hiddenLine,
    'Expected brief remember not to dump the full multiline thought body.'
  );
  assertContains(remember, 'Why:', 'Expected brief remember to preserve explicit receipts.');
});

test('think --json --remember --brief --limit preserves bounded explicit recall receipts for agents', async () => {
  const context = await createThinkContext();
  const firstLine = 'warp receipts should be easy to triage before deep inspection';
  const hiddenLine = 'this second line should not appear in brief json remember output';
  const fullThought = `${firstLine}\n${hiddenLine}`;
  const olderMatch = 'warp receipts still need calmer metadata';
  const nonMatch = 'turkey burritos remain underrated';

  captureWithEntryId(context, fullThought);
  captureWithEntryId(context, nonMatch);
  const { entryId: newestMatchingEntryId } = captureWithEntryId(context, olderMatch);

  const remember = runThink(context, ['--json', '--remember', '--brief', '--limit=1', 'warp receipts']);

  assertSuccess(remember, 'Expected JSON remember --brief --limit to succeed.');
  assertJsonStreams(remember);
  assert.equal((remember.stderr || '').trim(), '', 'Expected successful JSON remember brief mode to keep stderr quiet.');
  assert.doesNotMatch(
    remember.stdout,
    new RegExp(hiddenLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `Expected JSON brief remember not to include the full multiline body.\nstdout:\n${remember.stdout}`
  );

  const events = parseJsonLines(
    remember.stdout,
    'Expected JSON brief remember output to emit valid JSONL.'
  );

  const scope = getEvent(
    events,
    'remember.scope',
    'Expected JSON brief remember to expose an explicit scope row.'
  );
  assert.equal(scope.scopeKind, 'query', 'Expected JSON brief remember to preserve explicit query scope.');

  const matches = events.filter((event) => event.event === 'remember.match');
  assert.equal(matches.length, 1, 'Expected JSON remember --limit to cap the match rows.');
  assert.equal(matches[0].entryId, newestMatchingEntryId, 'Expected JSON brief remember to keep the top-ranked newest matching result.');
  assert.equal(matches[0].text, olderMatch, 'Expected JSON brief remember to expose only the triage snippet as text.');
  assert.equal(typeof matches[0].score, 'number', 'Expected JSON brief remember to preserve deterministic scoring.');
  assert.equal(typeof matches[0].tier, 'number', 'Expected JSON brief remember to preserve explicit match tier.');
  assert.ok(Array.isArray(matches[0].matchKinds), 'Expected JSON brief remember to preserve explicit match kinds.');
  assert.equal(typeof matches[0].reasonText, 'string', 'Expected JSON brief remember to preserve receipt text.');
});

test('think --remember rejects invalid --limit values', async () => {
  const context = await createThinkContext();
  captureWithEntryId(context, 'warp receipts should remain explicit');

  const zero = runThink(context, ['--remember', '--limit=0']);
  assertFailure(zero, 'Expected --limit=0 to fail loudly.');
  assertContains(
    zero,
    'Invalid --limit value',
    'Expected remember to reject zero as an invalid limit value.'
  );

  const negative = runThink(context, ['--remember', '--limit=-2']);
  assertFailure(negative, 'Expected negative --limit to fail loudly.');
  assertContains(
    negative,
    'Invalid --limit value',
    'Expected remember to reject negative limits.'
  );
});

test('think --browse shows one raw thought with its immediate newer and older neighbors', async () => {
  const context = await createThinkContext();
  const olderThought = 'older thought about warp receipts';
  const currentThought = 'current thought about warp replay';
  const newerThought = 'newer thought about local-first cognition';

  captureWithEntryId(context, olderThought);
  const { entryId: currentEntryId } = captureWithEntryId(context, currentThought);
  captureWithEntryId(context, newerThought);

  const browse = runThink(context, [`--browse=${currentEntryId}`]);

  assertSuccess(browse, 'Expected browse to succeed for an explicit entry.');
  assertContains(browse, 'Browse', 'Expected browse mode to identify itself explicitly.');
  assertContains(browse, 'Current:', 'Expected browse mode to label the current entry clearly.');
  assertContains(browse, currentThought, 'Expected browse mode to show the selected entry text.');
  assertContains(browse, 'Newer:', 'Expected browse mode to expose the immediate newer neighbor.');
  assertContains(browse, newerThought, 'Expected browse mode to show the immediate newer neighbor text.');
  assertContains(browse, 'Older:', 'Expected browse mode to expose the immediate older neighbor.');
  assertContains(browse, olderThought, 'Expected browse mode to show the immediate older neighbor text.');
  assertNotContains(browse, 'summary', 'Browse should not summarize the archive.');
  assertNotContains(browse, 'cluster', 'Browse should not leak clustering language.');
  assertNotContains(browse, 'question', 'Browse should not inject prompt language.');
});

test('think --browse without an entry id fails clearly outside interactive TTY use and remains read-only', async () => {
  const context = await createThinkContext();

  const browse = runThink(context, ['--browse']);

  assertFailure(browse, 'Expected bare --browse to fail outside interactive TTY use.');
  assertContains(
    browse,
    '--browse requires an entry id outside interactive TTY use',
    'Expected bare --browse to explain that the shell entry only exists in a real TTY.'
  );
  assert.ok(
    !existsSync(context.localRepoDir),
    `Expected invalid non-interactive browse start to remain read-only, but repo was created at ${context.localRepoDir}.`
  );
});

test('think --json --browse without an entry id stays machine-readable and does not try to open the shell', async () => {
  const context = await createThinkContext();

  const browse = runThink(context, ['--json', '--browse']);

  assertFailure(browse, 'Expected JSON browse without an entry id to fail loudly.');
  const stdoutEvents = parseJsonLines(
    browse.stdout,
    'Expected invalid JSON browse to keep stdout machine-readable when present.'
  );
  const stderrEvents = parseJsonLines(
    browse.stderr,
    'Expected invalid JSON browse output to remain machine-readable on stderr.'
  );

  assert.deepEqual(
    stdoutEvents.map((event) => event.event),
    ['cli.start'],
    'Expected invalid JSON browse to keep only the standard start event on stdout.'
  );
  assert.deepEqual(
    stderrEvents.map((event) => event.event),
    ['cli.validation_failed', 'cli.failure'],
    'Expected invalid JSON browse to fail through the standard machine-readable validation path.'
  );
  assert.equal(
    stderrEvents[0].message,
    '--browse requires an entry id outside interactive TTY use',
    'Expected invalid JSON browse to expose the shell-aware validation message.'
  );
});

test('think --json --browse emits JSONL rows for the current raw thought and its neighbors', async () => {
  const context = await createThinkContext();
  const olderThought = 'older thought about warp receipts';
  const currentThought = 'current thought about warp replay';
  const newerThought = 'newer thought about local-first cognition';

  const { entryId: olderEntryId } = captureWithEntryId(context, olderThought);
  const { entryId: currentEntryId } = captureWithEntryId(context, currentThought);
  const { entryId: newerEntryId } = captureWithEntryId(context, newerThought);

  const browse = runThink(context, ['--json', `--browse=${currentEntryId}`]);

  assertSuccess(browse, 'Expected JSON browse to succeed.');
  assertJsonStreams(browse);
  assert.equal((browse.stderr || '').trim(), '', 'Expected successful JSON browse to keep stderr quiet.');

  const events = parseJsonLines(
    browse.stdout,
    'Expected JSON browse output to emit valid JSONL.'
  );

  assert.deepEqual(
    events.slice(0, 3).map((event) => event.event),
    ['cli.start', 'browse.start', 'browse.done'],
    'Expected JSON browse to preserve the standard command envelope before browse payload rows.'
  );
  assert.equal(
    events.at(-1)?.event,
    'cli.success',
    'Expected JSON browse to preserve the standard command envelope after browse payload rows.'
  );

  const browseEvents = events.filter((event) => event.event === 'browse.entry');
  assert.deepEqual(
    browseEvents.map((event) => event.role),
    ['current', 'newer', 'older'],
    'Expected JSON browse rows to label each entry role explicitly.'
  );
  assert.deepEqual(
    browseEvents.map((event) => event.entryId),
    [currentEntryId, newerEntryId, olderEntryId],
    'Expected JSON browse rows to expose the selected entry and both immediate neighbors.'
  );
  assert.deepEqual(
    browseEvents.map((event) => event.text),
    [currentThought, newerThought, olderThought],
    'Expected JSON browse rows to preserve exact raw text for the selected entry and both neighbors.'
  );
});

test('think --browse opens a reader-first browse TUI with metadata and no permanent recent rail', async () => {
  const context = await createThinkContext();
  const olderThought = 'older thought about warp receipts';
  const currentThought = 'current thought about warp replay';
  const newerThought = 'newer thought about local-first cognition';

  captureWithEntryId(context, olderThought);
  const { entryId: currentEntryId } = captureWithEntryId(context, currentThought);
  captureWithEntryId(context, newerThought);

  const browse = runThink(
    context,
    ['--browse'],
    {
      THINK_TEST_INTERACTIVE: '1',
      THINK_TEST_BROWSE_SCRIPT: JSON.stringify({
        seedEntryId: currentEntryId,
        actions: ['quit'],
      }),
    }
  );

  assertSuccess(browse, 'Expected scripted browse TUI to succeed.');
  assertContains(browse, 'THINK BROWSE', 'Expected bare --browse to open a real browse screen.');
  assertContains(browse, currentThought, 'Expected the shell to show the selected current thought.');
  assertContains(browse, 'When:', 'Expected browse to surface timestamp metadata without requiring inspect mode.');
  assertContains(browse, 'Entry ID:', 'Expected browse to surface raw entry identity without requiring inspect mode.');
  assertNotContains(browse, 'RECENT', 'Expected browse not to devote a permanent rail to the full recent archive.');
  assertNotContains(browse, 'Choose a thought to browse', 'Expected the browse TUI not to fall back to prompt-picker UX.');

  const recent = runThink(context, ['--recent']);
  assertSuccess(recent, 'Expected browse shell usage to remain read-only.');
  assertContains(recent, newerThought, 'Expected browse shell usage to preserve raw captures.');
  assertContains(recent, currentThought, 'Expected browse shell usage to preserve raw captures.');
  assertContains(recent, olderThought, 'Expected browse shell usage to preserve raw captures.');
});

test('think --browse can reveal a chronology drawer on demand instead of showing the full log by default', async () => {
  const context = await createThinkContext();
  const olderThought = 'older thought about warp receipts';
  const currentThought = 'current thought about warp replay';
  const newerThought = 'newer thought about local-first cognition';

  captureWithEntryId(context, olderThought);
  const { entryId: currentEntryId } = captureWithEntryId(context, currentThought);
  captureWithEntryId(context, newerThought);

  const browse = runThink(
    context,
    ['--browse'],
    {
      THINK_TEST_INTERACTIVE: '1',
      THINK_TEST_BROWSE_SCRIPT: JSON.stringify({
        seedEntryId: currentEntryId,
        actions: ['log', 'quit'],
      }),
    }
  );

  assertSuccess(browse, 'Expected scripted browse TUI log drawer flow to succeed.');
  assertContains(browse, 'THOUGHT LOG', 'Expected browse to reveal a chronology drawer only when requested.');
  assertContains(browse, olderThought, 'Expected the chronology drawer to expose older thoughts.');
  assertContains(browse, newerThought, 'Expected the chronology drawer to expose newer thoughts.');
});

test('think --browse can jump to another thought through a fuzzy jump surface', async () => {
  const context = await createThinkContext();
  const olderThought = 'older thought about warp receipts';
  const currentThought = 'current thought about warp replay';
  const newerThought = 'newer thought about local-first cognition';

  captureWithEntryId(context, olderThought);
  const { entryId: currentEntryId } = captureWithEntryId(context, currentThought);
  const { entryId: newerEntryId } = captureWithEntryId(context, newerThought);

  const browse = runThink(
    context,
    ['--browse'],
    {
      THINK_TEST_INTERACTIVE: '1',
      THINK_TEST_BROWSE_SCRIPT: JSON.stringify({
        seedEntryId: currentEntryId,
        actions: [
          {
            type: 'jump',
            query: 'local-first',
            entryId: newerEntryId,
          },
          'quit',
        ],
      }),
    }
  );

  assertSuccess(browse, 'Expected scripted browse TUI jump flow to succeed.');
  assertContains(browse, 'JUMP', 'Expected browse to expose an explicit jump surface.');
  assertContains(browse, newerThought, 'Expected the jump surface to move focus to the selected thought.');
  assertNotContains(browse, 'RECENT', 'Expected jump to replace a permanent recent rail rather than coexist with it.');
});

test('think --browse can reveal inspect receipts inside the scripted browse TUI', async () => {
  const context = await createThinkContext();
  const seedThought = 'We should make warp graph the thought substrate';
  const reflectAnswer = 'The substrate only matters if browse can reveal the same inspect receipts honestly.';
  const { entryId: seedEntryId } = captureWithEntryId(context, seedThought);

  const start = runThink(context, ['--verbose', `--reflect=${seedEntryId}`]);
  assertSuccess(start, 'Expected reflect start to succeed before browse-shell inspect.');
  const sessionStarted = getEvent(
    parseJsonLines(start.stderr, 'Expected verbose reflect start to emit valid JSONL trace events.'),
    'reflect.session_started',
    'Expected reflect start to expose session lineage.'
  );

  const reply = runThink(context, ['--verbose', `--reflect-session=${sessionStarted.sessionId}`, reflectAnswer]);
  assertSuccess(reply, 'Expected reflect reply to succeed before browse-shell inspect.');
  const saved = getEvent(
    parseJsonLines(reply.stderr, 'Expected verbose reflect reply to emit valid JSONL trace events.'),
    'reflect.entry_saved',
    'Expected reflect reply to expose the saved derived entry.'
  );

  const browse = runThink(
    context,
    ['--browse'],
    {
      THINK_TEST_INTERACTIVE: '1',
      THINK_TEST_BROWSE_SCRIPT: JSON.stringify({
        seedEntryId,
        actions: ['inspect', 'quit'],
      }),
    }
  );

  assertSuccess(browse, 'Expected scripted browse inspect to succeed.');
  assertContains(browse, 'Thought ID:', 'Expected the browse shell inspect pane to expose canonical content identity.');
  assertContains(browse, 'RECEIPTS', 'Expected the browse shell inspect pane to expose derived receipts.');
  assertContains(browse, saved.entryId, 'Expected the browse shell inspect pane to expose the direct reflect descendant.');
});

test('think --browse can hand the selected thought into reflect from the scripted browse TUI', async () => {
  const context = await createThinkContext();
  const seedThought = 'We should make warp graph the thought substrate';
  const reflectAnswer = 'Browse should let me hand off directly into reflect without guessing ids.';
  const { entryId: seedEntryId } = captureWithEntryId(context, seedThought);

  const browse = runThink(
    context,
    ['--browse'],
    {
      THINK_TEST_INTERACTIVE: '1',
      THINK_TEST_BROWSE_SCRIPT: JSON.stringify({
        seedEntryId,
        actions: [
          {
            type: 'reflect',
            mode: 'sharpen',
            response: reflectAnswer,
          },
          'quit',
        ],
      }),
    }
  );

  assertSuccess(browse, 'Expected scripted browse reflect handoff to succeed.');
  assertContains(browse, 'THINK BROWSE', 'Expected reflect to stay inside the browse shell.');
  assertContains(browse, 'REFLECT', 'Expected the shell to expose an in-shell reflect surface explicitly.');
  assertContains(browse, 'Reflect saved', 'Expected the shell reflect handoff to save a derived reflect entry.');
  assertContains(
    browse,
    seedThought,
    'Expected the current thought to remain visible again after the in-shell reflect flow finishes.'
  );
  assertNotContains(
    browse,
    'Your response',
    'Expected browse-initiated reflect not to drop back to the plain CLI prompt UI.'
  );

  const inspect = runThink(context, [`--inspect=${seedEntryId}`]);
  assertSuccess(inspect, 'Expected inspect to succeed after browse-shell reflect handoff.');
  assertContains(inspect, 'Derived receipts:', 'Expected reflect handoff to create inspectable derived receipts.');
  assertContains(inspect, 'Reflect:', 'Expected the reflect handoff to appear as a derived receipt on the seed thought.');
});

test('think --browse surfaces session identity for the current thought without replacing the reader-first view', async () => {
  const context = await createThinkContext();
  const base = Date.UTC(2026, 2, 25, 10, 0, 0);

  captureWithEntryId(context, 'session one older thought', { THINK_TEST_NOW: String(base) });
  captureWithEntryId(context, 'session one middle thought', { THINK_TEST_NOW: String(base + 60_000) });
  const { entryId: currentEntryId } = captureWithEntryId(
    context,
    'session one boundary thought',
    { THINK_TEST_NOW: String(base + 120_000) }
  );
  captureWithEntryId(context, 'session two newer thought', { THINK_TEST_NOW: String(base + 600_000) });

  const browse = runThink(
    context,
    ['--browse'],
    {
      THINK_TEST_INTERACTIVE: '1',
      THINK_TEST_BROWSE_SCRIPT: JSON.stringify({
        seedEntryId: currentEntryId,
        actions: ['quit'],
      }),
    }
  );

  assertSuccess(browse, 'Expected scripted browse TUI to succeed for session-context browse.');
  assertContains(browse, 'Session:', 'Expected browse metadata to expose the current thought session identity.');
  assertContains(
    browse,
    'session:',
    'Expected browse metadata to expose an explicit session id rather than vague context language.'
  );
  assertContains(
    browse,
    'session one boundary thought',
    'Expected the reader-first browse view to keep the current thought visually primary.'
  );
});

test('think --browse uses a short visible entry id in the reader-first metadata while inspect keeps the full exact id', async () => {
  const context = await createThinkContext();
  const olderThought = 'older thought about calmer browse metadata';
  const currentThought = 'current thought about short visible ids in browse';
  const newerThought = 'newer thought about inspect keeping exact ids';

  captureWithEntryId(context, olderThought);
  const { entryId: currentEntryId } = captureWithEntryId(context, currentThought);
  captureWithEntryId(context, newerThought);

  const browse = runThink(
    context,
    ['--browse'],
    {
      THINK_TEST_INTERACTIVE: '1',
      THINK_TEST_BROWSE_SCRIPT: JSON.stringify({
        seedEntryId: currentEntryId,
        actions: ['quit'],
      }),
    }
  );

  assertSuccess(browse, 'Expected browse to succeed for short-id presentation playback.');
  const frame = finalFrame(browse);
  const shortEntryId = shortVisibleId(currentEntryId);

  assertContains(
    { ...browse, stdout: frame, stderr: '' },
    `Entry ID: ${shortEntryId}`,
    'Expected browse metadata to shorten the visible entry id instead of always showing the full exact id.'
  );
  assertNotContains(
    { ...browse, stdout: frame, stderr: '' },
    `Entry ID: ${currentEntryId}`,
    'Expected browse metadata not to default to the full exact entry id once short visible ids are implemented.'
  );

  const inspect = runThink(context, [`--inspect=${currentEntryId}`]);
  assertSuccess(inspect, 'Expected standalone inspect to keep working after browse short-id presentation.');
  assertContains(
    inspect,
    `Entry ID: ${currentEntryId}`,
    'Expected inspect to preserve the full exact entry id even when browse uses a shortened visible form.'
  );
});

test('think --browse can reveal a summon-only session drawer that excludes out-of-session thoughts', async () => {
  const context = await createThinkContext();
  const base = Date.UTC(2026, 2, 25, 10, 0, 0);

  const { entryId: olderEntryId } = captureWithEntryId(
    context,
    'session one older thought',
    { THINK_TEST_NOW: String(base) }
  );
  const { entryId: currentEntryId } = captureWithEntryId(
    context,
    'session one current thought',
    { THINK_TEST_NOW: String(base + 60_000) }
  );
  const { entryId: sameSessionNewerId } = captureWithEntryId(
    context,
    'session one newer thought',
    { THINK_TEST_NOW: String(base + 120_000) }
  );
  captureWithEntryId(context, 'session two newer thought', { THINK_TEST_NOW: String(base + 600_000) });

  const browse = runThink(
    context,
    ['--browse'],
    {
      THINK_TEST_INTERACTIVE: '1',
      THINK_TEST_BROWSE_SCRIPT: JSON.stringify({
        seedEntryId: currentEntryId,
        actions: ['session', 'quit'],
      }),
    }
  );

  assertSuccess(browse, 'Expected scripted browse session drawer flow to succeed.');
  assertContains(browse, 'SESSION', 'Expected browse to expose a dedicated session drawer on demand.');
  assertContains(
    browse,
    shortVisibleId(olderEntryId),
    'Expected the session drawer to expose older entries in the same session using the shortened visible id.'
  );
  assertContains(
    browse,
    shortVisibleId(sameSessionNewerId),
    'Expected the session drawer to expose newer entries in the same session using the shortened visible id.'
  );
  assertNotContains(
    browse,
    'session two newer thought',
    'Expected the session drawer to exclude thoughts from different sessions.'
  );
});

test('think --browse reveals a structured session drawer with a visible start label and current-thought marker', async () => {
  const context = await createThinkContext();
  const base = Date.UTC(2026, 2, 25, 10, 0, 0);

  const { entryId: olderEntryId } = captureWithEntryId(
    context,
    'session one older thought',
    { THINK_TEST_NOW: String(base) }
  );
  const { entryId: currentEntryId } = captureWithEntryId(
    context,
    'session one current thought',
    { THINK_TEST_NOW: String(base + 60_000) }
  );
  const { entryId: newerEntryId } = captureWithEntryId(
    context,
    'session one newer thought',
    { THINK_TEST_NOW: String(base + 120_000) }
  );
  captureWithEntryId(context, 'session two newer thought', { THINK_TEST_NOW: String(base + 600_000) });

  const browse = runThink(
    context,
    ['--browse'],
    {
      THINK_TEST_INTERACTIVE: '1',
      THINK_TEST_BROWSE_SCRIPT: JSON.stringify({
        seedEntryId: currentEntryId,
        actions: ['session', 'quit'],
      }),
    }
  );

  assertSuccess(browse, 'Expected scripted browse session drawer polish flow to succeed.');
  const frame = finalFrame(browse);

  assertContains(
    { ...browse, stdout: frame, stderr: '' },
    'SESSION',
    'Expected the session drawer to remain explicitly labeled.'
  );
  assertContains(
    { ...browse, stdout: frame, stderr: '' },
    'Started:',
    'Expected the session drawer to expose a visible session start label instead of forcing the user to infer timing from flat entry rows.'
  );
  assertContains(
    { ...browse, stdout: frame, stderr: '' },
    'Current:',
    'Expected the structured session drawer to mark the current thought explicitly rather than excluding it from the session view.'
  );
  assertContains(
    { ...browse, stdout: frame, stderr: '' },
    shortVisibleId(olderEntryId),
    'Expected the structured session drawer to use shortened visible ids for same-session entries.'
  );
  assertContains(
    { ...browse, stdout: frame, stderr: '' },
    shortVisibleId(currentEntryId),
    'Expected the structured session drawer to keep the current thought visible inside the structured session view.'
  );
  assertContains(
    { ...browse, stdout: frame, stderr: '' },
    shortVisibleId(newerEntryId),
    'Expected the structured session drawer to keep newer same-session entries visible inside the structured session view.'
  );
  assertNotContains(
    { ...browse, stdout: frame, stderr: '' },
    olderEntryId,
    'Expected the structured session drawer not to default to the full exact older entry id.'
  );
  assertNotContains(
    { ...browse, stdout: frame, stderr: '' },
    currentEntryId,
    'Expected the structured session drawer not to default to the full exact current entry id.'
  );
  assertNotContains(
    { ...browse, stdout: frame, stderr: '' },
    newerEntryId,
    'Expected the structured session drawer not to default to the full exact newer entry id.'
  );
  assertNotContains(
    { ...browse, stdout: frame, stderr: '' },
    'session two newer thought',
    'Expected the structured session drawer to continue excluding out-of-session thoughts.'
  );
});

test('think --json --browse emits explicit session context and session-nearby rows without mislabeling out-of-session thoughts', async () => {
  const context = await createThinkContext();
  const base = Date.UTC(2026, 2, 25, 10, 0, 0);

  const { entryId: olderEntryId } = captureWithEntryId(
    context,
    'session one older thought',
    { THINK_TEST_NOW: String(base) }
  );
  const { entryId: currentEntryId } = captureWithEntryId(
    context,
    'session one current thought',
    { THINK_TEST_NOW: String(base + 60_000) }
  );
  const { entryId: sameSessionNewerId } = captureWithEntryId(
    context,
    'session one newer thought',
    { THINK_TEST_NOW: String(base + 120_000) }
  );
  const { entryId: differentSessionNewerId } = captureWithEntryId(
    context,
    'session two newer thought',
    { THINK_TEST_NOW: String(base + 600_000) }
  );

  const browse = runThink(context, ['--json', `--browse=${currentEntryId}`]);

  assertSuccess(browse, 'Expected JSON browse to succeed for session-context browse.');
  assertJsonStreams(browse);
  assert.equal((browse.stderr || '').trim(), '', 'Expected successful JSON browse to keep stderr quiet.');

  const events = parseJsonLines(
    browse.stdout,
    'Expected JSON browse with session context to emit valid JSONL.'
  );

  const contextRow = getEvent(
    events,
    'browse.context',
    'Expected JSON browse to emit an explicit session-context row.'
  );
  assert.equal(contextRow.entryId, currentEntryId, 'Expected browse context to preserve the selected capture entry id.');
  assert.match(contextRow.sessionId, /^session:/, 'Expected browse context to expose an explicit session id.');
  assert.equal(typeof contextRow.reasonKind, 'string', 'Expected browse context to expose reason kind.');
  assert.equal(typeof contextRow.reasonText, 'string', 'Expected browse context to expose reason text.');

  const sessionEntries = events.filter((event) => event.event === 'browse.session_entry');
  assert.deepEqual(
    sessionEntries.map((event) => event.entryId),
    [sameSessionNewerId, olderEntryId],
    'Expected JSON browse to expose only same-session neighbors in newest-first session order.'
  );
  assert.ok(
    sessionEntries.every((event) => event.sessionId === contextRow.sessionId),
    'Expected every session-nearby row to preserve the same explicit session id.'
  );
  assert.ok(
    sessionEntries.every((event) => event.entryId !== differentSessionNewerId),
    'Expected JSON browse not to mislabel out-of-session thoughts as session-nearby.'
  );
});

test('think --browse can move to the previous thought within the current session without leaving reader-first browse', async () => {
  const context = await createThinkContext();
  const base = Date.UTC(2026, 2, 25, 10, 0, 0);

  const { entryId: sessionOlderEntryId } = captureWithEntryId(
    context,
    'session one older thought',
    { THINK_TEST_NOW: String(base) }
  );
  const { entryId: sessionCurrentEntryId } = captureWithEntryId(
    context,
    'session one current thought',
    { THINK_TEST_NOW: String(base + 60_000) }
  );
  captureWithEntryId(context, 'session two newer thought', { THINK_TEST_NOW: String(base + 600_000) });

  const browse = runThink(
    context,
    ['--browse'],
    {
      THINK_TEST_INTERACTIVE: '1',
      THINK_TEST_BROWSE_SCRIPT: JSON.stringify({
        seedEntryId: sessionCurrentEntryId,
        actions: [
          { type: 'session_move', direction: 'previous' },
          'quit',
        ],
      }),
    }
  );

  assertSuccess(browse, 'Expected scripted browse session traversal to succeed.');
  const frame = finalFrame(browse);
  assertContains(
    { ...browse, stdout: frame, stderr: '' },
    'session one older thought',
    'Expected session traversal to move to the previous thought in the same session.'
  );
  assertContains(
    { ...browse, stdout: frame, stderr: '' },
    `Entry ID: ${shortVisibleId(sessionOlderEntryId)}`,
    'Expected the browse shell to land on the previous same-session capture rather than a chronological neighbor from another session, using the shortened visible id in browse.'
  );
  assertContains(
    { ...browse, stdout: frame, stderr: '' },
    'Session Position: 1 of 2',
    'Expected browse metadata to expose the current position within the session.'
  );
});

test('think --browse keeps the current thought in place when there is no next thought in the current session', async () => {
  const context = await createThinkContext();
  const base = Date.UTC(2026, 2, 25, 10, 0, 0);

  captureWithEntryId(context, 'session one older thought', { THINK_TEST_NOW: String(base) });
  const { entryId: sessionCurrentEntryId } = captureWithEntryId(
    context,
    'session one current thought',
    { THINK_TEST_NOW: String(base + 60_000) }
  );
  captureWithEntryId(context, 'session two newer thought', { THINK_TEST_NOW: String(base + 600_000) });

  const browse = runThink(
    context,
    ['--browse'],
    {
      THINK_TEST_INTERACTIVE: '1',
      THINK_TEST_BROWSE_SCRIPT: JSON.stringify({
        seedEntryId: sessionCurrentEntryId,
        actions: [
          { type: 'session_move', direction: 'next' },
          'quit',
        ],
      }),
    }
  );

  assertSuccess(browse, 'Expected scripted browse boundary traversal to stay in-shell and succeed.');
  const frame = finalFrame(browse);
  assertContains(
    { ...browse, stdout: frame, stderr: '' },
    `Entry ID: ${shortVisibleId(sessionCurrentEntryId)}`,
    'Expected boundary session traversal to keep the current thought selected when there is no next same-session thought, using the shortened visible id in browse.'
  );
  assertContains(
    { ...browse, stdout: frame, stderr: '' },
    'No next thought in this session.',
    'Expected browse to explain why session traversal did not move.'
  );
});

test('think --json --browse exposes explicit session traversal semantics without conflating them with chronology neighbors', async () => {
  const context = await createThinkContext();
  const base = Date.UTC(2026, 2, 25, 10, 0, 0);

  const { entryId: sessionOlderEntryId } = captureWithEntryId(
    context,
    'session one older thought',
    { THINK_TEST_NOW: String(base) }
  );
  const { entryId: sessionCurrentEntryId } = captureWithEntryId(
    context,
    'session one current thought',
    { THINK_TEST_NOW: String(base + 60_000) }
  );
  const { entryId: differentSessionNewerId } = captureWithEntryId(
    context,
    'session two newer thought',
    { THINK_TEST_NOW: String(base + 600_000) }
  );

  const browse = runThink(context, ['--json', `--browse=${sessionCurrentEntryId}`]);

  assertSuccess(browse, 'Expected JSON browse to succeed for session traversal receipts.');
  assertJsonStreams(browse);
  assert.equal((browse.stderr || '').trim(), '', 'Expected successful JSON browse to keep stderr quiet.');

  const events = parseJsonLines(
    browse.stdout,
    'Expected JSON browse with session traversal to emit valid JSONL.'
  );

  const contextRow = getEvent(
    events,
    'browse.context',
    'Expected JSON browse to expose explicit browse context.'
  );
  assert.equal(contextRow.entryId, sessionCurrentEntryId, 'Expected browse context to preserve the selected capture entry.');
  assert.equal(contextRow.sessionPosition, 2, 'Expected browse context to expose one-based session position.');
  assert.equal(contextRow.sessionCount, 2, 'Expected browse context to expose total session size.');

  const sessionSteps = events.filter((event) => event.event === 'browse.session_step');
  assert.deepEqual(
    sessionSteps.map((event) => event.direction),
    ['previous'],
    'Expected JSON browse to expose only the available session traversal steps for the selected thought.'
  );
  assert.deepEqual(
    sessionSteps.map((event) => event.entryId),
    [sessionOlderEntryId],
    'Expected JSON browse to expose the previous same-session thought as an explicit traversal step.'
  );
  assert.ok(
    sessionSteps.every((event) => event.entryId !== differentSessionNewerId),
    'Expected JSON browse not to mislabel chronology-only neighbors as same-session traversal steps.'
  );
});

test('think --inspect exposes exact raw entry metadata without narration', async () => {
  const context = await createThinkContext();
  const thought = 'inspect should reveal the exact stored thought';
  const { entryId } = captureWithEntryId(context, thought);

  const inspect = runThink(context, [`--inspect=${entryId}`]);

  assertSuccess(inspect, 'Expected inspect to succeed for an explicit raw entry.');
  assertContains(inspect, 'Inspect', 'Expected inspect mode to identify itself explicitly.');
  assertContains(inspect, `Entry ID: ${entryId}`, 'Expected inspect to expose the entry id plainly.');
  assertContains(inspect, 'Kind: raw_capture', 'Expected inspect to identify the stored entry kind.');
  assertContains(inspect, 'Text:', 'Expected inspect to label the exact stored text explicitly.');
  assertContains(inspect, thought, 'Expected inspect to expose the exact stored raw text.');
  assertNotContains(inspect, 'summary', 'Inspect should not summarize the entry.');
  assertNotContains(inspect, 'related', 'Inspect should not inject relatedness claims.');
  assertNotContains(inspect, 'question', 'Inspect should not inject prompt language.');
});

test('think --json --inspect emits JSONL for the exact raw entry metadata', async () => {
  const context = await createThinkContext();
  const thought = 'inspect should reveal the exact stored thought';
  const { entryId } = captureWithEntryId(context, thought);

  const inspect = runThink(context, ['--json', `--inspect=${entryId}`]);

  assertSuccess(inspect, 'Expected JSON inspect to succeed.');
  assertJsonStreams(inspect);
  assert.equal((inspect.stderr || '').trim(), '', 'Expected successful JSON inspect to keep stderr quiet.');

  const events = parseJsonLines(
    inspect.stdout,
    'Expected JSON inspect output to emit valid JSONL.'
  );

  assert.equal(events[0].event, 'cli.start', 'Expected JSON inspect to start with the CLI envelope.');
  assert.equal(events[1].event, 'inspect.start', 'Expected JSON inspect to emit an inspect start row.');
  assert.equal(events[2].event, 'inspect.done', 'Expected JSON inspect to emit an inspect completion row.');
  assert.equal(events.at(-1)?.event, 'cli.success', 'Expected JSON inspect to end with a CLI success row.');

  const inspectedEntry = getEvent(
    events,
    'inspect.entry',
    'Expected JSON inspect to expose the raw entry metadata.'
  );

  assert.equal(inspectedEntry.entryId, entryId, 'Expected JSON inspect to preserve the requested entry id.');
  assert.equal(inspectedEntry.kind, 'raw_capture', 'Expected JSON inspect to identify the raw entry kind.');
  assert.equal(inspectedEntry.text, thought, 'Expected JSON inspect to preserve the exact stored raw text.');
  assert.equal(typeof inspectedEntry.sortKey, 'string', 'Expected JSON inspect to expose stable ordering metadata.');
});

test('think --inspect exposes additive capture provenance separately from the raw text', async () => {
  const context = await createThinkContext();
  const thought = 'selected text should remain exact while inspect shows provenance separately';
  const { entryId } = captureWithEntryId(context, thought, {
    THINK_CAPTURE_INGRESS: 'selected_text',
    THINK_CAPTURE_SOURCE_APP: 'Safari',
    THINK_CAPTURE_SOURCE_URL: 'https://example.com/article',
  });

  const inspect = runThink(context, [`--inspect=${entryId}`]);

  assertSuccess(inspect, 'Expected inspect to succeed for a capture with additive provenance.');
  assertContains(inspect, thought, 'Expected inspect to preserve the raw capture text exactly.');
  assertContains(inspect, 'Ingress: selected_text', 'Expected inspect to show ingress separately from the raw text.');
  assertContains(inspect, 'Source app: Safari', 'Expected inspect to show the source application separately from the raw text.');
  assertContains(inspect, 'Source URL: https://example.com/article', 'Expected inspect to show the source URL separately from the raw text.');
});

test('think --json --inspect includes additive capture provenance in the inspected entry payload', async () => {
  const context = await createThinkContext();
  const thought = 'selected text should remain exact while JSON inspect shows provenance separately';
  const { entryId } = captureWithEntryId(context, thought, {
    THINK_CAPTURE_INGRESS: 'selected_text',
    THINK_CAPTURE_SOURCE_APP: 'Safari',
    THINK_CAPTURE_SOURCE_URL: 'https://example.com/article',
  });

  const inspect = runThink(context, ['--json', `--inspect=${entryId}`]);

  assertSuccess(inspect, 'Expected JSON inspect to succeed for a capture with additive provenance.');
  assertJsonStreams(inspect);
  const events = parseJsonLines(
    inspect.stdout,
    'Expected JSON inspect provenance output to emit valid JSONL.'
  );
  const inspectedEntry = getEvent(
    events,
    'inspect.entry',
    'Expected JSON inspect provenance output to include the inspected entry payload.'
  );

  assert.deepEqual(
    inspectedEntry.captureProvenance,
    {
      ingress: 'selected_text',
      sourceApp: 'Safari',
      sourceURL: 'https://example.com/article',
    },
    'Expected JSON inspect to expose additive capture provenance separately from the raw text.'
  );
});

test('think --inspect exposes canonical content identity and direct derived receipts when they exist', async () => {
  const context = await createThinkContext();
  const seedThought = 'We should make warp graph the thought substrate';
  const reflectAnswer = 'The substrate only matters if inspect can show the raw thought and its derived descendants honestly.';
  const { entryId: seedEntryId } = captureWithEntryId(context, seedThought);

  const start = runThink(context, ['--verbose', `--reflect=${seedEntryId}`]);
  assertSuccess(start, 'Expected reflect start to succeed before inspecting derived receipts.');
  const sessionStarted = getEvent(
    parseJsonLines(start.stderr, 'Expected verbose reflect start to emit valid JSONL trace events.'),
    'reflect.session_started',
    'Expected reflect start to emit session metadata.'
  );

  const reply = runThink(context, ['--verbose', `--reflect-session=${sessionStarted.sessionId}`, reflectAnswer]);
  assertSuccess(reply, 'Expected reflect reply to succeed before inspecting derived receipts.');
  const saved = getEvent(
    parseJsonLines(reply.stderr, 'Expected verbose reflect reply to emit valid JSONL trace events.'),
    'reflect.entry_saved',
    'Expected reflect reply to expose the saved derived entry.'
  );

  const inspect = runThink(context, [`--inspect=${seedEntryId}`]);

  assertSuccess(inspect, 'Expected inspect to succeed for a raw entry with derived reflect activity.');
  assertContains(inspect, 'Thought ID:', 'Expected inspect to expose canonical content identity.');
  assertContains(inspect, 'Derived receipts:', 'Expected inspect to expose derived receipt structure.');
  assertContains(inspect, 'Reflect:', 'Expected inspect to expose the direct reflect descendant plainly.');
  assertContains(inspect, saved.entryId, 'Expected inspect to expose the derived reflect entry id.');
  assertContains(inspect, sessionStarted.sessionId, 'Expected inspect to expose the reflect session lineage.');
});

test('think --json --inspect emits canonical content identity and direct derived receipt rows', async () => {
  const context = await createThinkContext();
  const seedThought = 'We should make warp graph the thought substrate';
  const reflectAnswer = 'The substrate only matters if inspect can show the raw thought and its derived descendants honestly.';
  const { entryId: seedEntryId } = captureWithEntryId(context, seedThought);

  const start = runThink(context, ['--verbose', `--reflect=${seedEntryId}`]);
  assertSuccess(start, 'Expected reflect start to succeed before inspecting derived receipts.');
  const sessionStarted = getEvent(
    parseJsonLines(start.stderr, 'Expected verbose reflect start to emit valid JSONL trace events.'),
    'reflect.session_started',
    'Expected reflect start to emit session metadata.'
  );

  const reply = runThink(context, ['--verbose', `--reflect-session=${sessionStarted.sessionId}`, reflectAnswer]);
  assertSuccess(reply, 'Expected reflect reply to succeed before inspecting derived receipts.');
  const saved = getEvent(
    parseJsonLines(reply.stderr, 'Expected verbose reflect reply to emit valid JSONL trace events.'),
    'reflect.entry_saved',
    'Expected reflect reply to expose the saved derived entry.'
  );

  const inspect = runThink(context, ['--json', `--inspect=${seedEntryId}`]);

  assertSuccess(inspect, 'Expected JSON inspect to succeed for a raw entry with derived reflect activity.');
  assertJsonStreams(inspect);
  assert.equal((inspect.stderr || '').trim(), '', 'Expected successful JSON inspect to keep stderr quiet.');

  const events = parseJsonLines(
    inspect.stdout,
    'Expected JSON inspect with derived receipts to emit valid JSONL.'
  );

  const inspectedEntry = getEvent(
    events,
    'inspect.entry',
    'Expected JSON inspect to expose the requested raw entry metadata.'
  );
  assert.equal(typeof inspectedEntry.thoughtId, 'string', 'Expected JSON inspect to expose canonical content identity.');
  assert.match(inspectedEntry.thoughtId, /^thought:/, 'Expected canonical content identity to use the thought: namespace.');

  const receipt = getEvent(
    events,
    'inspect.receipt',
    'Expected JSON inspect to emit a receipt row for the direct derived reflect entry.'
  );
  assert.equal(receipt.relation, 'seed_of', 'Expected inspect receipts to identify the lineage relation explicitly.');
  assert.equal(receipt.kind, 'reflect', 'Expected inspect receipts to expose the direct derived reflect kind.');
  assert.equal(receipt.entryId, saved.entryId, 'Expected inspect receipts to point at the derived reflect entry.');
  assert.equal(receipt.sessionId, sessionStarted.sessionId, 'Expected inspect receipts to expose session lineage.');
  assert.equal(
    receipt.promptType,
    sessionStarted.promptType,
    'Expected inspect receipts to preserve the prompt family used to create the reflect descendant.'
  );
});

test('think --inspect exposes the first derived bundle as explicit raw, canonical, derived, and context sections', async () => {
  const context = await createThinkContext();
  captureWithEntryId(context, 'older note about local-first tooling');
  const { entryId } = captureWithEntryId(context, 'We should make warp graph the thought substrate');
  captureWithEntryId(context, 'newer note about browse and inspect receipts');

  const inspect = runThink(context, [`--inspect=${entryId}`]);

  assertSuccess(inspect, 'Expected inspect to succeed for the first derived-artifact bundle.');
  assertContains(inspect, 'Raw', 'Expected inspect to expose the raw capture section explicitly.');
  assertContains(
    inspect,
    'Canonical Thought',
    'Expected inspect to expose canonical thought identity as its own section.'
  );
  assertContains(inspect, 'Thought ID: thought:', 'Expected inspect to expose the canonical thought namespace.');
  assertContains(inspect, 'Derived', 'Expected inspect to expose derived interpretive receipts as their own section.');
  assertContains(
    inspect,
    'Seed quality:',
    'Expected inspect to expose the first interpretive artifact as a seed-quality receipt.'
  );
  assertContains(inspect, 'Context', 'Expected inspect to expose contextual receipts as their own section.');
  assertContains(
    inspect,
    'Session:',
    'Expected inspect to expose session attribution as the first contextual receipt.'
  );
  assertOccurrences(
    inspect,
    'Why:',
    2,
    'Expected inspect to expose one reason for seed quality and one reason for session attribution.'
  );
});

test('think --json --inspect emits canonical identity plus seed-quality and session-attribution receipts with provenance', async () => {
  const context = await createThinkContext();
  captureWithEntryId(context, 'older note about local-first tooling');
  const { entryId } = captureWithEntryId(context, 'We should make warp graph the thought substrate');
  captureWithEntryId(context, 'newer note about browse and inspect receipts');

  const inspect = runThink(context, ['--json', `--inspect=${entryId}`]);

  assertSuccess(inspect, 'Expected JSON inspect to succeed for the first derived-artifact bundle.');
  assertJsonStreams(inspect);
  assert.equal((inspect.stderr || '').trim(), '', 'Expected successful JSON inspect to keep stderr quiet.');

  const events = parseJsonLines(
    inspect.stdout,
    'Expected JSON inspect for the first derived-artifact bundle to emit valid JSONL.'
  );

  const identity = getEvent(
    events,
    'inspect.identity',
    'Expected JSON inspect to emit an explicit canonical identity row.'
  );
  assert.equal(identity.entryId, entryId, 'Expected inspect identity to preserve the requested capture entry id.');
  assert.match(identity.thoughtId, /^thought:/, 'Expected inspect identity to expose a canonical thought id.');
  assert.equal(
    identity.relation,
    'expresses',
    'Expected inspect identity to expose the capture-to-thought relationship explicitly.'
  );

  const seedQuality = getReceiptByKind(
    events,
    'seed_quality',
    'Expected JSON inspect to emit a seed-quality artifact receipt.'
  );
  assert.equal(seedQuality.primaryInputKind, 'thought', 'Expected seed quality to derive from canonical thought identity.');
  assert.match(seedQuality.primaryInputId, /^thought:/, 'Expected seed quality to reference canonical thought identity.');
  assert.equal(seedQuality.verdict, 'likely_reflectable', 'Expected this proposal-shaped thought to look reflectable.');
  assert.equal(typeof seedQuality.reasonKind, 'string', 'Expected seed quality to expose reason kind.');
  assert.equal(typeof seedQuality.reasonText, 'string', 'Expected seed quality to expose reason text.');
  assert.ok(Array.isArray(seedQuality.promptFamilies), 'Expected seed quality to expose eligible prompt families.');
  assert.equal(typeof seedQuality.deriver, 'string', 'Expected seed quality to expose the derivation implementation.');
  assert.equal(typeof seedQuality.deriverVersion, 'string', 'Expected seed quality to expose derivation version.');
  assert.equal(typeof seedQuality.schemaVersion, 'string', 'Expected seed quality to expose schema version.');
  assert.equal(typeof seedQuality.createdAt, 'string', 'Expected seed quality to expose artifact creation time.');

  const sessionAttribution = getReceiptByKind(
    events,
    'session_attribution',
    'Expected JSON inspect to emit a session-attribution artifact receipt.'
  );
  assert.equal(
    sessionAttribution.primaryInputKind,
    'capture',
    'Expected session attribution to contextualize the capture event, not just the canonical text.'
  );
  assert.equal(
    sessionAttribution.primaryInputId,
    entryId,
    'Expected session attribution to preserve the inspected capture as its primary input.'
  );
  assert.match(sessionAttribution.sessionId, /^session:/, 'Expected session attribution to expose an explicit session id.');
  assert.equal(typeof sessionAttribution.reasonKind, 'string', 'Expected session attribution to expose reason kind.');
  assert.equal(typeof sessionAttribution.reasonText, 'string', 'Expected session attribution to expose reason text.');
  assert.equal(typeof sessionAttribution.deriver, 'string', 'Expected session attribution to expose the derivation implementation.');
  assert.equal(typeof sessionAttribution.deriverVersion, 'string', 'Expected session attribution to expose derivation version.');
  assert.equal(typeof sessionAttribution.schemaVersion, 'string', 'Expected session attribution to expose schema version.');
  assert.equal(typeof sessionAttribution.createdAt, 'string', 'Expected session attribution to expose artifact creation time.');
});

test('think --json --inspect keeps duplicate raw captures distinct while linking them to the same canonical thought', async () => {
  const context = await createThinkContext();
  const thought = 'Should think support multiple minds one day?';
  const { entryId: firstEntryId } = captureWithEntryId(context, thought);
  const { entryId: secondEntryId } = captureWithEntryId(context, thought);

  assert.notEqual(
    firstEntryId,
    secondEntryId,
    'Expected duplicate raw captures to remain distinct capture events.'
  );

  const firstInspect = runThink(context, ['--json', `--inspect=${firstEntryId}`]);
  const secondInspect = runThink(context, ['--json', `--inspect=${secondEntryId}`]);

  assertSuccess(firstInspect, 'Expected JSON inspect to succeed for the first duplicate capture.');
  assertSuccess(secondInspect, 'Expected JSON inspect to succeed for the second duplicate capture.');

  const firstIdentity = getEvent(
    parseJsonLines(firstInspect.stdout, 'Expected first duplicate inspect output to remain valid JSONL.'),
    'inspect.identity',
    'Expected first duplicate inspect to emit canonical identity.'
  );
  const secondIdentity = getEvent(
    parseJsonLines(secondInspect.stdout, 'Expected second duplicate inspect output to remain valid JSONL.'),
    'inspect.identity',
    'Expected second duplicate inspect to emit canonical identity.'
  );

  assert.equal(firstIdentity.entryId, firstEntryId, 'Expected first inspect identity to preserve its capture event id.');
  assert.equal(secondIdentity.entryId, secondEntryId, 'Expected second inspect identity to preserve its capture event id.');
  assert.equal(
    firstIdentity.thoughtId,
    secondIdentity.thoughtId,
    'Expected duplicate raw captures to resolve to the same canonical thought identity.'
  );
});

function captureWithEntryId(context, thought, extraEnv = {}, options = {}) {
  const capture = runThink(context, ['--verbose', thought], extraEnv, options);

  assertSuccess(capture, `Expected capture to succeed for thought: ${thought}`);
  const events = parseJsonLines(
    capture.stderr,
    'Expected verbose capture to emit valid JSONL trace events.'
  );
  const saved = getEvent(
    events,
    'capture.local_save.done',
    'Expected verbose capture to expose the saved raw entry id.'
  );

  assert.equal(typeof saved.entryId, 'string', 'Expected raw capture to include a string entry id.');
  return {
    entryId: saved.entryId,
    result: capture,
  };
}

async function createProjectRepo(name) {
  const repoDir = await createGitRepo({ prefix: `${name}-`, name });
  const remoteUrl = `git@github.com:flyingrobots/${name}.git`;
  const addRemote = runGit(['remote', 'add', 'origin', remoteUrl], { cwd: repoDir });

  assert.equal(
    addRemote.status,
    0,
    `Expected deterministic project repo fixture to accept an origin remote.\nstdout:\n${addRemote.stdout}\nstderr:\n${addRemote.stderr}`
  );

  return repoDir;
}

function getEvent(events, name, message) {
  const event = events.find((candidate) => candidate.event === name);
  assert.ok(event, message);
  return event;
}

function getReceiptByKind(events, kind, message) {
  const event = events.find((candidate) => candidate.event === 'inspect.receipt' && candidate.kind === kind);
  assert.ok(event, message);
  return event;
}

function assertJsonStreams(result) {
  if ((result.stdout || '').trim() !== '') {
    parseJsonLines(result.stdout, 'Expected stdout to contain only JSONL when present in --json mode.');
  }

  if ((result.stderr || '').trim() !== '') {
    parseJsonLines(result.stderr, 'Expected stderr to contain only JSONL when present in --json mode.');
  }
}

function finalFrame(result) {
  const frames = combinedOutput(result).split('\n\n-----\n\n');
  return frames.at(-1) ?? '';
}

function shortVisibleId(entryId) {
  return String(entryId).slice(0, 12);
}
