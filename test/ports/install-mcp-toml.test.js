import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findTomlStructuralProblem,
  mergeCodexTomlConfig,
  parseInstallMcpArgs,
  renderCodexTomlBlock,
} from '../../src/mcp/install-config.js';


/**
 * Codex TOML rendering, merging and structural checking.
 *
 * Split from install-mcp-config.test.js, which had grown past the 1000-line
 * limit: this module hand-rolls enough TOML to merge one table safely, and that
 * is where most of its risk and most of its tests live.
 */

test('parseInstallMcpArgs rejects a server name that could inject TOML', () => {
  // The space-separated form takes its value straight from argv, bypassing the
  // inline --flag=value regex (whose `.` never matches a newline). An unvalidated
  // name is interpolated raw into `[mcp_servers.<name>]`, so a newline lets a
  // caller append their own table with their own `command` — which the client
  // then executes on startup.
  const injection = 'evil]\ncommand = "/bin/sh -c payload"\n[junk';

  assert.throws(
    () => parseInstallMcpArgs(['--client=codex', '--server-name', injection]),
    /--server-name must be a TOML bare key/,
    'Expected a newline-bearing server name to be rejected.'
  );

  for (const name of [' think ', 'think server', 'think]', '[think', 'think.env', 'think"x', 'th\tink']) {
    assert.throws(
      () => parseInstallMcpArgs(['--client=codex', '--server-name', name]),
      /--server-name must be a TOML bare key/,
      `Expected "${name}" to be rejected as a server name.`
    );
  }
});

test('renderCodexTomlBlock guards the server name at its own boundary', () => {
  // This function is exported, so it cannot rely on the CLI parser having run.
  assert.throws(
    () => renderCodexTomlBlock({
      serversKey: 'mcp_servers',
      serverName: 'evil]\ncommand = "payload"\n[junk',
      entry: { command: 'node', args: ['/opt/think/bin/think-mcp.js'] },
    }),
    /serverName must be a TOML bare key/,
    'Expected the render boundary to reject an injecting name independently.'
  );
});

test('mergeCodexTomlConfig refuses to merge under an injecting server name', () => {
  assert.throws(
    () => mergeCodexTomlConfig('[mcp_servers.graft]\ncommand = "npx"\n', {
      serversKey: 'mcp_servers',
      serverName: 'evil]\ncommand = "payload"\n[junk',
      entry: { command: 'node', args: ['/opt/think/bin/think-mcp.js'] },
    }),
    /serverName must be a TOML bare key/
  );
});

test('findTomlStructuralProblem accepts valid TOML string syntax it does not itself write', () => {
  // The checker's contract is to report only what it can prove. Treating every
  // quote as a delimiter fabricated "unterminated string" for escapes and
  // multi-line strings, and scripts/install-mcp.mjs turns any report into a hard
  // refusal — so a user with a perfectly valid config was blocked from installing.
  const q = '"';
  const a = "'";
  const valid = [
    ['escaped quote in a basic string', `command = ${q}a\\${q}b${q}\n`],
    ['multi-line basic string', `message = ${q.repeat(3)}first\nsecond${q.repeat(3)}\n`],
    ['multi-line literal string', `message = ${a.repeat(3)}first\nsecond${a.repeat(3)}\n`],
    ['a bracket inside a multi-line string', `m = ${q.repeat(3)}not [a header]\nstill text${q.repeat(3)}\n`],
    ['a quote inside a literal string', `note = ${a}he said ${q}hi${q}${a}\n`],
    ['an apostrophe inside a comment', `# don${a}t break\ncommand = ${q}node${q}\n`],
    ['escaped backslash before a closing quote', `p = ${q}C:\\\\${q}\n`],
  ];

  for (const [label, text] of valid) {
    assert.equal(
      findTomlStructuralProblem(text),
      null,
      `Expected valid TOML to be accepted (${label}): ${JSON.stringify(text)}`
    );
  }
});

test('findTomlStructuralProblem still proves a genuinely unterminated multi-line string', () => {
  const q = '"';
  assert.match(
    findTomlStructuralProblem(`m = ${q.repeat(3)}opened and never closed\n`),
    /unterminated/u
  );
});

