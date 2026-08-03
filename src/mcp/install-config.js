import path from 'node:path';

import { ValidationError } from '../errors.js';

const CODEX_STARTUP_TIMEOUT_SEC = 60;

/**
 * A TOML bare key: the only shape safe to interpolate into a table header.
 *
 * Server names reach `[${serversKey}.${serverName}]` unquoted. Anything outside
 * this class can close the header and append caller-chosen TOML — including a
 * second server with its own `command`, which the client executes on startup.
 * Whitespace-padded names are rejected too: TOML tolerates them around dotted
 * key parts, so they parse but resolve to a *different* key than the literal
 * header text, which breaks block matching and yields a duplicate table.
 */
const TOML_BARE_KEY = /^[A-Za-z0-9_-]+$/u;

function assertAbsolutePath(value, label) {
  if (!value || !path.isAbsolute(value)) {
    throw new ValidationError(`${label} must be an absolute path, got ${JSON.stringify(value)}`);
  }
}

function assertTomlBareKey(value, label) {
  if (typeof value !== 'string' || !TOML_BARE_KEY.test(value)) {
    throw new ValidationError(
      `${label} must be a TOML bare key (letters, digits, underscore, hyphen), got ${JSON.stringify(value)}`
    );
  }
}
const DEFAULT_SERVER_NAME = 'think';
const DEFAULT_MIND_DIRECTORY = 'repo';
const DEFAULT_MIND_NAME = 'default';

/**
 * Every supported MCP client, keyed by the `--client` id.
 *
 * `user` scope is listed first for every client that supports it because a
 * Think mind is a single durable archive under `~/.think`, not a per-repo
 * artifact. Project scope exists for teams that want the wiring committed.
 */
const CLIENTS = Object.freeze({
  'claude-code': Object.freeze({
    id: 'claude-code',
    label: 'Claude Code',
    format: 'json',
    serversKey: 'mcpServers',
    userFile: Object.freeze(['.claude.json']),
    projectFile: Object.freeze(['.mcp.json']),
  }),
  codex: Object.freeze({
    id: 'codex',
    label: 'Codex CLI',
    format: 'toml',
    serversKey: 'mcp_servers',
    userFile: Object.freeze(['.codex', 'config.toml']),
    projectFile: Object.freeze(['.codex', 'config.toml']),
  }),
  cursor: Object.freeze({
    id: 'cursor',
    label: 'Cursor',
    format: 'json',
    serversKey: 'mcpServers',
    userFile: Object.freeze(['.cursor', 'mcp.json']),
    projectFile: Object.freeze(['.cursor', 'mcp.json']),
  }),
  vscode: Object.freeze({
    id: 'vscode',
    label: 'VS Code (Copilot agent mode)',
    format: 'json',
    serversKey: 'servers',
    userFile: null,
    projectFile: Object.freeze(['.vscode', 'mcp.json']),
  }),
  windsurf: Object.freeze({
    id: 'windsurf',
    label: 'Windsurf',
    format: 'json',
    serversKey: 'mcpServers',
    userFile: Object.freeze(['.codeium', 'windsurf', 'mcp_config.json']),
    projectFile: null,
  }),
});

export function listInstallMcpClients() {
  return Object.values(CLIENTS).map((client) => Object.freeze({
    id: client.id,
    label: client.label,
    format: client.format,
    scopes: supportedScopes(client),
  }));
}

/**
 * Look up a client definition by id.
 *
 * `Object.hasOwn` matters here: `CLIENTS` is a plain object, so an id like
 * `toString` would otherwise resolve to an inherited function and skip the
 * unknown-client branch, producing "toString does not support user scope" with
 * an empty scope list instead of a real error.
 */
function findClient(client) {
  return Object.hasOwn(CLIENTS, client) ? CLIENTS[client] : null;
}

function supportedScopes(definition) {
  return Object.freeze([
    ...(definition.userFile ? ['user'] : []),
    ...(definition.projectFile ? ['project'] : []),
  ]);
}

const BOOLEAN_FLAGS = Object.freeze({
  '--help': 'help',
  '-h': 'help',
  '--list': 'list',
  '--print': 'print',
  '--dry-run': 'print',
  '--json': 'json',
});

export function parseInstallMcpArgs(argv) {
  const args = [...argv];
  const parsed = createDefaultArgs();

  while (args.length > 0) {
    const arg = args.shift();
    const booleanFlag = Object.hasOwn(BOOLEAN_FLAGS, arg) ? BOOLEAN_FLAGS[arg] : null;

    if (booleanFlag) {
      parsed[booleanFlag] = true;
      continue;
    }

    const option = readOption(arg, args);
    if (!option) {
      throw new ValidationError(`Unknown argument: ${arg}`);
    }
    applyOption(parsed, option);
  }

  if (parsed.help || parsed.list) {
    return Object.freeze(parsed);
  }

  return Object.freeze(validateParsedArgs(parsed));
}

