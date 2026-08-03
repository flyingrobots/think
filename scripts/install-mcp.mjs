#!/usr/bin/env node

/**
 * Wire the Think MCP server into an agent client's config.
 *
 * Pure decisions (argument parsing, path planning, config merging) live in
 * src/mcp/install-config.js. This file is the IO shell: it reads the existing
 * config, applies the merge, and writes the result back.
 */

import { randomBytes } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, readlinkSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ValidationError } from '../src/errors.js';
import {
  buildStagedConfigPath,
  findTomlStructuralProblem,
  buildThinkMcpServerEntry,
  listInstallMcpClients,
  mergeCodexTomlConfig,
  mergeJsonMcpConfig,
  parseInstallMcpArgs,
  planInstallMcpTarget,
  resolveMindRepoDir,
  resolveWriteTargetPath,
} from '../src/mcp/install-config.js';
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
  const projectDir = path.resolve(options.dir ?? process.cwd());
  const entry = buildThinkMcpServerEntry({
    nodePath: process.execPath,
    serverPath,
    repoDir,
    cwd: options.scope === 'project' ? projectDir : null,
  });
  const target = planInstallMcpTarget({
    client: options.client,
    scope: options.scope,
    home: getHomeDir(),
    dir: projectDir,
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
    // The JSON path refuses to merge into a config it cannot parse. Give TOML the
    // same treatment, or a malformed config gets appended to, written, and
    // reported as a success while Codex still cannot load any server.
    assertUsableToml(raw, `${target.file} is not usable TOML`);
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

/**
 * Write the merged config atomically.
 *
 * These targets are live client state — `~/.claude.json` holds a running
 * Claude Code session's configuration. A partial write from an interrupted
 * process would leave truncated JSON or TOML and break the client for every
 * server it configures, so stage the new content beside the target and rename
 * it into place. Rename within a directory is atomic on POSIX and replaces the
 * destination on Windows.
 */
function assertUsableToml(text, label) {
  const problem = findTomlStructuralProblem(text);
  if (problem) {
    throw new ValidationError(`${label}: ${problem}`);
  }
}

function writeTarget(target, merged) {
  // Follow a symlinked config to its real file first, so a dotfiles-managed
  // config keeps its link and actually receives the change.
  const file = resolveWriteTargetPath(target.file, {
    realpath: realpathSync,
    readLink: readSymlinkTarget,
  });
  const directory = path.dirname(file);
  mkdirSync(directory, { recursive: true });

  const body = target.format === 'toml'
    ? merged.text
    : `${JSON.stringify(merged.config, null, 2)}\n`;

  if (target.format === 'toml') {
    assertUsableToml(body, 'refusing to write unusable TOML');
  }

  const staged = buildStagedConfigPath(file, {
    pid: process.pid,
    nonce: randomBytes(6).toString('hex'),
  });

  try {
    // 'wx' creates exclusively: the mode is always applied to a fresh file, and
    // a pre-existing path — including a planted symlink — fails instead of being
    // followed or reused.
    writeFileSync(staged, body, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    renameSync(staged, file);
  } catch (error) {
    rmSync(staged, { force: true });
    throw error;
  }
}

/**
 * Return where a symlink points, or null when the path is not a symlink.
 *
 * Uses lstat so the link itself is inspected rather than followed, which is the
 * whole point when the target does not exist yet.
 */
function readSymlinkTarget(file) {
  try {
    return lstatSync(file).isSymbolicLink() ? readlinkSync(file) : null;
  } catch {
    return null;
  }
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
  process.stdout.write(`Think MCP server "${options.serverName}" — ${describeOutcome(merged.action, options.print)} ${target.file}\n`);
  process.stdout.write(`  client: ${options.client} (${options.scope} scope)\n`);
  const mind = entry.env?.THINK_REPO_DIR ?? `${path.join(getThinkDir(), 'repo')} (default)`;
  process.stdout.write(`  mind:   ${mind}\n`);

  // Only a preview run dumps the config. An already-configured machine has
  // nothing to preview, and printing one alongside "nothing to do" reads as a
  // contradiction.
  if (options.print && merged.action !== 'unchanged') {
    process.stdout.write(`\n${renderPreview({ target, merged })}`);
  }
  if (!written && merged.action !== 'unchanged') {
    process.stdout.write('\nNothing written. Re-run without --print to apply.\n');
  }
  return 0;
}

function describeOutcome(action, print) {
  if (action === 'unchanged') {
    return 'already configured in';
  }
  return print ? 'would write' : describeWrite(action);
}

/**
 * Render exactly what a write would produce.
 *
 * Previewing only the Think entry was misleading for an existing config: the
 * command advertises showing what would be written, but omitted every preserved
 * neighbouring server and top-level key, so the merge itself could not be
 * inspected before allowing a live write.
 */
function renderPreview({ target, merged }) {
  return target.format === 'toml'
    ? merged.text
    : `${JSON.stringify(merged.config, null, 2)}\n`;
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