test('findTomlStructuralProblem reports the corruption shapes it can prove', () => {
  assert.match(findTomlStructuralProblem('broken = [\n'), /unterminated array/u);
  assert.match(findTomlStructuralProblem('x = { a = 1\n'), /unterminated inline table/u);
  assert.match(findTomlStructuralProblem('name = "unclosed\n'), /unterminated string on line 1/u);
  assert.match(
    findTomlStructuralProblem('[mcp_servers.think]\ncommand = "a"\n\n[mcp_servers.think]\ncommand = "b"\n'),
    /declared twice, on lines 1 and 4/u
  );
});

test('findTomlStructuralProblem accepts documents this module actually writes', () => {
  const clean = [
    '# a comment with a stray [ bracket and " quote',
    '[mcp_servers.graft]',
    'command = "npx"',
    'args = ["-y", "@flyingrobots/graft", "serve"]',
    '',
    '[mcp_servers.think]',
    'command = "/usr/local/bin/node"',
    'args = ["/opt/think/bin/think-mcp.js"]',
    'env = { THINK_REPO_DIR = "/home/u/.think/claude" }',
    'startup_timeout_sec = 60',
    '',
    '[history]',
    'persistence = "save-all"',
    '',
  ].join('\n');

  assert.equal(findTomlStructuralProblem(clean), null);
  assert.equal(findTomlStructuralProblem(''), null);
});

test('findTomlStructuralProblem tolerates a multi-line array, which is valid TOML', () => {
  const multiline = '[mcp_servers.think]\nargs = [\n  "/opt/think/bin/think-mcp.js",\n]\n';

  assert.equal(findTomlStructuralProblem(multiline), null);
});

test('mergeCodexTomlConfig appends a server block with an inline env table', () => {
  const result = mergeCodexTomlConfig('', {
    serversKey: 'mcp_servers',
    serverName: 'think',
    entry: {
      command: 'node',
      args: ['/opt/think/bin/think-mcp.js'],
      env: { THINK_REPO_DIR: '/home/u/.think/codex' },
    },
  });

  assert.equal(result.action, 'created');
  assert.equal(result.text, [
    '[mcp_servers.think]',
    'command = "node"',
    'args = ["/opt/think/bin/think-mcp.js"]',
    'env = { THINK_REPO_DIR = "/home/u/.think/codex" }',
    'startup_timeout_sec = 60',
    '',
  ].join('\n'));
});

test('mergeCodexTomlConfig keeps existing content and separates the appended block', () => {
  const existing = '[mcp_servers.graft]\ncommand = "npx"\nargs = ["-y", "@flyingrobots/graft", "serve"]\n';

  const result = mergeCodexTomlConfig(existing, {
    serversKey: 'mcp_servers',
    serverName: 'think',
    entry: { command: 'node', args: ['/opt/think/bin/think-mcp.js'] },
  });

  assert.equal(result.action, 'added');
  assert.match(result.text, /^\[mcp_servers\.graft\]/);
  assert.match(result.text, /\n\n\[mcp_servers\.think\]\ncommand = "node"\n/);
  assert.doesNotMatch(result.text, /env = /);
});

test('mergeCodexTomlConfig replaces only the Think block when it already exists', () => {
  const existing = [
    '[mcp_servers.think]',
    'command = "node"',
    'args = ["/old/path/think-mcp.js"]',
    '',
    '[mcp_servers.graft]',
    'command = "npx"',
    '',
  ].join('\n');

  const result = mergeCodexTomlConfig(existing, {
    serversKey: 'mcp_servers',
    serverName: 'think',
    entry: { command: 'node', args: ['/opt/think/bin/think-mcp.js'] },
  });

  assert.equal(result.action, 'updated');
  assert.match(result.text, /args = \["\/opt\/think\/bin\/think-mcp\.js"\]/);
  assert.doesNotMatch(result.text, /old\/path/);
  assert.match(result.text, /\[mcp_servers\.graft\]\ncommand = "npx"/);
});

test('mergeCodexTomlConfig is idempotent across repeated installs', () => {
  const options = {
    serversKey: 'mcp_servers',
    serverName: 'think',
    entry: {
      command: 'node',
      args: ['/opt/think/bin/think-mcp.js'],
      env: { THINK_REPO_DIR: '/home/u/.think/codex' },
    },
  };

  const first = mergeCodexTomlConfig('', options);
  const second = mergeCodexTomlConfig(first.text, options);

  assert.equal(second.action, 'unchanged');
  assert.equal(second.text, first.text);
});

