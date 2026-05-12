import assert from 'node:assert/strict';
import test from 'node:test';

import { Entry, ReflectSession, createEntry, createReflectSession, storesTextContent } from '../../src/store/model.js';
import { ENTRY_KINDS, BUCKET_PERIODS } from '../../src/store/constants.js';

test('createEntry returns an Entry instance', () => {
  const entry = createEntry('test thought', 'local.test.cli', { kind: 'capture', source: 'capture' });

  assert.ok(entry instanceof Entry, 'Expected entry to be an Entry instance.');
  assert.equal(entry.text, 'test thought');
  assert.equal(entry.kind, 'capture');
  assert.equal(entry.writerId, 'local.test.cli');
  assert.ok(entry.id.startsWith('entry:'), 'Expected id to have entry prefix.');
  assert.ok(entry.createdAt, 'Expected createdAt to be set.');
  assert.ok(entry.sortKey, 'Expected sortKey to be set.');
});

test('Entry is frozen', () => {
  const entry = createEntry('frozen', 'local.test.cli', { kind: 'capture', source: 'capture' });

  assert.ok(Object.isFrozen(entry), 'Expected entry to be frozen.');
});

test('createEntry validates required fields', () => {
  assert.throws(
    () => createEntry('', 'local.test.cli', { kind: 'capture', source: 'capture' }),
    { message: /text/ },
    'Expected empty text to throw.'
  );

  assert.throws(
    () => createEntry('thought', '', { kind: 'capture', source: 'capture' }),
    { message: /writerId/ },
    'Expected empty writerId to throw.'
  );
});

test('createReflectSession returns a ReflectSession instance', () => {
  const session = createReflectSession('local.test.cli', {
    seedEntryId: 'entry:123',
    contrastEntryId: null,
    promptType: 'challenge',
    question: 'Why?',
    selectionReason: 'test',
  });

  assert.ok(session instanceof ReflectSession, 'Expected session to be a ReflectSession instance.');
  assert.equal(session.seedEntryId, 'entry:123');
  assert.equal(session.promptType, 'challenge');
  assert.ok(session.id.startsWith('reflect:'), 'Expected id to have session prefix.');
});

test('ReflectSession is frozen', () => {
  const session = createReflectSession('local.test.cli', {
    seedEntryId: 'entry:123',
    contrastEntryId: null,
    promptType: 'challenge',
    question: 'Why?',
    selectionReason: 'test',
  });

  assert.ok(Object.isFrozen(session), 'Expected session to be frozen.');
});

test('ENTRY_KINDS is a frozen array of valid kind strings', () => {
  assert.ok(Object.isFrozen(ENTRY_KINDS), 'Expected ENTRY_KINDS to be frozen.');
  assert.ok(ENTRY_KINDS.includes('capture'), 'Expected capture in ENTRY_KINDS.');
  assert.ok(ENTRY_KINDS.includes('reflect'), 'Expected reflect in ENTRY_KINDS.');
  assert.ok(ENTRY_KINDS.includes('thought'), 'Expected thought in ENTRY_KINDS.');
});

test('BUCKET_PERIODS is a frozen array of valid bucket strings', () => {
  assert.ok(Object.isFrozen(BUCKET_PERIODS), 'Expected BUCKET_PERIODS to be frozen.');
  assert.ok(BUCKET_PERIODS.includes('hour'), 'Expected hour in BUCKET_PERIODS.');
  assert.ok(BUCKET_PERIODS.includes('day'), 'Expected day in BUCKET_PERIODS.');
  assert.ok(BUCKET_PERIODS.includes('week'), 'Expected week in BUCKET_PERIODS.');
});

test('storesTextContent validates against ENTRY_KINDS', () => {
  for (const kind of ENTRY_KINDS) {
    assert.equal(typeof storesTextContent(kind), 'boolean', `Expected boolean for kind "${kind}".`);
  }
  assert.equal(storesTextContent('invalid_kind'), false, 'Expected false for invalid kind.');
});
