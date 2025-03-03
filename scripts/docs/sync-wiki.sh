#!/usr/bin/env bash

set -e

refName=$1

if [ "$refName" == '' ]; then
  echo 'Usage: sync-wiki.sh <refName>' >&2
  exit 1
fi

cd "$(dirname "$0")/../../../zimic.wiki"

echo 'Pulling latest changes...'
git fetch
git checkout master
git pull

echo 'Syncing wiki content...'
rsync ../zimic/docs/wiki/ . \
  --archive \
  --verbose \
  --delete \
  --exclude .git

echo "Pointing local links to 'zimicjs/zimic/tree/$refName'..."
sed -E -i \
  "s;\\]\\(\\.\\.\\/\\.\\.\\/([^\\)]*)\\);](https:\\/\\/github.com\\/zimicjs\\/zimic\\/tree\\/$refName\\/\\1);g" \
  ./*.md

echo 'Pointing image links to local files...'
find ../zimic/docs -type f -name '*.png' -exec cp {} . \;
sed -E -i \
  "s/\\..*\\/([^.]+)\\.png/.\\/\\1.png/g" \
  ./*.md

echo 'Done!'