test('mergeCodexTomlConfig replaces a hand-written env sub-table instead of duplicating the key', () => {
  const existing = [
    '[mcp_servers.think]',
    'command = "node"',
    'args = ["/old/think-mcp.js"]',
    '',
    '[mcp_servers.think.env]',
    'THINK_REPO_DIR = "/Users/dev/.think/old"',
    '',
    '[mcp_servers.graft]',
    'command = "npx"',
    '',
  ].join('\n');

  const result = mergeCodexTomlConfig(existing, {
    serversKey: 'mcp_servers',
    serverName: 'think',
    entry: {
      command: 'node',
      args: ['/opt/think/bin/think-mcp.js'],
      env: { THINK_REPO_DIR: '/Users/dev/.think/new' },
    },
  });

  assert.equal(result.action, 'updated');
  assert.doesNotMatch(
    result.text,
    /\[mcp_servers\.think\.env\]/,
    'Expected the nested env table to be consumed, not left behind as a duplicate key.'
  );
  assert.doesNotMatch(result.text, /old/, 'Expected no stale values to survive the rewrite.');
  assert.match(result.text, /env = \{ THINK_REPO_DIR = "\/Users\/dev\/\.think\/new" \}/);
  assert.match(result.text, /\[mcp_servers\.graft\]\ncommand = "npx"/, 'Expected the neighbour table to survive.');
});

test('mergeCodexTomlConfig keeps a blank line between the rewritten block and the next table', () => {
  const existing = [
    '[mcp_servers.think]',
    'command = "node"',
    'args = ["/old/think-mcp.js"]',
    '',
    '[mcp_servers.graft]',
    'command = "npx"',
    '',
  ].join('\n');

  const result = mergeCodexTomlConfig(existing, {
    serversKey: 'mcp_servers',
    serverName: 'think',
    entry: { command: 'node', args: ['/opt/think/bin/think-mcp.js'] },
  });

  assert.match(
    result.text,
    /startup_timeout_sec = 60\n\n\[mcp_servers\.graft\]/,
    'Expected exactly one blank line separating the rewritten block from the next table.'
  );
});

test('mergeCodexTomlConfig stays idempotent when a nested table had to be collapsed', () => {
  const options = {
    serversKey: 'mcp_servers',
    serverName: 'think',
    entry: {
      command: 'node',
      args: ['/opt/think/bin/think-mcp.js'],
      env: { THINK_REPO_DIR: '/Users/dev/.think/new' },
    },
  };
  const existing = [
    '[mcp_servers.think]',
    'command = "node"',
    'args = ["/old/think-mcp.js"]',
    '',
    '[mcp_servers.think.env]',
    'THINK_REPO_DIR = "/Users/dev/.think/old"',
    '',
    '[mcp_servers.graft]',
    'command = "npx"',
    '',
  ].join('\n');

  const first = mergeCodexTomlConfig(existing, options);
  const second = mergeCodexTomlConfig(first.text, options);

  assert.equal(second.action, 'unchanged');
  assert.equal(second.text, first.text);
});

test('mergeCodexTomlConfig does not treat another server as a nested table of the target', () => {
  const existing = [
    '[mcp_servers.think]',
    'command = "node"',
    'args = ["/old.js"]',
    '',
    '[mcp_servers.think-extra]',
    'command = "other"',
    '',
  ].join('\n');

  const result = mergeCodexTomlConfig(existing, {
    serversKey: 'mcp_servers',
    serverName: 'think',
    entry: { command: 'node', args: ['/opt/think/bin/think-mcp.js'] },
  });

  // Both halves must be pinned. Asserting only that the sibling survives would
  // still pass if the finder stopped short and left the stale Think body in
  // place, which is the opposite failure from swallowing the sibling.
  assert.equal(result.action, 'updated', 'Expected the Think block itself to be rewritten.');
  assert.match(
    result.text,
    /args = \["\/opt\/think\/bin\/think-mcp\.js"\]/u,
    'Expected the target block to carry the new entry.'
  );
  assert.doesNotMatch(result.text, /old\.js/u, 'Expected the stale Think body to be gone.');
  assert.match(
    result.text,
    /\[mcp_servers\.think-extra\]\ncommand = "other"/u,
    'Expected a similarly named sibling server to survive untouched.'
  );
});

