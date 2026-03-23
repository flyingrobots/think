export function createVerboseReporter(stream, enabled) {
  return {
    enabled,
    event(name, data = {}) {
      if (!enabled) {
        return;
      }

      const payload = {
        ts: new Date().toISOString(),
        event: name,
        ...data,
      };

      if (typeof stream === 'function') {
        stream(payload);
        return;
      }

      stream.write(`${JSON.stringify(payload)}\n`);
    },
  };
}
