#!/usr/bin/env sh

gitDirectory=$(git rev-parse --path-format=absolute --git-common-dir)
mainCheckoutDirectory=$(dirname "$gitDirectory")

# Allow worktrees to share the main checkout's hooks.
husky "$mainCheckoutDirectory/.husky"