test('mergeCodexTomlConfig refuses when the server is already defined inline in its parent table', () => {
  // `[mcp_servers]` + `think = { ... }` declares mcp_servers.think without a
  // header of its own. Appending [mcp_servers.think] then declares it twice, so
  // TOML parsers reject the whole file — and the installer reported success.
  for (const inline of ['think = { command = "old" }', "think={command='old'}", 'think  =  { command = "old" }']) {
    assert.throws(
      () => mergeCodexTomlConfig(`[mcp_servers]\n${inline}\n`, {
        serversKey: 'mcp_servers',
        serverName: 'think',
        entry: { command: '/usr/local/bin/node', args: ['/opt/think/bin/think-mcp.js'] },
      }),
      /already defined inline/u,
      `Expected an inline definition to be refused: ${inline}`
    );
  }
});

test('mergeCodexTomlConfig ignores an inline key that belongs to a different table', () => {
  const result = mergeCodexTomlConfig('[other]\nthink = { command = "unrelated" }\n', {
    serversKey: 'mcp_servers',
    serverName: 'think',
    entry: { command: '/usr/local/bin/node', args: ['/opt/think/bin/think-mcp.js'] },
  });

  assert.equal(result.action, 'added', 'A same-named key under an unrelated table is not our server.');
  assert.match(result.text, /\[other\]\nthink = \{ command = "unrelated" \}/u);
});

test('mergeCodexTomlConfig ignores a similarly named inline key in the parent table', () => {
  const result = mergeCodexTomlConfig('[mcp_servers]\nthink-extra = { command = "other" }\n', {
    serversKey: 'mcp_servers',
    serverName: 'think',
    entry: { command: '/usr/local/bin/node', args: ['/opt/think/bin/think-mcp.js'] },
  });

  assert.equal(result.action, 'added');
});

