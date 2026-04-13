import { ThinkError } from './errors.js';
import { createVerboseReporter } from './verbose.js';
import { stringifyJson } from './json.js';
import { renderHelp } from './cli/help.js';
import {
  COMMANDS,
  parseArgs,
  resolveCommand,
  resolveHelpTopic,
  validateOptions,
} from './cli/options.js';
import { createOutput, resolveJsonStream } from './cli/output.js';
import { runCapture, runIngest, runMigrateGraph } from './cli/commands/capture.js';
import {
  runBrowse,
  runDoctor,
  runInspect,
  runPromptMetrics,
  runRecent,
  runRemember,
  runStats,
} from './cli/commands/read.js';
import { runReflectReply, runReflectStart } from './cli/commands/reflect.js';

export async function main(argv, { stdout, stderr, stdin }) {
  const options = parseArgs(argv.slice(2));
  const command = resolveCommand(options);
  const helpTopic = resolveHelpTopic(options, command);
  const reporter = createVerboseReporter(
    options.json
      ? (payload) => {
          const stream = resolveJsonStream(payload) === 'stderr' ? stderr : stdout;
          stream.write(`${stringifyJson(payload)}\n`);
        }
      : stderr,
    options.verbose || options.json
  );
  const output = createOutput({ stdout, stderr, reporter, json: options.json });
  const validationError = validateOptions(options, command);

  try {
    reporter.event('cli.start', { command });

    if (validationError) {
      if (options.json) {
        output.error(validationError, 'cli.validation_failed', { command });
      } else {
        output.error(validationError);
        reporter.event('cli.validation_failed', { command, message: validationError });
      }
      reporter.event('cli.failure', { command, exitCode: 1 });
      return 1;
    }

    if (helpTopic) {
      const help = renderHelp(helpTopic);
      output.out(help.message, 'cli.help', { command, topic: help.topic });
      reporter.event('cli.success', { command, exitCode: 0 });
      return 0;
    }

    const dispatch = {
      [COMMANDS.RECENT]: () => runRecent(output, reporter, options),
      [COMMANDS.REMEMBER]: () => runRemember(output, reporter, options),
      [COMMANDS.BROWSE]: () => runBrowse(options.browse, output, reporter),
      [COMMANDS.INSPECT]: () => runInspect(options.inspect, output, reporter),
      [COMMANDS.DOCTOR]: () => runDoctor(output, reporter),
      [COMMANDS.MIGRATE_GRAPH]: () => runMigrateGraph(output, reporter),
      [COMMANDS.INGEST]: () => runIngest(stdin, output, reporter),
      [COMMANDS.STATS]: () => runStats(output, reporter, options),
      [COMMANDS.PROMPT_METRICS]: () => runPromptMetrics(output, reporter, options),
      [COMMANDS.REFLECT_START]: () => runReflectStart(options.reflect, output, reporter, {
        reflectMode: options.reflectMode,
      }),
      [COMMANDS.REFLECT_REPLY]: () => runReflectReply(
        options.reflectSession,
        options.positionals.join(' '),
        output,
        reporter
      ),
      [COMMANDS.CAPTURE]: () => {
        const thought = options.positionals.length <= 1
          ? (options.positionals[0] ?? '')
          : options.positionals.join(' ');
        if (!thought && stdin && !stdin.isTTY) {
          stderr.write('Hint: piped input detected. Use --ingest to capture stdin.\n');
        }
        return runCapture(thought, output, reporter);
      },
    };

    const handler = dispatch[command] ?? dispatch[COMMANDS.CAPTURE];
    const exitCode = await handler();

    reporter.event(exitCode === 0 ? 'cli.success' : 'cli.failure', { command, exitCode });
    return exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = error instanceof ThinkError ? error.code : 'UNEXPECTED_ERROR';
    reporter.event('cli.error', { command, message, code });

    if (error instanceof ThinkError) {
      output.error(message, `cli.${code.toLowerCase()}`, { command });
    } else if (options.json) {
      output.error(message, 'cli.unexpected_error', { command });
    } else {
      output.error(`Something went wrong: ${message}`);
    }
    return 1;
  }
}
