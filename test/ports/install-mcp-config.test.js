import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  buildStagedConfigPath,
  buildThinkMcpServerEntry,
  findTomlStructuralProblem,
  listInstallMcpClients,
  mergeJsonMcpConfig,
  parseInstallMcpArgs,
  planInstallMcpTarget,
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

test('parseInstallMcpArgs accepts the server names people legitimately use', () => {
  for (const name of ['think', 'codex-think', 'claude_think', 'Think2']) {
    assert.equal(
      parseInstallMcpArgs(['--client=codex', '--server-name', name]).serverName,
      name,
      `Expected "${name}" to be a valid server name.`
    );
  }
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

test('buildThinkMcpServerEntry pins cwd for a project-scoped entry', () => {
  // A client that launches the server from an unrelated directory makes ambient
  // remember resolve the wrong project — or none. The repo's own .mcp.json gives
  // every server an explicit cwd for exactly this reason.
  const entry = buildThinkMcpServerEntry({
    nodePath: '/usr/local/bin/node',
    serverPath: '/opt/think/bin/think-mcp.js',
    cwd: '/home/u/git/project',
  });

  assert.equal(entry.cwd, '/home/u/git/project');
});

test('buildThinkMcpServerEntry omits cwd when none is requested', () => {
  const entry = buildThinkMcpServerEntry({
    nodePath: '/usr/local/bin/node',
    serverPath: '/opt/think/bin/think-mcp.js',
  });

  assert.equal(Object.hasOwn(entry, 'cwd'), false, 'A user-scope entry has no single project to bind to.');
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

test('mergeJsonMcpConfig reports added for a name that collides with a prototype key', () => {
  // TOML bare keys permit `constructor` and `toString`, so a permitted custom
  // server name can collide with Object.prototype. A bracket lookup then sees the
  // inherited value as an existing server and reports "updated" for a collection
  // that is actually empty, in both text and --json output.
  for (const serverName of ['constructor', 'toString', 'valueOf']) {
    const result = mergeJsonMcpConfig({ mcpServers: {} }, {
      serversKey: 'mcpServers',
      serverName,
      entry: { command: '/usr/local/bin/node', args: ['/opt/think/bin/think-mcp.js'] },
    });

    assert.equal(result.action, 'added', `Expected "${serverName}" to be reported as added, not updated.`);
  }
});

test('mergeJsonMcpConfig still reports updated when such a name genuinely exists', () => {
  const result = mergeJsonMcpConfig({ mcpServers: { constructor: { command: 'old' } } }, {
    serversKey: 'mcpServers',
    serverName: 'constructor',
    entry: { command: '/usr/local/bin/node', args: ['/opt/think/bin/think-mcp.js'] },
  });

  assert.equal(result.action, 'updated');
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

test('a table header inside a multi-line string is not treated as a table', () => {
  const q = '"';
  // Otherwise the merge could rewrite text that only looks like a header.
  const text = `[mcp_servers.think]\ncommand = ${q}node${q}\nnote = ${q.repeat(3)}\n[mcp_servers.think]\n${q.repeat(3)}\n`;

  assert.equal(
    findTomlStructuralProblem(text),
    null,
    'Expected a bracketed line inside a multi-line string not to count as a duplicate table.'
  );
});