test('mergeCodexTomlConfig recognises equivalent spellings of the target header', () => {
  // TOML permits quoting and whitespace around dotted key parts, so all of these
  // are the same table as [mcp_servers.think]. Literal string matching missed
  // them and appended a second table, which makes the file invalid and breaks
  // every server in it.
  for (const header of ['[mcp_servers."think"]', '[mcp_servers . think]', '[ mcp_servers.think ]', "[mcp_servers.'think']"]) {
    const result = mergeCodexTomlConfig(`${header}\ncommand = "node"\nargs = ["/old.js"]\n`, {
      serversKey: 'mcp_servers',
      serverName: 'think',
      entry: { command: 'node', args: ['/opt/think/bin/think-mcp.js'] },
    });

    assert.equal(result.action, 'updated', `Expected ${header} to be recognised as the target block.`);

    const headerCount = [...result.text.matchAll(/^\[\s*mcp_servers\s*\.\s*['"]?think['"]?\s*\]/gmu)].length;
    assert.equal(headerCount, 1, `Expected exactly one think table after merging into ${header}.`);
    assert.doesNotMatch(result.text, /old\.js/u, `Expected the stale body under ${header} to be replaced.`);
  }
});

test('mergeCodexTomlConfig recognises a header carrying an inline comment', () => {
  // TOML allows a comment after the closing bracket. Requiring the trimmed line
  // to end in ']' rejected such a header, so the merge appended a second table
  // for the same key and invalidated the file.
  for (const header of ['[mcp_servers.think] # local server', '[mcp_servers."think"]\t# note', '[mcp_servers.think]  #']) {
    const result = mergeCodexTomlConfig(`${header}\ncommand = "node"\nargs = ["/old.js"]\n`, {
      serversKey: 'mcp_servers',
      serverName: 'think',
      entry: { command: 'node', args: ['/opt/think/bin/think-mcp.js'] },
    });

    assert.equal(result.action, 'updated', `Expected ${header} to be recognised.`);
    assert.doesNotMatch(result.text, /old\.js/u, `Expected the stale body under ${header} to be replaced.`);
    assert.equal(
      [...result.text.matchAll(/^\[\s*mcp_servers\s*\.\s*['"]?think['"]?\s*\]/gmu)].length,
      1,
      `Expected exactly one think table after merging into ${header}.`
    );
  }
});

test('mergeCodexTomlConfig does not mistake a bracket inside a quoted key for the header end', () => {
  const result = mergeCodexTomlConfig('[mcp_servers."th]ink"]\ncommand = "other"\n', {
    serversKey: 'mcp_servers',
    serverName: 'think',
    entry: { command: 'node', args: ['/opt/think/bin/think-mcp.js'] },
  });

  assert.equal(result.action, 'added', 'Expected a differently keyed server to be left alone.');
  assert.match(result.text, /\[mcp_servers\."th\]ink"\]\ncommand = "other"/u);
});

test('mergeCodexTomlConfig treats a quoted sibling server as unrelated', () => {
  const result = mergeCodexTomlConfig('[mcp_servers."think-extra"]\ncommand = "other"\n', {
    serversKey: 'mcp_servers',
    serverName: 'think',
    entry: { command: 'node', args: ['/opt/think/bin/think-mcp.js'] },
  });

  assert.equal(result.action, 'added');
  assert.match(result.text, /\[mcp_servers\."think-extra"\]\ncommand = "other"/u);
});

test('mergeCodexTomlConfig absorbs an equivalently spelled nested env table', () => {
  const existing = [
    '[mcp_servers.think]',
    'command = "node"',
    '',
    '[mcp_servers."think".env]',
    'THINK_REPO_DIR = "/Users/dev/.think/old"',
    '',
    '[mcp_servers.graft]',
    'command = "npx"',
    '',
  ].join('\n');

  const result = mergeCodexTomlConfig(existing, {
    serversKey: 'mcp_servers',
    serverName: 'think',
    entry: {
      command: 'node',
      args: ['/opt/think/bin/think-mcp.js'],
      env: { THINK_REPO_DIR: '/Users/dev/.think/new' },
    },
  });

  assert.doesNotMatch(result.text, /\.env\]/u, 'Expected the quoted nested env table to be absorbed.');
  assert.doesNotMatch(result.text, /old/u);
  assert.match(result.text, /\[mcp_servers\.graft\]/u, 'Expected the neighbour to survive.');
});

test('renderCodexTomlBlock validates env keys the same way it validates the server name', () => {
  // env keys are interpolated raw into the inline table, so a key carrying a
  // quote or newline produces a config no TOML parser will read — disabling every
  // server in the file. Today env keys are module-controlled, but this function is
  // exported and cannot assume that.
  for (const key of ['X" }\ncommand = "payload"\n[junk', 'has space', 'has.dot', 'has"quote', '']) {
    assert.throws(
      () => renderCodexTomlBlock({
        serversKey: 'mcp_servers',
        serverName: 'think',
        entry: {
          command: '/usr/local/bin/node',
          args: ['/opt/think/bin/think-mcp.js'],
          env: { [key]: 'v' },
        },
      }),
      /env key must be a TOML bare key/u,
      `Expected env key ${JSON.stringify(key)} to be rejected.`
    );
  }
});

test('renderCodexTomlBlock accepts the env keys Think actually sets', () => {
  const block = renderCodexTomlBlock({
    serversKey: 'mcp_servers',
    serverName: 'think',
    entry: {
      command: '/usr/local/bin/node',
      args: ['/opt/think/bin/think-mcp.js'],
      env: { THINK_REPO_DIR: '/home/u/.think/claude' },
    },
  });

  assert.match(block, /env = \{ THINK_REPO_DIR = "\/home\/u\/\.think\/claude" \}/u);
});

test('mergeCodexTomlConfig escapes control characters that would break the file', () => {
  // Newlines and tabs are legal in POSIX paths but cannot appear literally in a
  // TOML basic string. Emitting them raw invalidates the config and disables
  // every server in it.
  const result = mergeCodexTomlConfig('', {
    serversKey: 'mcp_servers',
    serverName: 'think',
    entry: {
      command: '/usr/local/bin/node',
      args: ['/tmp/we\nird\tpath/think-mcp.js'],
      env: { THINK_REPO_DIR: '/tmp/mind\u0007bell' },
    },
  });

  // Every rendered line must be free of literal control characters. Checking the
  // whole blob would trip over the newlines that legitimately separate keys.
  for (const line of result.text.split('\n')) {
    assert.doesNotMatch(
      line,
      // eslint-disable-next-line no-control-regex -- asserting control characters are absent
      /[\u0000-\u001f\u007f]/u,
      `Expected no literal control character in rendered line: ${JSON.stringify(line)}`
    );
  }

  assert.match(result.text, /\\n/u, 'Expected the newline to be escaped.');
  assert.match(result.text, /\\t/u, 'Expected the tab to be escaped.');
  assert.match(result.text, /\\u0007/u, 'Expected other control characters to be escaped as \\uXXXX.');
});

test('mergeCodexTomlConfig escapes quotes and backslashes in paths', () => {
  const result = mergeCodexTomlConfig('', {
    serversKey: 'mcp_servers',
    serverName: 'think',
    entry: { command: 'node', args: ['C:\\think\\bin\\think-mcp.js'] },
  });

  assert.match(result.text, /args = \["C:\\\\think\\\\bin\\\\think-mcp\.js"\]/);
});
