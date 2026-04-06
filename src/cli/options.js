import { REFLECT_PROMPT_TYPES } from '../store.js';
import {
  canInteractivelyOpenBrowseShell,
  canInteractivelyPickReflectSeed,
} from './environment.js';

export function parseArgs(args) {
  const positionals = [];
  const options = {
    verbose: false,
    json: false,
    help: false,
    stats: false,
    promptMetrics: false,
    recent: false,
    remember: false,
    ingest: false,
    reflectFlag: false,
    reflect: null,
    reflectMode: null,
    reflectSessionFlag: false,
    reflectSession: null,
    browseFlag: false,
    browse: null,
    inspectFlag: false,
    inspect: null,
    migrateGraph: false,
    from: null,
    to: null,
    since: null,
    bucket: null,
    recentCount: null,
    recentQuery: null,
    rememberLimit: null,
    rememberBrief: false,
    optionError: null,
  };
  let parsingFlags = true;

  for (const arg of args) {
    if (parsingFlags && arg === '--') {
      parsingFlags = false;
      continue;
    }

    if (parsingFlags && arg.startsWith('--')) {
      if (arg === '--verbose') {
        options.verbose = true;
      } else if (arg === '--json') {
        options.json = true;
      } else if (arg === '--help') {
        options.help = true;
      } else if (arg === '--stats') {
        options.stats = true;
      } else if (arg === '--prompt-metrics') {
        options.promptMetrics = true;
      } else if (arg === '--recent') {
        options.recent = true;
      } else if (arg === '--remember') {
        options.remember = true;
      } else if (arg === '--ingest') {
        options.ingest = true;
      } else if (arg === '--brief') {
        options.rememberBrief = true;
      } else if (arg.startsWith('--limit=')) {
        options.rememberLimit = arg.slice('--limit='.length);
      } else if (arg.startsWith('--count=')) {
        options.recentCount = arg.slice('--count='.length);
      } else if (arg.startsWith('--query=')) {
        options.recentQuery = arg.slice('--query='.length);
      } else if (arg.startsWith('--recent-count=')) {
        setOptionError(options, 'Use --count instead of --recent-count');
      } else if (arg.startsWith('--recent-query=')) {
        setOptionError(options, 'Use --query instead of --recent-query');
      } else if (arg === '--browse') {
        options.browseFlag = true;
        options.browse = '';
      } else if (arg.startsWith('--browse=')) {
        options.browseFlag = true;
        options.browse = arg.slice('--browse='.length);
      } else if (arg === '--inspect') {
        options.inspectFlag = true;
        options.inspect = '';
      } else if (arg.startsWith('--inspect=')) {
        options.inspectFlag = true;
        options.inspect = arg.slice('--inspect='.length);
      } else if (arg === '--migrate-graph') {
        options.migrateGraph = true;
      } else if (arg === '--reflect') {
        options.reflectFlag = true;
        options.reflect = '';
      } else if (arg === '--brainstorm') {
        setOptionError(options, 'Use --reflect instead of --brainstorm');
      } else if (arg.startsWith('--brainstorm=')) {
        setOptionError(options, 'Use --reflect=<seedEntryId> instead of --brainstorm=<seedEntryId>');
      } else if (arg.startsWith('--reflect=')) {
        options.reflectFlag = true;
        options.reflect = arg.slice('--reflect='.length);
      } else if (arg.startsWith('--mode=')) {
        options.reflectMode = arg.slice('--mode='.length);
      } else if (arg.startsWith('--brainstorm-mode=')) {
        setOptionError(options, 'Use --mode instead of --brainstorm-mode');
      } else if (arg.startsWith('--reflect-mode=')) {
        setOptionError(options, 'Use --mode instead of --reflect-mode');
      } else if (arg === '--reflect-session') {
        options.reflectSessionFlag = true;
        options.reflectSession = '';
      } else if (arg === '--brainstorm-session') {
        setOptionError(options, 'Use --reflect-session instead of --brainstorm-session');
      } else if (arg.startsWith('--brainstorm-session=')) {
        setOptionError(options, 'Use --reflect-session=<sessionId> instead of --brainstorm-session=<sessionId>');
      } else if (arg.startsWith('--reflect-session=')) {
        options.reflectSessionFlag = true;
        options.reflectSession = arg.slice('--reflect-session='.length);
      } else if (arg.startsWith('--from=')) {
        options.from = arg.split('=')[1];
      } else if (arg.startsWith('--to=')) {
        options.to = arg.split('=')[1];
      } else if (arg.startsWith('--since=')) {
        options.since = arg.split('=')[1];
      } else if (arg.startsWith('--bucket=')) {
        options.bucket = arg.split('=')[1];
      } else {
        setOptionError(options, `Unknown option: ${arg}`);
      }
      continue;
    }

    if (parsingFlags && arg === '-h') {
      options.help = true;
      continue;
    }

    positionals.push(arg);
  }

  return {
    ...options,
    positionals,
  };
}

export function resolveCommand(options) {
  if (options.reflectSessionFlag) {
    return 'reflect_reply';
  }
  if (options.reflectFlag) {
    return 'reflect_start';
  }
  if (options.browseFlag) {
    return 'browse';
  }
  if (options.inspectFlag) {
    return 'inspect';
  }
  if (options.migrateGraph) {
    return 'migrate_graph';
  }
  if (options.ingest) {
    return 'ingest';
  }
  if (options.remember) {
    return 'remember';
  }
  if (options.stats) {
    return 'stats';
  }
  if (options.promptMetrics) {
    return 'prompt_metrics';
  }
  if (options.recent) {
    return 'recent';
  }
  return 'capture';
}

