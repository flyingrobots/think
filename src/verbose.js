import { stringifyJson } from './json.js';

export class VerboseReporter {
  constructor(stream, enabled) {
    this.enabled = enabled;
    this._stream = stream;
  }

  event(name, data = {}) {
    if (!this.enabled) {
      return;
    }

    const payload = {
      ts: new Date().toISOString(),
      event: name,
      ...data,
    };

    if (typeof this._stream === 'function') {
      this._stream(payload);
      return;
    }

    this._stream.write(`${stringifyJson(payload)}\n`);
  }
}

export function createVerboseReporter(stream, enabled) {
  return new VerboseReporter(stream, enabled);
}
