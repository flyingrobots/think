import { createVerboseReporter } from './verbose.js';
import { stringifyJson } from './json.js';
import { renderHelp } from './cli/help.js';
import {
  parseArgs,
  resolveCommand,
  resolveHelpTopic,
  validateOptions,
} from './cli/options.js';
import { createOutput, resolveJsonStream } from './cli/output.js';
import { runCapture, runIngest, runMigrateGraph } from './cli/commands/capture.js';
import {
  runBrowse,
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

    let exitCode = 0;
    if (command === 'recent') {
      exitCode = await runRecent(output, reporter, options);
    } else if (command === 'remember') {
      exitCode = await runRemember(output, reporter, options);
    } else if (command === 'browse') {
      exitCode = await runBrowse(options.browse, output, reporter);
    } else if (command === 'inspect') {
      exitCode = await runInspect(options.inspect, output, reporter);
    } else if (command === 'migrate_graph') {
      exitCode = await runMigrateGraph(output, reporter);
    } else if (command === 'ingest') {
      exitCode = await runIngest(stdin, output, reporter);
    } else if (command === 'stats') {
      exitCode = await runStats(output, reporter, options);
    } else if (command === 'prompt_metrics') {
      exitCode = await runPromptMetrics(output, reporter, options);
    } else if (command === 'reflect_start') {
      exitCode = await runReflectStart(options.reflect, output, reporter, {
        reflectMode: options.reflectMode,
      });
    } else if (command === 'reflect_reply') {
      exitCode = await runReflectReply(
        options.reflectSession,
        options.positionals.join(' '),
        output,
        reporter
      );
    } else {
      const thought = options.positionals.length <= 1
        ? (options.positionals[0] ?? '')
        : options.positionals.join(' ');
      exitCode = await runCapture(thought, output, reporter);
    }

    reporter.event(exitCode === 0 ? 'cli.success' : 'cli.failure', { command, exitCode });
    return exitCode;
  } catch (error) {
    reporter.event('cli.error', {
      command,
      message: error instanceof Error ? error.message : String(error),
    });
    if (!options.json) {
      output.error('Something went wrong');
    }
    return 1;
  }
}
