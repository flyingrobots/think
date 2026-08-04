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

  // A recognised option token is never a value. `--mind --print` used to take the
  // flag as the mind name, which silently disabled preview and wrote the live
  // config pointing at ~/.think/--print. A value that merely starts with a dash,
  // such as a relative path, is still accepted.
  if (args.length === 0 || isOptionToken(args[0])) {
    throw new ValidationError(`Missing value for --${flag}`);
  }

  return { flag, value: args.shift() };
}

function isOptionToken(token) {
  return Object.hasOwn(BOOLEAN_FLAGS, token)
    || /^--(client|scope|dir|mind|repo-dir|server-name)(=|$)/u.test(token);
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

/**
 * One scanner that actually models TOML string syntax.
 *
 * Three independent ad-hoc scanners used to treat every quote as a delimiter,
 * which fabricated "unterminated string" for `\"` escapes and for `"""` / `'''`
 * multi-line strings. scripts/install-mcp.mjs turns any report into a hard
 * refusal, so a user whose config merely contained an escaped quote was blocked
 * from installing — the checker broke more than it protected.
 *
 * Scanning once per document instead removes that whole class: every consumer
 * (comment stripping, delimiter balance, table-header detection) reads the same
 * string-aware view.
 *
 * Returns { lines } where each line carries its raw text, its code-only text
 * (strings and comments removed) and whether it began outside any string, or
 * { problem } for a defect this scanner can actually prove.
 */
function scanTomlDocument(text) {
  const rawLines = String(text ?? '').split('\n');
  const lines = [];
  let multiline = null;

  for (const [index, raw] of rawLines.entries()) {
    const startsOutsideString = multiline === null;
    const scanned = scanTomlLine(raw, multiline, index + 1);
    if (scanned.problem) {
      return { problem: scanned.problem };
    }

    ({ multiline } = scanned);
    lines.push({ raw, code: scanned.code, startsOutsideString });
  }

  if (multiline !== null) {
    return { problem: 'unterminated multi-line string' };
  }

  return { lines };
}

const MULTILINE_BASIC = '"""';
const MULTILINE_LITERAL = "'''";

function scanTomlLine(raw, multiline, lineNumber) {
  const state = { code: '', index: 0, open: multiline };

  while (state.index < raw.length) {
    const step = state.open === null
      ? stepOutsideString(raw, state, lineNumber)
      : stepInsideMultiline(raw, state);

    if (step?.problem) {
      return step;
    }
    if (step?.endOfLine) {
      break;
    }
  }

  return { code: state.code, multiline: state.open };
}

/** Advance through the body of an open multi-line string. */
function stepInsideMultiline(raw, state) {
  const closer = state.open === 'basic' ? MULTILINE_BASIC : MULTILINE_LITERAL;
  if (raw.startsWith(closer, state.index)) {
    state.open = null;
    state.index += closer.length;
    return null;
  }

  // Only a basic string honours escapes; a literal string has none.
  state.index += state.open === 'basic' && raw[state.index] === '\\' ? 2 : 1;
  return null;
}

/** Advance through code, entering strings and stopping at a comment. */
function stepOutsideString(raw, state, lineNumber) {
  const character = raw[state.index];
  if (character === '#') {
    return { endOfLine: true };
  }

  for (const [delimiter, kind] of [[MULTILINE_BASIC, 'basic'], [MULTILINE_LITERAL, 'literal']]) {
    if (raw.startsWith(delimiter, state.index)) {
      state.open = kind;
      state.index += delimiter.length;
      return null;
    }
  }

  if (character === '"' || character === "'") {
    const end = skipSingleLineString(raw, state.index, character);
    if (end === -1) {
      return { problem: `unterminated string on line ${String(lineNumber)}` };
    }
    state.index = end;
    return null;
  }

  state.code += character;
  state.index += 1;
  return null;
}

/**
 * Index just past a single-line string, or -1 when it never closes. A basic
 * string honours backslash escapes; a literal string is taken verbatim, so a
 * `"` inside `'...'` is ordinary text.
 */
function skipSingleLineString(raw, start, quote) {
  let index = start + 1;

  while (index < raw.length) {
    if (quote === '"' && raw[index] === '\\') {
      index += 2;
      continue;
    }
    if (raw[index] === quote) {
      return index + 1;
    }
    index += 1;
  }

  return -1;
}

/**
 * Refuse when the server is already defined as a key inside its parent table.
 *
 * `[mcp_servers]` followed by `think = { ... }` declares `mcp_servers.think`
 * without a header of its own, so header matching finds nothing and the merge
 * appends `[mcp_servers.think]` — declaring the same key twice and making the
 * whole file unparseable, while the installer reported success. Rewriting an
 * inline table in place is more than this module can do safely, so it refuses and
 * says why rather than guessing.
 */
function assertNoInlineDefinition(text, serversKey, serverName) {
  const scanned = scanTomlDocument(text);
  if (scanned.problem) {
    return;
  }

  let inParentTable = false;
  const assignment = new RegExp(`^\\s*${serverName}\\s*=`, 'u');

  for (const line of scanned.lines) {
    const header = line.startsOutsideString ? parseTomlTableHeader(line.raw) : null;
    if (header) {
      inParentTable = header.length === 1 && header[0] === serversKey;
      continue;
    }
    if (inParentTable && assignment.test(line.code)) {
      throw new ValidationError(
        `${serversKey}.${serverName} is already defined inline under [${serversKey}]. `
        + 'Remove that entry or edit it by hand; appending a table would declare the same key twice.'
      );
    }
  }
}

/**
 * Conservative structural check for a TOML document.
 *
 * Deliberately not a full parser — this module has no TOML dependency — so it
 * reports only what it can prove: an unterminated string, unbalanced brackets or
 * braces, and a table declared twice. Anything it cannot prove is silence rather
 * than a refusal, because scripts/install-mcp.mjs turns any report into a hard
 * refusal of the user's own file.
 *
 * Returns null when nothing suspect was found, or a human-readable reason.
 */
export function findTomlStructuralProblem(text) {
  const scanned = scanTomlDocument(text);
  if (scanned.problem) {
    return scanned.problem;
  }

  const state = { headers: new Map(), depth: 0, braces: 0 };
  for (const [index, line] of scanned.lines.entries()) {
    const problem = inspectTomlLine(state, line, index + 1);
    if (problem) {
      return problem;
    }
  }

  if (state.depth !== 0) {
    return 'unterminated array';
  }
  return state.braces === 0 ? null : 'unterminated inline table';
}

function inspectTomlLine(state, line, lineNumber) {
  if (line.code.trim() === '') {
    return null;
  }

  // A bracketed line opens a table only when it began outside any string;
  // otherwise it is text that merely looks like a header.
  const header = line.startsOutsideString ? parseTomlTableHeader(line.raw) : null;
  if (header) {
    return recordTomlHeader(state, header, lineNumber);
  }

  state.depth += countCharacter(line.code, '[') - countCharacter(line.code, ']');
  state.braces += countCharacter(line.code, '{') - countCharacter(line.code, '}');

  return state.depth < 0 || state.braces < 0
    ? `unbalanced bracket on line ${String(lineNumber)}`
    : null;
}

function recordTomlHeader(state, header, lineNumber) {
  const key = header.join('\u0000');
  const seenAt = state.headers.get(key);
  if (seenAt) {
    return `table [${header.join('.')}] declared twice, on lines ${String(seenAt)} and ${String(lineNumber)}`;
  }

  state.headers.set(key, lineNumber);
  return null;
}

function countCharacter(code, target) {
  let total = 0;
  for (const character of code) {
    if (character === target) {
      total += 1;
    }
  }
  return total;
}

export function mergeCodexTomlConfig(existing, { serversKey, serverName, entry }) {
  assertTomlBareKey(serverName, 'serverName');

  const text = String(existing ?? '');
  assertNoInlineDefinition(text, serversKey, serverName);
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
    // Interpolated raw into the inline table, exactly like the server name, so it
    // needs the same guard: a key carrying a quote or newline yields a config no
    // TOML parser will read, disabling every server in the file.
    const pairs = Object.entries(entry.env)
      .map(([key, value]) => {
        assertTomlBareKey(key, 'env key');
        return `${key} = ${toTomlString(value)}`;
      })
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

const TOML_STRING_ESCAPES = Object.freeze({
  '\b': '\\b',
  '\t': '\\t',
  '\n': '\\n',
  '\f': '\\f',
  '\r': '\\r',
});

/**
 * Render a TOML basic string.
 *
 * Control characters cannot appear literally in a basic string. Paths may
 * legally contain them on POSIX, and emitting one raw invalidates the whole
 * config — which disables every server in the file, not just Think's. Escape the
 * ones TOML names, and any other control character as \\uXXXX.
 */
function toTomlString(value) {
  const escaped = String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    // eslint-disable-next-line no-control-regex -- escaping control characters is the point
    .replace(/[\u0000-\u001f\u007f]/gu, (character) => (
      TOML_STRING_ESCAPES[character]
        ?? `\\u${character.codePointAt(0).toString(16).padStart(4, '0')}`
    ));

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
