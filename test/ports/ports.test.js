import assert from 'node:assert/strict';
import test from 'node:test';

import { PortNotImplementedError } from '../../src/errors.js';
import { ClockPort, HostPort, RandomPort } from '../../src/store/ports.js';

test('abstract clock port reports a typed not-implemented error', () => {
  assert.throws(
    () => new ClockPort().now(),
    (error) => isPortError(error, 'ClockPort', 'now')
  );
});

test('abstract host port reports a typed not-implemented error', () => {
  assert.throws(
    () => new HostPort().hostname(),
    (error) => isPortError(error, 'HostPort', 'hostname')
  );
});

test('abstract random port reports a typed not-implemented error', () => {
  assert.throws(
    () => new RandomPort().uuid(),
    (error) => isPortError(error, 'RandomPort', 'uuid')
  );
});

function isPortError(error, portName, methodName) {
  return error instanceof PortNotImplementedError
    && error.portName === portName
    && error.methodName === methodName;
}
