#!/usr/bin/env node

/**
 * Wire the Think MCP server into an agent client's config.
 *
 * Pure decisions (argument parsing, path planning, config merging) live in
 * src/mcp/install-config.js. This file is the IO shell: it reads the existing
 * config, applies the merge, and writes the result back.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildThinkMcpServerEntry,
  listInstallMcpClients,
  mergeCodexTomlConfig,
  mergeJsonMcpConfig,
  parseInstallMcpArgs,
  planInstallMcpTarget,
  renderCodexTomlBlock,
  resolveMindRepoDir,
} from '../src/mcp/install-config.js';
import { ValidationError } from '../src/errors.js';
import { getHomeDir, getThinkDir } from '../src/paths.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverPath = path.join(repoRoot, 'bin', 'think-mcp.js');

const USAGE = [
  'Usage: npm run install-mcp -- --client=<id> [options]',
  '',
  'Wires the Think MCP server into an agent client config file.',
  '',
  'Options:',
  '  --client=<id>        Target client. Run --list to see supported ids.',
  '  --scope=user|project Config scope. Defaults to user, because a Think mind',
  '                       is one durable archive under ~/.think, not a per-repo file.',
  '  --dir=PATH           Project root for --scope=project. Defaults to the cwd.',
  '  --mind=NAME          Route this client at ~/.think/<NAME> via THINK_REPO_DIR.',
  '                       Use "default" for the shared ~/.think/repo mind.',
  '  --repo-dir=PATH      Route this client at an explicit mind directory.',
  '  --server-name=NAME   MCP server name to register. Defaults to "think".',
  '  --print              Show the config that would be written, then exit.',
  '  --json               Emit a machine-readable result.',
  '  --list               List supported clients and their scopes.',
  '  --help, -h           Show this help.',
  '',
  'Examples:',
  '  npm run install-mcp -- --client=claude-code --mind=claude',
  '  npm run install-mcp -- --client=codex --mind=codex',
  '  npm run install-mcp -- --client=cursor --scope=project --print',
].join('\n');

function main(argv) {
  const options = parseInstallMcpArgs(argv);

  if (options.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  if (options.list) {
    return reportClients(options.json);
  }

  const repoDir = resolveRepoDir(options);
  const entry = buildThinkMcpServerEntry({ serverPath, repoDir });
  const target = planInstallMcpTarget({
    client: options.client,
    scope: options.scope,
    home: getHomeDir(),
    dir: path.resolve(options.dir ?? process.cwd()),
  });

  const merged = mergeTarget({ target, options, entry });

  if (options.print) {
    return reportPlan({ options, target, entry, merged, written: false });
  }

  if (merged.action !== 'unchanged') {
    writeTarget(target, merged);
  }

  return reportPlan({ options, target, entry, merged, written: merged.action !== 'unchanged' });
}

function resolveRepoDir(options) {
  if (options.repoDir) {
    return path.resolve(options.repoDir);
  }
  if (options.mind) {
    return resolveMindRepoDir(options.mind, getThinkDir());
  }
  return null;
}

function mergeTarget({ target, options, entry }) {
  const existing = readTarget(target);

  if (target.format === 'toml') {
    return mergeCodexTomlConfig(existing, {
      serversKey: target.serversKey,
      serverName: options.serverName,
      entry,
    });
  }

  return mergeJsonMcpConfig(existing, {
    serversKey: target.serversKey,
    serverName: options.serverName,
    entry,
  });
}

function readTarget(target) {
  let raw;
  try {
    raw = readFileSync(target.file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return target.format === 'toml' ? '' : null;
    }
    throw error;
  }

  if (target.format === 'toml') {
    return raw;
  }
  if (raw.trim() === '') {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    const failure = new ValidationError(`Could not parse ${target.file} as JSON: ${error.message}`);
    failure.cause = error;
    throw failure;
  }
}

function writeTarget(target, merged) {
  mkdirSync(path.dirname(target.file), { recursive: true });
  const body = target.format === 'toml'
    ? merged.text
    : `${JSON.stringify(merged.config, null, 2)}\n`;
  writeFileSync(target.file, body, 'utf8');
}

function reportClients(json) {
  const clients = listInstallMcpClients();

  if (json) {
    process.stdout.write(`${JSON.stringify({ ok: true, clients }, null, 2)}\n`);
    return 0;
  }

  process.stdout.write('Supported MCP clients:\n');
  for (const client of clients) {
    process.stdout.write(`  ${client.id.padEnd(12)} ${client.label} (${client.scopes.join(', ')})\n`);
  }
  return 0;
}

function reportPlan({ options, target, entry, merged, written }) {
  if (options.json) {
    return reportPlanJson({ options, target, entry, merged, written });
  }
  return reportPlanText({ options, target, entry, merged, written });
}

function reportPlanJson({ options, target, entry, merged, written }) {
  process.stdout.write(`${JSON.stringify({
    ok: true,
    action: merged.action,
    client: options.client,
    file: target.file,
    mind: options.mind,
    repoDir: entry.env?.THINK_REPO_DIR ?? null,
    scope: options.scope,
    serverName: options.serverName,
    written,
  }, null, 2)}\n`);
  return 0;
}

function reportPlanText({ options, target, entry, merged, written }) {
  const verb = written ? describeWrite(merged.action) : 'would write';

  process.stdout.write(`Think MCP server "${options.serverName}" — ${verb} ${target.file}\n`);
  process.stdout.write(`  client: ${options.client} (${options.scope} scope)\n`);
  process.stdout.write(`  mind:   ${entry.env?.THINK_REPO_DIR ?? `${getThinkDir()}/repo (default)`}\n`);

  if (!written) {
    process.stdout.write(`\n${renderPreview({ options, target, entry })}`);
  }
  if (merged.action === 'unchanged') {
    process.stdout.write('\nAlready configured. Nothing to do.\n');
  }
  return 0;
}

function renderPreview({ options, target, entry }) {
  if (target.format === 'toml') {
    return renderCodexTomlBlock({
      serversKey: target.serversKey,
      serverName: options.serverName,
      entry,
    });
  }
  return `${JSON.stringify({ [target.serversKey]: { [options.serverName]: entry } }, null, 2)}\n`;
}

function describeWrite(action) {
  if (action === 'created') {
    return 'created';
  }
  if (action === 'updated') {
    return 'updated in';
  }
  return 'added to';
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
