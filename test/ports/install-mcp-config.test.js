import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildThinkMcpServerEntry,
  listInstallMcpClients,
  mergeCodexTomlConfig,
  mergeJsonMcpConfig,
  parseInstallMcpArgs,
  planInstallMcpTarget,
  resolveMindRepoDir,
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

test('buildThinkMcpServerEntry pins an absolute server path and omits env when no mind is selected', () => {
  const entry = buildThinkMcpServerEntry({ serverPath: '/opt/think/bin/think-mcp.js' });

  assert.deepEqual(entry, {
    command: 'node',
    args: ['/opt/think/bin/think-mcp.js'],
  });
});

test('buildThinkMcpServerEntry routes a mind through THINK_REPO_DIR', () => {
  const entry = buildThinkMcpServerEntry({
    serverPath: '/opt/think/bin/think-mcp.js',
    repoDir: '/home/u/.think/claude',
  });

  assert.deepEqual(entry, {
    command: 'node',
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

test('mergeCodexTomlConfig escapes quotes and backslashes in paths', () => {
  const result = mergeCodexTomlConfig('', {
    serversKey: 'mcp_servers',
    serverName: 'think',
    entry: { command: 'node', args: ['C:\\think\\bin\\think-mcp.js'] },
  });

  assert.match(result.text, /args = \["C:\\\\think\\\\bin\\\\think-mcp\.js"\]/);
});
