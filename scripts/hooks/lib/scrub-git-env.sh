# shellcheck shell=bash
#
# Drop the git environment variables that name *where* a repository lives.
#
# Git exports these to every hook. Any test that shells out to git then resolves
# the hook's repository instead of its own fixture — `git init` in a temp
# directory writes to $GIT_DIR, so the fixture repo is never created and the
# test fails with a confusing "not a git repository". The suite therefore passed
# under `npm test` but failed under `git push`, which made the pre-push hook
# impossible to satisfy.
#
# Identity and transport variables are intentionally left alone: the product
# sets its own commit identity, and transport settings are safe to inherit.
scrub_git_location_env() {
  unset GIT_ALTERNATE_OBJECT_DIRECTORIES
  unset GIT_CEILING_DIRECTORIES
  unset GIT_COMMON_DIR
  unset GIT_DIR
  unset GIT_INDEX_FILE
  unset GIT_INDEX_VERSION
  unset GIT_NAMESPACE
  unset GIT_OBJECT_DIRECTORY
  unset GIT_PREFIX
  unset GIT_QUARANTINE_PATH
  unset GIT_WORK_TREE
}
