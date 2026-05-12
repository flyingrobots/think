export class CliOutput {
  constructor({ stdout, stderr, reporter, json }) {
    this.json = json;
    this._stdout = stdout;
    this._stderr = stderr;
    this._reporter = reporter;
  }

  out(message, eventName, data = {}) {
    if (this.json) {
      this._reporter.event(eventName ?? 'cli.output', {
        ...data,
        message,
      });
      return;
    }

    this._stdout.write(message.endsWith('\n') ? message : `${message}\n`);
  }

  error(message, eventName, data = {}) {
    if (this.json) {
      this._reporter.event(eventName ?? 'cli.error_output', {
        ...data,
        message,
      });
      return;
    }

    this._stderr.write(message.endsWith('\n') ? message : `${message}\n`);
  }

  data(eventName, data = {}) {
    if (!this.json) {
      return;
    }

    this._reporter.event(eventName, data);
  }
}

export function createOutput(options) {
  return new CliOutput(options);
}

export function writeShellBlock(content, output) {
  if (!content) {
    return;
  }

  output.out(content);
}

const STDERR_EVENTS = Object.freeze([
  'cli.validation_failed',
  'cli.failure',
  'cli.error',
  'capture.validation_failed',
  'backup.pending',
  'backup.failure',
  'backup.timeout',
  'backup.retry',
  'reflect.validation_failed',
  'reflect.seed_not_found',
  'reflect.seed_ineligible',
  'reflect.session_not_found',
  'graph.migration_required',
  'graph.migration_cancelled',
  'graph.migration.failed',
  'browse.entry_not_found',
  'inspect.entry_not_found',
]);

export function resolveJsonStream(payload) {
  if (payload.event === 'backup.status' && payload.status === 'pending') {
    return 'stderr';
  }

  if (STDERR_EVENTS.includes(payload.event)) {
    return 'stderr';
  }

  return 'stdout';
}
