/* @generated from Think's v19 git-warp application contract. */

import {
  createManyObserver,
  createObserver,
  intent,
  reading,
} from '@git-stunts/git-warp/advanced';

import { ValidationError } from '../errors.js';
import { THINK_RECORD_KEY } from './v19-record.js';

const RECORD_OBSERVER_ID = 'think.record';
const RECORDS_OBSERVER_ID = 'think.records';

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${field} must be a non-empty string`);
  }
  return value;
}

function requireRecordValue(value) {
  if (value !== null && typeof value !== 'string') {
    throw new ValidationError('Think record Observer expected a string or null');
  }
  return value;
}

function registerNode({ subject }) {
  return intent.node.add({
    subject: requireNonEmptyString(subject, 'think.registerNode.subject'),
  });
}

function storeRecord({ subject, value }) {
  return intent.property.set({
    subject: requireNonEmptyString(subject, 'think.storeRecord.subject'),
    key: THINK_RECORD_KEY,
    value: requireNonEmptyString(value, 'think.storeRecord.value'),
  });
}

function recordOf({ subject }) {
  const resolvedSubject = requireNonEmptyString(subject, 'think.recordOf.subject');
  return createObserver(
    RECORD_OBSERVER_ID,
    reading.property({
      subject: resolvedSubject,
      key: THINK_RECORD_KEY,
    }),
    requireRecordValue
  );
}

function recordsOf({ subjects }) {
  if (!Array.isArray(subjects)) {
    throw new ValidationError('think.recordsOf.subjects must be an array');
  }
  const resolvedSubjects = Object.freeze(
    subjects.map((subject, index) => (
      requireNonEmptyString(subject, `think.recordsOf.subjects[${index}]`)
    ))
  );

  return createManyObserver(
    RECORDS_OBSERVER_ID,
    function* recordReadings() {
      for (const subject of resolvedSubjects) {
        yield reading.property({
          subject,
          key: THINK_RECORD_KEY,
        });
      }
    },
    requireRecordValue
  );
}

export const thinkWarp = Object.freeze({
  intents: Object.freeze({
    registerNode,
    storeRecord,
  }),
  observers: Object.freeze({
    recordOf,
    recordsOf,
  }),
});
