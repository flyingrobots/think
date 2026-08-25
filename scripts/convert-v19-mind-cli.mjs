import { ConvertV19MindError } from './convert-v19-mind-support.mjs';

const BOOLEAN_OPTIONS = Object.freeze({
  '--dry-run': 'dryRun',
  '--help': 'help',
  '--json': 'json',
  '-h': 'help',
});
const VALUE_OPTIONS = Object.freeze({
  '--inventory-in': 'inventoryIn',
  '--inventory-out': 'inventoryOut',
  '--source': 'source',
  '--target': 'target',
});

export function usage() {
  return [
    'Usage:',
    '  node scripts/convert-v19-mind.mjs --source <path> --inventory-out <path> [--json]',
    '  node scripts/convert-v19-mind.mjs --inventory-in <path> --target <path> [--json]',
    '  node scripts/convert-v19-mind.mjs --inventory-in <path> --dry-run [--json]',
    '',
    'Options:',
    '  --source <path>         Disposable all-ref copy of the legacy Think mind.',
    '  --inventory-out <path>  New, checksummed inventory file; never overwritten.',
    '  --inventory-in <path>   Existing checksummed inventory file to validate/import.',
    '  --target <path>         Empty Git repository to populate with native v19 data.',
    '  --dry-run               Validate an inventory without writing a native target.',
    '  --json                  Emit a machine-readable report.',
    '',
    'Legacy extraction and native import are deliberately separate invocations.',
    'The rejected generic record is read once into an immutable inventory and is',
    'never admitted to the native target or linked into the Think runtime.',
  ].join('\n');
}

export function parseConvertArgs(argv) {
  const parsed = {
    dryRun: false,
    help: false,
    inventoryIn: null,
    inventoryOut: null,
    json: false,
    source: null,
    target: null,
  };
  for (let index = 0; index < argv.length;) {
    index += consumeConvertArg(argv, index, parsed);
  }
  return Object.freeze(parsed);
}

function consumeConvertArg(argv, index, parsed) {
  const arg = argv[index];
  const booleanProperty = BOOLEAN_OPTIONS[arg];
  if (booleanProperty) {
    parsed[booleanProperty] = true;
    return 1;
  }
  const valueProperty = VALUE_OPTIONS[arg];
  if (!valueProperty) {
    throw new ConvertV19MindError(`Unknown argument: ${arg}`, 'convert_v19_mind.usage');
  }
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new ConvertV19MindError(`${arg} requires a value`, 'convert_v19_mind.usage');
  }
  parsed[valueProperty] = value;
  return 2;
}

export function formatReport(report, json) {
  return json ? JSON.stringify(report) : JSON.stringify(report, null, 2);
}

export function formatFailure(error, json) {
  const payload = failurePayload(error);
  return json
    ? JSON.stringify(payload)
    : `${payload.code}: ${payload.message}`;
}

function failurePayload(error) {
  return {
    code: error?.code ?? 'convert_v19_mind.unexpected',
    message: error instanceof Error ? error.message : String(error),
    ...(error?.details === undefined ? {} : { details: error.details }),
  };
}
