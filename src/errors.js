/**
 * Think error taxonomy.
 *
 * Named error classes for cross-surface failures so CLI, MCP, and
 * store paths report the same truth consistently.
 */

export class ThinkError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ThinkError';
    this.code = code;
  }
}

export class ValidationError extends ThinkError {
  constructor(message) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ThinkError {
  constructor(message) {
    super(message, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class GraphError extends ThinkError {
  constructor(message) {
    super(message, 'GRAPH_ERROR');
    this.name = 'GraphError';
  }
}

export class CaptureError extends ThinkError {
  constructor(message) {
    super(message, 'CAPTURE_ERROR');
    this.name = 'CaptureError';
  }
}

export class DependencyError extends ThinkError {
  constructor(message) {
    super(message, 'DEPENDENCY_ERROR');
    this.name = 'DependencyError';
  }
}

export class PortNotImplementedError extends ThinkError {
  constructor(portName, methodName) {
    super(`${portName}.${methodName} is not implemented`, 'PORT_NOT_IMPLEMENTED');
    this.name = 'PortNotImplementedError';
    this.portName = portName;
    this.methodName = methodName;
  }
}
