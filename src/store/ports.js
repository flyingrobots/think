import { PortNotImplementedError } from '../errors.js';

/**
 * ClockPort interface for deterministic time.
 * Adheres to Infrastructure Doctrine P7.
 */
export class ClockPort {
  /** @returns {Date} */
  now() { throw new PortNotImplementedError('ClockPort', 'now'); }
}

/**
 * HostPort interface for host-specific metadata.
 * Adheres to Infrastructure Doctrine Hexagonal Architecture rule.
 */
export class HostPort {
  /** @returns {string} */
  hostname() { throw new PortNotImplementedError('HostPort', 'hostname'); }
}

/**
 * RandomPort interface for deterministic randomness.
 * Adheres to Infrastructure Doctrine P7.
 */
export class RandomPort {
  /** @returns {string} */
  uuid() { throw new PortNotImplementedError('RandomPort', 'uuid'); }
}

class SystemClock extends ClockPort {
  now() {
    if (process.env.THINK_TEST_NOW) {
      const ms = parseInt(process.env.THINK_TEST_NOW, 10);
      if (!Number.isNaN(ms)) {
        return new Date(ms);
      }
    }
    return new Date();
  }
}

class SystemHost extends HostPort {
  hostname() {
    // This needs careful implementation for browser-first doctrine.
    return 'unknown-host';
  }
}

class SystemRandom extends RandomPort {
  uuid() {
    return crypto.randomUUID();
  }
}

/**
 * Standard System implementation of ports for production CLI use.
 */
export class SystemPorts {
  constructor() {
    this.clock = new SystemClock();
    this.host = new SystemHost();
    this.random = new SystemRandom();
  }
}
