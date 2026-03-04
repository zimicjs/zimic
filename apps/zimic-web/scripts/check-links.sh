#!/usr/bin/env bash

# Use this script to check for broken documentation links in the codebase.
#
# Usage:
#   bash apps/zimic-web/scripts/check-links.sh

links=()

# Find all links to zimic.dev.
for extension in ts tsx md; do
  while read -r link; do
    links+=("$link")
  done < <(
    find apps packages examples \
      -type f \
      -name "*.${extension}" \
      ! -path '*/dist/*' \
      ! -path '*/local/*' \
      ! -path '*/node_modules/*' \
      -exec grep -ohE "https://zimic.dev/[a-zA-Z0-9/#_-]+" {} +
  )
done

uniqueLinks=($(printf "%s\n" "${links[@]}" | sort -u))
echo "Found ${#uniqueLinks[@]} unique links to check."

isSomeLinkBroken=false

for link in "${uniqueLinks[@]}"; do
  echo "Checking link: $link"

  # Change the link to localhost for testing.
  localLink="${link/https:\/\/zimic.dev\//http:\/\/localhost:3000/}"
  response=$(curl "$localLink" --silent --fail 2>&1)

  # If the curl command failed, the link is broken.
  if [ $? -ne 0 ]; then
    echo "Broken link: $link"
    isSomeLinkBroken=true
    continue
  fi

  # If the link contains an anchor, check if the anchor exists in the response.
  if [[ "$link" == *'#'* ]]; then
    anchor="${link##*#}"

    if ! grep -q "id=\"$anchor\"" <<< "$response"; then
      echo "Broken link: $link"
      isSomeLinkBroken=true
    fi
  fi
done

if [ "$isSomeLinkBroken" = true ]; then
  echo 'There are broken documentation links. Please fix the issues above.'
  exit 1
else
  echo 'All documentation links are valid!'
  exit 0
fi
