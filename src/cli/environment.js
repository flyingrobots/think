export function isInteractiveReflectAvailable() {
  if (process.env.THINK_TEST_INTERACTIVE === '1') {
    return true;
  }

  return process.stdin.isTTY === true && process.stdout.isTTY === true;
}

export function shouldUseInteractiveReflectShell(output) {
  return !output.json && isInteractiveReflectAvailable();
}

export function shouldUseInteractiveBrowseShell(output) {
  return !output.json && isInteractiveReflectAvailable();
}

export function canInteractivelyOpenBrowseShell(options) {
  return !options.json && isInteractiveReflectAvailable();
}

export function canInteractivelyPickReflectSeed(options) {
  return !options.json && isInteractiveReflectAvailable();
}

export function canInteractivelyOfferGraphMigration(output) {
  return !output.json && isInteractiveReflectAvailable();
}
