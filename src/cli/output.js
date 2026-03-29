export function createOutput({ stdout, stderr, reporter, json }) {
  return {
    json,
    out(message, eventName, data = {}) {
      if (json) {
        reporter.event(eventName ?? 'cli.output', {
          ...data,
          message,
        });
        return;
      }

      stdout.write(message.endsWith('\n') ? message : `${message}\n`);
    },
    error(message, eventName, data = {}) {
      if (json) {
        reporter.event(eventName ?? 'cli.error_output', {
          ...data,
          message,
        });
        return;
      }

      stderr.write(message.endsWith('\n') ? message : `${message}\n`);
    },
    data(eventName, data = {}) {
      if (!json) {
        return;
      }

      reporter.event(eventName, data);
    },
  };
}

export function writeShellBlock(content, output) {
  if (!content) {
    return;
  }

  output.out(content);
}

export function resolveJsonStream(payload) {
  if (payload.event === 'backup.status' && payload.status === 'pending') {
    return 'stderr';
  }

  if (
    [
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
    ].includes(payload.event)
  ) {
    return 'stderr';
  }

  return 'stdout';
}
