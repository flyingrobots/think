# shellcheck shell=bash
#
# Drop the git environment variables that bind a process to a specific
# repository.
#
# Git exports these to every hook. Any test that shells out to git then resolves
# the hook's repository instead of its own fixture — `git init` in a temp
# directory writes to $GIT_DIR, so the fixture repo is never created and the
# test fails with a confusing "not a git repository". The suite therefore passed
# under `npm test` but failed under `git push`, which made the pre-push hook
# impossible to satisfy.
#
# The authoritative set is whatever `git rev-parse --local-env-vars` reports for
# the installed git, so it is queried rather than hand-maintained — an earlier
# hand-written list silently omitted GIT_CONFIG, GIT_CONFIG_COUNT,
# GIT_CONFIG_PARAMETERS, GIT_GRAFT_FILE, GIT_IMPLICIT_WORK_TREE,
# GIT_NO_REPLACE_OBJECTS, GIT_REPLACE_REF_BASE and GIT_SHALLOW_FILE.
#
# A few repository-scoping variables are not in that list but still redirect
# lookups, so they are unset explicitly as well. Identity and transport
# variables such as GIT_AUTHOR_NAME or GIT_SSH_COMMAND are deliberately left
# alone: the product sets its own commit identity, and transport settings are
# safe to inherit.
GIT_EXTRA_SCRUBBED_ENV_VARS="GIT_CEILING_DIRECTORIES GIT_INDEX_VERSION GIT_NAMESPACE GIT_QUARANTINE_PATH"

scrub_git_location_env() {
  local name
  for name in $(git rev-parse --local-env-vars 2>/dev/null) ${GIT_EXTRA_SCRUBBED_ENV_VARS}; do
    unset "${name}"
  done
}
