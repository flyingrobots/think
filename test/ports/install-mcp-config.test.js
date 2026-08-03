import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  buildStagedConfigPath,
  buildThinkMcpServerEntry,
  listInstallMcpClients,
  mergeCodexTomlConfig,
  mergeJsonMcpConfig,
  parseInstallMcpArgs,
  planInstallMcpTarget,
  renderCodexTomlBlock,
  resolveMindRepoDir,
  resolveWriteTargetPath,
} from '../../src/mcp/install-config.js';

test('parseInstallMcpArgs defaults to user scope because Think is a single global memory', () => {
  const parsed = parseInstallMcpArgs(['--client=claude-code']);

  assert.equal(parsed.client, 'claude-code');
  assert.equal(parsed.scope, 'user');
  assert.equal(parsed.serverName, 'think');
  assert.equal(parsed.mind, null);
  assert.equal(parsed.repoDir, null);
  assert.equal(parsed.print, false);
  assert.equal(parsed.json, false);
});

test('parseInstallMcpArgs accepts space separated values and flag aliases', () => {
  const parsed = parseInstallMcpArgs([
    '--client', 'codex',
    '--scope', 'project',
    '--mind', 'codex',
    '--server-name', 'codex-think',
    '--dir', '/tmp/target',
    '--print',
    '--json',
  ]);

  assert.equal(parsed.client, 'codex');
  assert.equal(parsed.scope, 'project');
  assert.equal(parsed.mind, 'codex');
  assert.equal(parsed.serverName, 'codex-think');
  assert.equal(parsed.dir, '/tmp/target');
  assert.equal(parsed.print, true);
  assert.equal(parsed.json, true);
});

test('parseInstallMcpArgs rejects unknown clients, unknown flags, and conflicting mind targets', () => {
  assert.throws(() => parseInstallMcpArgs(['--client=emacs']), /Unknown client "emacs"/);
  assert.throws(() => parseInstallMcpArgs(['--client=codex', '--nope']), /Unknown argument: --nope/);
  assert.throws(() => parseInstallMcpArgs(['--client=codex', '--scope=global']), /--scope must be user or project/);
  assert.throws(
    () => parseInstallMcpArgs(['--client=codex', '--mind=a', '--repo-dir=/tmp/b']),
    /--mind and --repo-dir are mutually exclusive/
  );
  assert.throws(() => parseInstallMcpArgs([]), /--client is required/);
  assert.throws(() => parseInstallMcpArgs(['--client']), /Missing value for --client/);
});

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