function createDefaultArgs() {
  return {
    client: null,
    scope: 'user',
    dir: null,
    mind: null,
    repoDir: null,
    serverName: DEFAULT_SERVER_NAME,
    print: false,
    json: false,
    list: false,
    help: false,
  };
}

function readOption(arg, args) {
  const named = /^--(client|scope|dir|mind|repo-dir|server-name)(?:=(.*))?$/u.exec(arg);
  if (!named) {
    return null;
  }

  const [, flag, inlineValue] = named;
  if (inlineValue !== undefined) {
    return { flag, value: inlineValue };
  }
  if (args.length === 0) {
    throw new ValidationError(`Missing value for --${flag}`);
  }

  return { flag, value: args.shift() };
}

function applyOption(parsed, { flag, value }) {
  if (flag === 'client') {
    parsed.client = value;
    return;
  }
  if (flag === 'scope') {
    parsed.scope = value;
    return;
  }
  if (flag === 'dir') {
    parsed.dir = value;
    return;
  }
  if (flag === 'mind') {
    parsed.mind = value;
    return;
  }
  if (flag === 'repo-dir') {
    parsed.repoDir = value;
    return;
  }
  parsed.serverName = value;
}

function validateParsedArgs(parsed) {
  if (!parsed.client) {
    throw new ValidationError('--client is required. Run with --list to see supported clients.');
  }
  if (!findClient(parsed.client)) {
    const supported = Object.keys(CLIENTS).join(', ');
    throw new ValidationError(`Unknown client "${parsed.client}". Supported clients: ${supported}`);
  }
  if (parsed.scope !== 'user' && parsed.scope !== 'project') {
    throw new ValidationError(`--scope must be user or project, got ${parsed.scope}`);
  }
  if (parsed.mind && parsed.repoDir) {
    throw new ValidationError('--mind and --repo-dir are mutually exclusive.');
  }
  assertTomlBareKey(parsed.serverName, '--server-name');

  return parsed;
}

export function resolveMindRepoDir(mind, thinkDir) {
  const name = String(mind ?? '').trim();
  if (name === '' || name !== path.basename(name) || name === '.' || name === '..') {
    throw new ValidationError(`Mind name must be a single path segment, got "${mind}"`);
  }

  const directory = name === DEFAULT_MIND_NAME ? DEFAULT_MIND_DIRECTORY : name;
  return path.join(thinkDir, directory);
}

/**
 * Build the MCP server entry a client will launch.
 *
 * `nodePath` records the interpreter that ran the installer rather than a bare
 * `node`. A bare command only resolves if the client's PATH contains one, and
 * GUI-launched clients and version managers such as nvm or asdf routinely do
 * not — the server then fails to start with nothing indicating why. The
 * trade-off is that the recorded path is version-specific for those managers,
 * so re-running the installer after a Node upgrade is what repairs it.
 */
export function buildThinkMcpServerEntry({ nodePath, serverPath, repoDir = null, cwd = null }) {
  assertAbsolutePath(nodePath, 'nodePath');
  assertAbsolutePath(serverPath, 'serverPath');

  const entry = {
    command: nodePath,
    args: [serverPath],
  };

  // Project scope pins cwd so ambient recall resolves this project. User scope
  // has no single project to bind to and leaves it to the client.
  if (cwd) {
    entry.cwd = cwd;
  }

  if (repoDir) {
    entry.env = { THINK_REPO_DIR: repoDir };
  }

  return entry;
}

export function planInstallMcpTarget({ client, scope, home, dir }) {
  const definition = findClient(client);
  if (!definition) {
    const supported = Object.keys(CLIENTS).join(', ');
    throw new ValidationError(`Unknown client "${client}". Supported clients: ${supported}`);
  }

  const segments = scope === 'user' ? definition.userFile : definition.projectFile;
  if (!segments) {
    throw new ValidationError(
      `${client} does not support ${scope} scope. Supported scopes: ${supportedScopes(definition).join(', ')}`
    );
  }

  const base = scope === 'user' ? home : dir;
  return {
    file: path.join(base, ...segments),
    format: definition.format,
    serversKey: definition.serversKey,
  };
}

/**
 * Resolve the path a merged config should actually be written to.
 *
 * Dotfiles setups commonly symlink `~/.claude.json`, `~/.cursor/mcp.json` or
 * `~/.codex/config.toml` into a tracked repository. Staging a replacement
 * beside the link and renaming over it would swap the link for a regular file
 * and leave the tracked source untouched — the requested configuration would
 * never take effect even though the install reported success. Resolving the
 * link first keeps the write atomic *and* lands it on the real file.
 *
 * A config that does not exist yet keeps its requested path. Any other
 * filesystem failure propagates rather than being written around.
 */
