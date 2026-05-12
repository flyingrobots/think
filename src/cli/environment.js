export function isInteractiveReflectAvailable() {
  if (process.env.THINK_TEST_INTERACTIVE === '1') {
    return true;
  }

  return process.stdin.isTTY === true && process.stdout.isTTY === true;
}

function isInteractiveShellAvailable(outputOrOptions) {
  return !outputOrOptions.json && isInteractiveReflectAvailable();
}

export function shouldUseInteractiveReflectShell(output) {
  return isInteractiveShellAvailable(output);
}

export function shouldUseInteractiveBrowseShell(output) {
  return isInteractiveShellAvailable(output);
}

export function canInteractivelyOpenBrowseShell(options) {
  return isInteractiveShellAvailable(options);
}

export function canInteractivelyPickReflectSeed(options) {
  return isInteractiveShellAvailable(options);
}

export function canInteractivelyOfferGraphMigration(output) {
  return isInteractiveShellAvailable(output);
}