test('parseInstallMcpArgs accepts the server names people legitimately use', () => {
  for (const name of ['think', 'codex-think', 'claude_think', 'Think2']) {
    assert.equal(
      parseInstallMcpArgs(['--client=codex', '--server-name', name]).serverName,
      name,
      `Expected "${name}" to be a valid server name.`
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

test('parseInstallMcpArgs treats --list and --help as terminal intents that need no client', () => {
  assert.equal(parseInstallMcpArgs(['--list']).list, true);
  assert.equal(parseInstallMcpArgs(['--help']).help, true);
  assert.equal(parseInstallMcpArgs(['-h']).help, true);
});

test('listInstallMcpClients advertises every supported client with its scope support', () => {
  const clients = listInstallMcpClients();
  const ids = clients.map((client) => client.id);

  assert.deepEqual(ids, ['claude-code', 'codex', 'cursor', 'vscode', 'windsurf']);
  for (const client of clients) {
    assert.ok(client.scopes.length > 0, `Expected ${client.id} to support at least one scope.`);
    assert.ok(client.label.length > 0, `Expected ${client.id} to carry a human label.`);
  }
});

test('resolveMindRepoDir maps the default mind onto the legacy repo directory', () => {
  assert.equal(resolveMindRepoDir('default', '/home/u/.think'), '/home/u/.think/repo');
  assert.equal(resolveMindRepoDir('claude', '/home/u/.think'), '/home/u/.think/claude');
  assert.throws(() => resolveMindRepoDir('../escape', '/home/u/.think'), /Mind name must be a single path segment/);
  assert.throws(() => resolveMindRepoDir('', '/home/u/.think'), /Mind name must be a single path segment/);
});

test('buildThinkMcpServerEntry records the interpreter that ran the installer', () => {
  // A bare "node" only resolves if the client's PATH has one. GUI-launched
  // clients and version managers such as nvm or asdf routinely do not, and the
  // server then fails to start with nothing pointing at why.
  const entry = buildThinkMcpServerEntry({
    nodePath: '/home/u/.nvm/versions/node/v22.14.0/bin/node',
    serverPath: '/opt/think/bin/think-mcp.js',
  });

  assert.deepEqual(entry, {
    command: '/home/u/.nvm/versions/node/v22.14.0/bin/node',
    args: ['/opt/think/bin/think-mcp.js'],
  });
});

test('buildThinkMcpServerEntry requires an absolute interpreter path', () => {
  assert.throws(
    () => buildThinkMcpServerEntry({ nodePath: 'node', serverPath: '/opt/think/bin/think-mcp.js' }),
    /nodePath must be an absolute path/,
    'Expected a bare command name to be refused, since it defeats the purpose of recording it.'
  );
});

test('buildThinkMcpServerEntry routes a mind through THINK_REPO_DIR', () => {
  const entry = buildThinkMcpServerEntry({
    nodePath: '/usr/local/bin/node',
    serverPath: '/opt/think/bin/think-mcp.js',
    repoDir: '/home/u/.think/claude',
  });

  assert.deepEqual(entry, {
    command: '/usr/local/bin/node',
    args: ['/opt/think/bin/think-mcp.js'],
    env: { THINK_REPO_DIR: '/home/u/.think/claude' },
  });
});

test('planInstallMcpTarget resolves user scope config paths per client', () => {
  const home = '/home/u';

  assert.deepEqual(
    planInstallMcpTarget({ client: 'claude-code', scope: 'user', home, dir: '/repo' }),
    { file: '/home/u/.claude.json', format: 'json', serversKey: 'mcpServers' }
  );
  assert.deepEqual(
    planInstallMcpTarget({ client: 'codex', scope: 'user', home, dir: '/repo' }),
    { file: '/home/u/.codex/config.toml', format: 'toml', serversKey: 'mcp_servers' }
  );
  assert.deepEqual(
    planInstallMcpTarget({ client: 'cursor', scope: 'user', home, dir: '/repo' }),
    { file: '/home/u/.cursor/mcp.json', format: 'json', serversKey: 'mcpServers' }
  );
  assert.deepEqual(
    planInstallMcpTarget({ client: 'windsurf', scope: 'user', home, dir: '/repo' }),
    { file: '/home/u/.codeium/windsurf/mcp_config.json', format: 'json', serversKey: 'mcpServers' }
  );
});

test('planInstallMcpTarget resolves project scope config paths and uses the VS Code servers key', () => {
  const home = '/home/u';

  assert.deepEqual(
    planInstallMcpTarget({ client: 'claude-code', scope: 'project', home, dir: '/repo' }),
    { file: '/repo/.mcp.json', format: 'json', serversKey: 'mcpServers' }
  );
  assert.deepEqual(
    planInstallMcpTarget({ client: 'codex', scope: 'project', home, dir: '/repo' }),
    { file: '/repo/.codex/config.toml', format: 'toml', serversKey: 'mcp_servers' }
  );
  assert.deepEqual(
    planInstallMcpTarget({ client: 'vscode', scope: 'project', home, dir: '/repo' }),
    { file: '/repo/.vscode/mcp.json', format: 'json', serversKey: 'servers' }
  );
});

test('planInstallMcpTarget rejects inherited object keys as client ids', () => {
  // CLIENTS is a plain object, so indexing it with an arbitrary caller string
  // resolves inherited members. Without an own-property check, `toString` slips
  // past the unknown-client branch and reports "does not support user scope"
  // with an empty scope list. This function is exported, so the CLI parser's
  // own guard cannot be relied on.
  for (const client of ['toString', 'constructor', 'valueOf', '__proto__']) {
    assert.throws(
      () => planInstallMcpTarget({ client, scope: 'user', home: '/home/u', dir: '/repo' }),
      /Unknown client/,
      `Expected "${client}" to be rejected as an unknown client.`
    );
  }
});

test('planInstallMcpTarget refuses scopes a client does not actually support', () => {
  assert.throws(
    () => planInstallMcpTarget({ client: 'vscode', scope: 'user', home: '/home/u', dir: '/repo' }),
    /vscode does not support user scope/
  );
  assert.throws(
    () => planInstallMcpTarget({ client: 'windsurf', scope: 'project', home: '/home/u', dir: '/repo' }),
    /windsurf does not support project scope/
  );
});

test('buildStagedConfigPath stages beside the target under a unique hidden name', () => {
  const staged = buildStagedConfigPath('/home/u/dotfiles/mcp.json', { pid: 4242, nonce: 'a1b2c3' });

  assert.equal(staged, '/home/u/dotfiles/.mcp.json.think-install.4242.a1b2c3.tmp');
  assert.equal(
    path.dirname(staged),
    '/home/u/dotfiles',
    'Staging must share the target directory so the rename stays atomic.'
  );
  assert.match(path.basename(staged), /^\./u, 'Expected a hidden staged file.');
});

test('buildStagedConfigPath is unpredictable across attempts', () => {
  // A predictable staged path lets someone pre-create it as a symlink and
  // redirect the write, or leave a stale file whose looser mode the rename then
  // moves onto the live config.
  const first = buildStagedConfigPath('/home/u/.mcp.json', { pid: 1, nonce: 'aaaa' });
  const second = buildStagedConfigPath('/home/u/.mcp.json', { pid: 1, nonce: 'bbbb' });
  const otherProcess = buildStagedConfigPath('/home/u/.mcp.json', { pid: 2, nonce: 'aaaa' });

  assert.notEqual(first, second, 'Expected the nonce to vary the staged name.');
  assert.notEqual(first, otherProcess, 'Expected concurrent processes not to collide.');
});

test('resolveWriteTargetPath follows a symlinked config to its real file', () => {
  // Dotfiles setups symlink ~/.claude.json and friends into a tracked repo.
  // Staging beside the link and renaming over it would replace the link with a
  // regular file and leave the tracked source untouched, so the config the user
  // asked for never takes effect while the install still reports success.
  const resolved = resolveWriteTargetPath('/home/u/.mcp.json', {
    realpath: (file) => {
      assert.equal(file, '/home/u/.mcp.json');
      return '/home/u/dotfiles/mcp.json';
    },
  });

  assert.equal(resolved, '/home/u/dotfiles/mcp.json');
});

test('resolveWriteTargetPath resolves a dangling symlink to its intended target', () => {
  // A dotfiles symlink whose target has not been created yet still points
  // somewhere deliberate. realpathSync throws ENOENT for it, and treating that
  // as "no file here" made the rename replace the link with a regular file —
  // the same breakage the symlink handling was added to prevent.
  const resolved = resolveWriteTargetPath('/home/u/.mcp.json', {
    realpath: () => {
      const error = new Error('no such file or directory');
      error.code = 'ENOENT';
      throw error;
    },
    readLink: (file) => {
      assert.equal(file, '/home/u/.mcp.json');
      return '/home/u/dotfiles/mcp.json';
    },
  });

  assert.equal(resolved, '/home/u/dotfiles/mcp.json');
});

test('resolveWriteTargetPath resolves a relative dangling symlink against its own directory', () => {
  const resolved = resolveWriteTargetPath('/home/u/.config/mcp.json', {
    realpath: () => {
      const error = new Error('missing');
      error.code = 'ENOENT';
      throw error;
    },
    readLink: () => '../dotfiles/mcp.json',
  });

  assert.equal(resolved, '/home/u/dotfiles/mcp.json');
});

test('resolveWriteTargetPath keeps the requested path when the config does not exist yet', () => {
  const resolved = resolveWriteTargetPath('/home/u/.cursor/mcp.json', {
    realpath: () => {
      const error = new Error('no such file or directory');
      error.code = 'ENOENT';
      throw error;
    },
    readLink: () => null,
  });

  assert.equal(resolved, '/home/u/.cursor/mcp.json');
});

test('resolveWriteTargetPath propagates unexpected filesystem failures', () => {
  assert.throws(
    () => resolveWriteTargetPath('/home/u/.mcp.json', {
      realpath: () => {
        const error = new Error('permission denied');
        error.code = 'EACCES';
        throw error;
      },
    }),
    /permission denied/,
    'Expected a non-ENOENT failure to surface rather than silently writing to the unresolved path.'
  );
});

test('mergeJsonMcpConfig creates a config when none exists', () => {
  const result = mergeJsonMcpConfig(null, {
    serversKey: 'mcpServers',
    serverName: 'think',
    entry: { command: 'node', args: ['/opt/think/bin/think-mcp.js'] },
  });

  assert.equal(result.action, 'created');
  assert.deepEqual(result.config, {
    mcpServers: {
      think: { command: 'node', args: ['/opt/think/bin/think-mcp.js'] },
    },
  });
});

test('mergeJsonMcpConfig preserves unrelated servers and untouched top level keys', () => {
  const existing = {
    numStartups: 12,
    mcpServers: {
      graft: { command: 'npx', args: ['-y', '@flyingrobots/graft', 'serve'] },
    },
  };

  const result = mergeJsonMcpConfig(existing, {
    serversKey: 'mcpServers',
    serverName: 'think',
    entry: { command: 'node', args: ['/opt/think/bin/think-mcp.js'] },
  });

  assert.equal(result.action, 'added');
  assert.deepEqual(result.config, {
    numStartups: 12,
    mcpServers: {
      graft: { command: 'npx', args: ['-y', '@flyingrobots/graft', 'serve'] },
      think: { command: 'node', args: ['/opt/think/bin/think-mcp.js'] },
    },
  });
  assert.deepEqual(existing.mcpServers, {
    graft: { command: 'npx', args: ['-y', '@flyingrobots/graft', 'serve'] },
  }, 'Expected the merge to leave the caller-owned object untouched.');
});

test('mergeJsonMcpConfig is idempotent when the desired entry already matches', () => {
  const entry = { command: 'node', args: ['/opt/think/bin/think-mcp.js'] };
  const existing = { mcpServers: { think: { ...entry } } };

  const result = mergeJsonMcpConfig(existing, {
    serversKey: 'mcpServers',
    serverName: 'think',
    entry,
  });

  assert.equal(result.action, 'unchanged');
});

test('mergeJsonMcpConfig replaces a stale Think entry without touching neighbors', () => {
  const existing = {
    mcpServers: {
      think: { command: 'node', args: ['/old/path/think-mcp.js'] },
      graft: { command: 'npx', args: ['-y', '@flyingrobots/graft', 'serve'] },
    },
  };

  const result = mergeJsonMcpConfig(existing, {
    serversKey: 'mcpServers',
    serverName: 'think',
    entry: {
      command: 'node',
      args: ['/opt/think/bin/think-mcp.js'],
      env: { THINK_REPO_DIR: '/home/u/.think/claude' },
    },
  });

  assert.equal(result.action, 'updated');
  assert.deepEqual(result.config.mcpServers.think, {
    command: 'node',
    args: ['/opt/think/bin/think-mcp.js'],
    env: { THINK_REPO_DIR: '/home/u/.think/claude' },
  });
  assert.deepEqual(result.config.mcpServers.graft, {
    command: 'npx',
    args: ['-y', '@flyingrobots/graft', 'serve'],
  });
});

test('mergeJsonMcpConfig refuses a config whose root is not a JSON object', () => {
  // scripts/install-mcp.mjs feeds this the result of JSON.parse, so an array or
  // scalar at the root of ~/.claude.json reaches it in practice. Only the
  // servers-collection guard was covered before; this pins the root guard.
  for (const existing of [[], 'nope', 7, true]) {
    assert.throws(
      () => mergeJsonMcpConfig(existing, {
        serversKey: 'mcpServers',
        serverName: 'think',
        entry: { command: 'node', args: ['/opt/think/bin/think-mcp.js'] },
      }),
      /Expected the existing MCP config to be a JSON object/,
      `Expected ${JSON.stringify(existing)} to be refused rather than overwritten.`
    );
  }
});

test('mergeJsonMcpConfig treats an explicit null config as absent, not malformed', () => {
  const result = mergeJsonMcpConfig(null, {
    serversKey: 'mcpServers',
    serverName: 'think',
    entry: { command: 'node', args: ['/opt/think/bin/think-mcp.js'] },
  });

  assert.equal(result.action, 'created');
});

test('mergeJsonMcpConfig refuses to clobber a non-object servers collection', () => {
  assert.throws(
    () => mergeJsonMcpConfig({ mcpServers: [] }, {
      serversKey: 'mcpServers',
      serverName: 'think',
      entry: { command: 'node', args: ['/opt/think/bin/think-mcp.js'] },
    }),
    /Expected "mcpServers" to be an object/
  );
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

test('mergeCodexTomlConfig escapes quotes and backslashes in paths', () => {
  const result = mergeCodexTomlConfig('', {
    serversKey: 'mcp_servers',
    serverName: 'think',
    entry: { command: 'node', args: ['C:\\think\\bin\\think-mcp.js'] },
  });

  assert.match(result.text, /args = \["C:\\\\think\\\\bin\\\\think-mcp\.js"\]/);
});
