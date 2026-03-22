export function createVerboseReporter(stream, enabled) {
  return {
    enabled,
    event(name, data = {}) {
      if (!enabled) {
        return;
      }

      stream.write(`${JSON.stringify({
        ts: new Date().toISOString(),
        event: name,
        ...data,
      })}\n`);
    },
  };
}
