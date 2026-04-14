import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLASSIFICATIONS,
  CLASSIFICATION_PREFIX,
  GRAPH_MODEL_VERSION,
  PRODUCT_READ_LENS,
  TOPIC_PREFIX,
  ENTITY_PREFIX,
  ANNOTATION_PREFIX,
  PIPELINE_RUN_PREFIX,
} from '../../src/store/constants.js';

test('GRAPH_MODEL_VERSION is 4', () => {
  assert.equal(GRAPH_MODEL_VERSION, 4);
});

test('CLASSIFICATIONS has 7 entries including unclassified', () => {
  assert.equal(CLASSIFICATIONS.length, 7);
  assert.ok(CLASSIFICATIONS.includes('question'));
  assert.ok(CLASSIFICATIONS.includes('decision'));
  assert.ok(CLASSIFICATIONS.includes('observation'));
  assert.ok(CLASSIFICATIONS.includes('action_item'));
  assert.ok(CLASSIFICATIONS.includes('idea'));
  assert.ok(CLASSIFICATIONS.includes('reference'));
  assert.ok(CLASSIFICATIONS.includes('unclassified'));
  assert.ok(Object.isFrozen(CLASSIFICATIONS));
});

test('PRODUCT_READ_LENS includes enrichment prefixes', () => {
  const patterns = PRODUCT_READ_LENS.match;
  assert.ok(patterns.includes(`${TOPIC_PREFIX}*`), 'Missing topic prefix');
  assert.ok(patterns.includes(`${CLASSIFICATION_PREFIX}*`), 'Missing classification prefix');
  assert.ok(patterns.includes(`${ENTITY_PREFIX}*`), 'Missing entity prefix');
  assert.ok(patterns.includes(`${ANNOTATION_PREFIX}*`), 'Missing annotation prefix');
  assert.ok(patterns.includes(`${PIPELINE_RUN_PREFIX}*`), 'Missing pipeline_run prefix');
});
