#!/usr/bin/env sh

husky || exit $?

# HUSKY=0 disables Husky. Git configuration should only be applied if Husky is enabled.
if [ "$HUSKY" != "0" ]; then
  # Share the main checkout's hooks with linked worktrees.
  git config core.hooksPath "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/.husky/_"
fi