export function resolveWriteTargetPath(file, { realpath, readLink }) {
  try {
    return realpath(file);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  // ENOENT covers two different situations: nothing is there at all, or a
  // symlink is there but its target has not been created yet. A dangling link
  // still points somewhere deliberate, so writing to the link path would
  // replace it with a regular file — the breakage this function exists to avoid.
  const linkTarget = readLink(file);
  if (!linkTarget) {
    return file;
  }

  return path.resolve(path.dirname(file), linkTarget);
}

/**
 * Name the temporary file a merged config is staged in before being renamed.
 *
 * The name must be unique per attempt. A predictable staged path is a hazard on
 * a shared-home or multi-user box: an attacker can pre-create it as a symlink
 * and redirect the write, or leave a stale file whose looser permissions the
 * rename then moves onto the live config. Callers pair this with an exclusive
 * create so a name that somehow already exists fails rather than being reused.
 */
export function buildStagedConfigPath(file, { pid, nonce }) {
  const directory = path.dirname(file);
  const base = path.basename(file);

  return path.join(directory, `.${base}.think-install.${String(pid)}.${nonce}.tmp`);
}

export function mergeJsonMcpConfig(existing, { serversKey, serverName, entry }) {
  const source = normalizeExistingJsonConfig(existing);
  const servers = readServersCollection(source, serversKey);
  // Own-property check: a permitted name such as `constructor` would otherwise
  // resolve an inherited Object.prototype member and look like an existing server.
  const previous = servers && Object.hasOwn(servers, serverName) ? servers[serverName] : undefined;
  const action = resolveJsonAction({ source, previous, entry });

  if (action === 'unchanged') {
    return Object.freeze({ action, config: source });
  }

  return Object.freeze({
    action,
    config: {
      ...source,
      [serversKey]: {
        ...servers,
        [serverName]: entry,
      },
    },
  });
}

function normalizeExistingJsonConfig(existing) {
  if (existing === null || existing === undefined) {
    return null;
  }
  if (!isPlainObject(existing)) {
    throw new ValidationError('Expected the existing MCP config to be a JSON object.');
  }
  return existing;
}

function readServersCollection(source, serversKey) {
  const servers = source ? source[serversKey] : undefined;
  if (servers !== undefined && !isPlainObject(servers)) {
    throw new ValidationError(`Expected "${serversKey}" to be an object in the existing MCP config.`);
  }
  return servers;
}

function resolveJsonAction({ source, previous, entry }) {
  if (!source) {
    return 'created';
  }
  if (previous === undefined) {
    return 'added';
  }
  return deepEqual(previous, entry) ? 'unchanged' : 'updated';
}

export function mergeCodexTomlConfig(existing, { serversKey, serverName, entry }) {
  assertTomlBareKey(serverName, 'serverName');

  const text = String(existing ?? '');
  const block = renderCodexTomlBlock({ serversKey, serverName, entry });
  const found = findTomlBlock(text, [serversKey, serverName]);

  if (!found) {
    return Object.freeze({
      action: text.trim() === '' ? 'created' : 'added',
      text: text.trim() === '' ? block : `${text.replace(/\n*$/u, '')}\n\n${block}`,
    });
  }

  const tail = text.slice(found.end);
  const desired = tail.trim() === '' ? block : `${block}\n`;

  return Object.freeze({
    action: text.slice(found.start, found.end) === desired ? 'unchanged' : 'updated',
    text: `${text.slice(0, found.start)}${desired}${tail}`,
  });
}

export function renderCodexTomlBlock({ serversKey, serverName, entry }) {
  // Exported boundary: cannot assume the CLI parser validated this.
  assertTomlBareKey(serverName, 'serverName');

  const lines = [
    `[${serversKey}.${serverName}]`,
    `command = ${toTomlString(entry.command)}`,
    `args = [${entry.args.map(toTomlString).join(', ')}]`,
  ];

  if (entry.env) {
    const pairs = Object.entries(entry.env)
      .map(([key, value]) => `${key} = ${toTomlString(value)}`)
      .join(', ');
    lines.push(`env = { ${pairs} }`);
  }

  lines.push(`startup_timeout_sec = ${String(CODEX_STARTUP_TIMEOUT_SEC)}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Locate a TOML table block by header line. The block runs from the header up
 * to the next line that opens an *unrelated* table, so neighbouring tables
 * survive a rewrite.
 *
 * Nested tables of the same server are absorbed into the block. A hand-written
 * config may express the environment as `[mcp_servers.think.env]` rather than
 * the inline table this module renders; leaving that sub-table behind would
 * declare `env` twice and make the whole file invalid TOML, breaking every
 * server in it rather than just Think's entry.
 */
function findTomlBlock(text, keyPath) {
  const lines = text.split('\n');
  const headerIndex = lines.findIndex((line) => isTableHeaderFor(line, keyPath, { exact: true }));
  if (headerIndex === -1) {
    return null;
  }

  let endIndex = lines.length;
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    if (!looksLikeTableHeader(lines[index])) {
      continue;
    }
    if (isTableHeaderFor(lines[index], keyPath, { exact: false })) {
      continue;
    }
    endIndex = index;
    break;
  }

  const start = offsetOfLine(lines, headerIndex);
  const end = offsetOfLine(lines, endIndex);
  return { start, end };
}

function looksLikeTableHeader(line) {
  return line.trimStart().startsWith('[');
}

/**
 * Does this line open the table at `keyPath` (`exact`), or one nested beneath it?
 *
 * TOML lets the same table be spelled several ways — `[mcp_servers.think]`,
 * `[mcp_servers."think"]`, `[mcp_servers . think]` — so comparing header text
 * literally missed real matches and appended a second table for the same key,
 * which makes the whole file invalid rather than just Think's entry.
 */
function isTableHeaderFor(line, keyPath, { exact }) {
  const parts = parseTomlTableHeader(line);
  if (!parts) {
    return false;
  }
  if (exact ? parts.length !== keyPath.length : parts.length <= keyPath.length) {
    return false;
  }

  return keyPath.every((part, index) => parts[index] === part);
}

/**
 * Split a TOML table header into its key parts, or null when the line is not a
 * plain table header this module is prepared to reason about.
 *
 * Array-of-tables headers and quoted parts carrying escape sequences return
 * null: they are not shapes this module writes, and guessing at them risks
 * rewriting the wrong table.
 */
function parseTomlTableHeader(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('[') || trimmed.startsWith('[[')) {
    return null;
  }

  // TOML permits a comment after the closing bracket, so the header does not
  // necessarily end the line. Find the bracket that actually closes it, ignoring
  // brackets inside quoted key parts, and allow only a comment to follow.
  const closingIndex = findHeaderClose(trimmed);
  if (closingIndex === -1) {
    return null;
  }

  const trailing = trimmed.slice(closingIndex + 1).trim();
  if (trailing !== '' && !trailing.startsWith('#')) {
    return null;
  }

  const parts = splitTopLevelDots(trimmed.slice(1, closingIndex));
  if (!parts) {
    return null;
  }

  const unquoted = parts.map((part) => unquoteTomlKeyPart(part.trim()));
  return unquoted.some((part) => part === null) ? null : unquoted;
}

/**
 * Index of the bracket that closes a table header, ignoring brackets that sit
 * inside quoted key parts. Returns -1 when the header is never closed.
 */
function findHeaderClose(trimmed) {
  let quote = null;

  for (let index = 1; index < trimmed.length; index += 1) {
    const character = trimmed[index];
    if (quote) {
      if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === ']') {
      return index;
    }
  }

  return -1;
}

function splitTopLevelDots(inner) {
  const state = { parts: [], current: '', quote: null };

  for (const character of inner) {
    consumeHeaderCharacter(state, character);
  }

  if (state.quote) {
    return null;
  }

  state.parts.push(state.current);
  return state.parts;
}

function consumeHeaderCharacter(state, character) {
  if (state.quote) {
    if (character === state.quote) {
      state.quote = null;
    }
    state.current += character;
    return;
  }

  if (character === '"' || character === "'") {
    state.quote = character;
    state.current += character;
    return;
  }

  if (character === '.') {
    state.parts.push(state.current);
    state.current = '';
    return;
  }

  state.current += character;
}

function unquoteTomlKeyPart(part) {
  if (isQuotedKeyPart(part)) {
    const inner = part.slice(1, -1);
    return inner.includes('\\') ? null : inner;
  }

  return TOML_BARE_KEY.test(part) ? part : null;
}

function isQuotedKeyPart(part) {
  if (part.length < 2) {
    return false;
  }

  const quote = part[0];
  return (quote === '"' || quote === "'") && part.endsWith(quote);
}

function offsetOfLine(lines, lineIndex) {
  let offset = 0;
  for (let index = 0; index < lineIndex && index < lines.length; index += 1) {
    offset += lines[index].length + 1;
  }
  return offset;
}

function toTomlString(value) {
  const escaped = String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"');
  return `"${escaped}"`;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepEqual(left, right) {
  return JSON.stringify(normalizeForCompare(left)) === JSON.stringify(normalizeForCompare(right));
}

function normalizeForCompare(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeForCompare);
  }
  if (!isPlainObject(value)) {
    return value;
  }

  const normalized = {};
  for (const key of Object.keys(value).sort()) {
    normalized[key] = normalizeForCompare(value[key]);
  }
  return normalized;
}
