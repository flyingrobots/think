import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const contractPath = path.resolve('contracts', 'think-memory.graphql');

test('Think Echo contract expresses the pinned memory model', async () => {
  const schema = parseSchema(await readFile(contractPath, 'utf8'));

  assert.ok(schema.scalars.has('DateTime'), 'Expected DateTime scalar.');
  assert.ok(schema.directives.has('wes_op'), 'Expected @wes_op directive.');
  assert.ok(schema.directives.has('wes_footprint'), 'Expected @wes_footprint directive.');

  assertModelTypes(schema);
  assertCaptureMutation(schema);
  assertInspectQuery(schema);
});

function assertModelTypes(schema) {
  const thoughtEntry = requireBlock(schema, 'type', 'ThoughtEntry');
  assertField(thoughtEntry, 'thoughtId', 'ID!');
  assertField(thoughtEntry, 'mindId', 'ID!');
  assertField(thoughtEntry, 'capturedAt', 'DateTime!');
  assertField(thoughtEntry, 'content', 'ThoughtContent!');
  assertField(thoughtEntry, 'capture', 'ThoughtCapture!');
  assertField(thoughtEntry, 'provenance', 'ThoughtProvenance!');
  assertField(thoughtEntry, 'causalRef', 'CausalRef!');

  assertField(requireBlock(schema, 'type', 'ThoughtContent'), 'digest', 'String!');
  assertField(requireBlock(schema, 'input', 'ThoughtContentInput'), 'digest', 'String!');
  assertField(requireBlock(schema, 'type', 'CausalRef'), 'runtime', 'CausalRuntime!');
  assertField(requireBlock(schema, 'type', 'CausalRef'), 'witness', 'String');
  assertField(requireBlock(schema, 'type', 'ThoughtCapture'), 'capturedAt', 'DateTime!');
  assertField(requireBlock(schema, 'input', 'CaptureThoughtInput'), 'capturedAt', 'DateTime!');
}

function assertCaptureMutation(schema) {
  const mutation = requireBlock(schema, 'type', 'Mutation');
  const captureThought = assertField(mutation, 'captureThought', 'CaptureThoughtResult!');
  assert.deepEqual(captureThought.args, { input: 'CaptureThoughtInput!' });
  assert.ok(captureThought.directives.has('wes_op'), 'Expected captureThought @wes_op.');
  assert.ok(captureThought.directives.has('wes_footprint'), 'Expected captureThought @wes_footprint.');
}

function assertInspectQuery(schema) {
  const query = requireBlock(schema, 'type', 'Query');
  const inspectThought = assertField(query, 'inspectThought', 'ThoughtEntry!');
  assert.deepEqual(inspectThought.args, { mindId: 'ID!', thoughtId: 'ID!' });
  assert.ok(inspectThought.directives.has('wes_op'), 'Expected inspectThought @wes_op.');
}

function parseSchema(source) {
  return Object.freeze({
    blocks: parseBlocks(source),
    directives: parseDirectives(source),
    scalars: parseScalars(source),
  });
}

function parseBlocks(source) {
  const blocks = new Map();
  const blockPattern = /^(type|input|enum)\s+(\w+)\s*\{([\s\S]*?)^}/gm;
  for (const match of source.matchAll(blockPattern)) {
    blocks.set(`${match[1]}:${match[2]}`, Object.freeze({
      fields: parseFields(match[3]),
      kind: match[1],
      name: match[2],
    }));
  }
  return blocks;
}

function parseFields(body) {
  const fields = new Map();
  let current = null;
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    current = applySchemaLine(fields, current, line);
  }
  return fields;
}

function applySchemaLine(fields, current, line) {
  if (line === '') {
    return current;
  }
  if (line.startsWith('@') && current) {
    current.directives.add(line.match(/^@(\w+)/u)?.[1] ?? '');
    return current;
  }
  const parsed = parseFieldLine(line);
  if (parsed) {
    fields.set(parsed.name, parsed);
    return parsed;
  }
  return current;
}

function parseFieldLine(line) {
  const match = /^(\w+)\s*(?:\(([^)]*)\))?\s*:\s*([^\s@]+)/u.exec(line);
  if (match) {
    return Object.freeze({
      args: parseArgs(match[2] ?? ''),
      directives: new Set(),
      name: match[1],
      type: match[3],
    });
  }
  return null;
}

function parseArgs(rawArgs) {
  const args = {};
  for (const arg of rawArgs.split(',').map(value => value.trim()).filter(Boolean)) {
    const [name, type] = arg.split(':').map(value => value.trim());
    args[name] = type;
  }
  return args;
}

function parseDirectives(source) {
  return new Set([...source.matchAll(/^directive\s+@(\w+)/gm)].map(match => match[1]));
}

function parseScalars(source) {
  return new Set([...source.matchAll(/^scalar\s+(\w+)$/gm)].map(match => match[1]));
}

function requireBlock(schema, kind, name) {
  const block = schema.blocks.get(`${kind}:${name}`);
  assert.ok(block, `Expected ${kind} ${name}.`);
  return block;
}

function assertField(block, fieldName, fieldType) {
  const field = block.fields.get(fieldName);
  assert.ok(field, `Expected ${block.name}.${fieldName}.`);
  assert.equal(field.type, fieldType, `Expected ${block.name}.${fieldName} type.`);
  return field;
}