export function validateOptions(options, command) {
  if (options.optionError) {
    return options.optionError;
  }

  const hasTimeFilters = Boolean(options.from || options.to || options.since || options.bucket);
  const hasRememberEnhancement = options.rememberLimit !== null || options.rememberBrief;
  const explicitCommands = countExplicitCommands(options);
  const hasRecentFilter = options.recentCount !== null || options.recentQuery !== null;

  if (explicitCommands > 1) {
    return 'Commands cannot be combined';
  }

  if (options.help) {
    if (explicitCommands === 0 && options.positionals.length > 0) {
      return 'Use explicit command flags with --help, for example think --recent --help';
    }
    return null;
  }

  if (command === 'recent' && options.positionals.length > 0) {
    return '--recent does not take a thought';
  }

  if (command === 'remember' && options.positionals.length > 0 && options.positionals.join(' ').trim() === '') {
    return 'Invalid remember query';
  }

  if (command === 'remember') {
    if (options.rememberLimit !== null && !/^[1-9]\d*$/.test(options.rememberLimit)) {
      return 'Invalid --limit value';
    }
  }

  if (command === 'recent') {
    if (options.recentCount !== null && !/^[1-9]\d*$/.test(options.recentCount)) {
      return 'Invalid --count value';
    }
    if (options.recentQuery !== null && options.recentQuery.trim() === '') {
      return 'Invalid --query value';
    }
  }

  if (hasRecentFilter && command !== 'recent') {
    return '--count and --query require --recent';
  }

  if (hasRememberEnhancement && command !== 'remember') {
    return '--limit and --brief require --remember';
  }

  if (command === 'remember' && hasTimeFilters) {
    return '--from, --to, --since, and --bucket require --stats or --prompt-metrics';
  }

  if (command === 'ingest' && options.positionals.length > 0) {
    return '--ingest does not take a thought';
  }

  if (command === 'browse') {
    if (!options.browse && !canInteractivelyOpenBrowseShell(options)) {
      return '--browse requires an entry id outside interactive TTY use';
    }
    if (options.positionals.length > 0) {
      return '--browse does not take a thought';
    }
  }

  if (command === 'inspect') {
    if (!options.inspect) {
      return '--inspect requires an entry id';
    }
    if (options.positionals.length > 0) {
      return '--inspect does not take a thought';
    }
  }

  if (command === 'migrate_graph') {
    if (options.positionals.length > 0) {
      return '--migrate-graph does not take a thought';
    }
    if (hasTimeFilters || hasRecentFilter || options.reflectMode) {
      return '--migrate-graph cannot be combined with other command options';
    }
  }

  if (command === 'stats' && options.positionals.length > 0) {
    return '--stats does not take a thought';
  }

  if (command === 'prompt_metrics' && options.positionals.length > 0) {
    return '--prompt-metrics does not take a thought';
  }

  if (command === 'reflect_start') {
    if (options.reflectMode && !REFLECT_PROMPT_TYPES.includes(options.reflectMode)) {
      return 'Invalid --mode value';
    }
    if (!options.reflect && !canInteractivelyPickReflectSeed(options)) {
      return '--reflect requires a seed entry id';
    }
    if (options.positionals.length > 0) {
      return '--reflect does not take a response';
    }
  }

  if (command === 'reflect_reply') {
    if (!options.reflectSession) {
      return '--reflect-session requires a session id';
    }
    if (options.positionals.length === 0) {
      return '--reflect-session requires a response';
    }
  }

  if (options.reflectMode && command !== 'reflect_start') {
    return '--mode requires --reflect';
  }

  if (command !== 'stats' && command !== 'prompt_metrics' && hasTimeFilters) {
    return '--from, --to, --since, and --bucket require --stats or --prompt-metrics';
  }

  if (command !== 'stats' && command !== 'prompt_metrics') {
    return null;
  }

  if (options.from && Number.isNaN(Date.parse(options.from))) {
    return 'Invalid --from value';
  }

  if (options.to && Number.isNaN(Date.parse(options.to))) {
    return 'Invalid --to value';
  }

  if (options.since && !/^\d+[hdw]$/.test(options.since)) {
    return 'Invalid --since value';
  }

  if (options.bucket && !['hour', 'day', 'week'].includes(options.bucket)) {
    return 'Invalid --bucket value';
  }

  return null;
}

function setOptionError(options, message) {
  if (!options.optionError) {
    options.optionError = message;
  }
}

export function countExplicitCommands(options) {
  return [
    options.recent,
    options.remember,
    options.ingest,
    options.promptMetrics,
    options.browseFlag,
    options.inspectFlag,
    options.migrateGraph,
    options.stats,
    options.reflectFlag,
    options.reflectSessionFlag,
  ].filter(Boolean).length;
}

export function resolveHelpTopic(options, command) {
  if (!options.help) {
    return null;
  }

  const explicitCommands = countExplicitCommands(options);

  if (explicitCommands === 1) {
    return commandToHelpTopic(command);
  }

  return 'general';
}

function commandToHelpTopic(command) {
  if (command === 'prompt_metrics') {
    return 'prompt-metrics';
  }
  if (command === 'migrate_graph') {
    return 'migrate-graph';
  }
  if (command === 'reflect_start') {
    return 'reflect';
  }
  if (command === 'reflect_reply') {
    return 'reflect-session';
  }

  return command;
}
