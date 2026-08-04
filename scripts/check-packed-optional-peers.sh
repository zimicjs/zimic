#!/usr/bin/env bash

set -euo pipefail

repositoryDirectory=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
temporaryParentDirectory=$(cd "${TMPDIR:-/tmp}" && pwd -P)

if [[ "$temporaryParentDirectory" == "$repositoryDirectory" || "$temporaryParentDirectory" == "$repositoryDirectory/"* ]]; then
  temporaryParentDirectory=$(cd /tmp && pwd -P)
fi

temporaryDirectory=$(mktemp -d "$temporaryParentDirectory/zimic-packed-optional-peers.XXXXXX")
temporaryDirectory=$(cd "$temporaryDirectory" && pwd -P)

if [[ "$temporaryDirectory" == "$repositoryDirectory" || "$temporaryDirectory" == "$repositoryDirectory/"* ]]; then
  rm -rf "$temporaryDirectory"
  echo 'Packed consumers must be created outside the repository.' >&2
  exit 1
fi

packedPackagesDirectory="$temporaryDirectory/packages"

cleanup() {
  rm -rf "$temporaryDirectory"
}

trap cleanup EXIT

pnpmStoreDirectory=$(pnpm store path)

mkdir -p "$packedPackagesDirectory"
cd "$repositoryDirectory"

pnpm turbo build \
  --filter @zimic/http \
  --filter @zimic/ws \
  --filter @zimic/interceptor

pnpm --dir "$repositoryDirectory/packages/zimic-http" pack --out "$packedPackagesDirectory/zimic-http.tgz"
pnpm --dir "$repositoryDirectory/packages/zimic-ws" pack --out "$packedPackagesDirectory/zimic-ws.tgz"
pnpm --dir "$repositoryDirectory/packages/zimic-interceptor" pack \
  --out "$packedPackagesDirectory/zimic-interceptor.tgz"

createConsumer() {
  local protocol=$1
  local consumerDirectory="$temporaryDirectory/$protocol-consumer"

  mkdir -p "$consumerDirectory"

  if [[ "$protocol" == 'http' ]]; then
    cat > "$consumerDirectory/package.json" << EOF
{
  "name": "zimic-packed-http-consumer",
  "private": true,
  "type": "module",
  "dependencies": {
    "@zimic/http": "file:$packedPackagesDirectory/zimic-http.tgz",
    "@zimic/interceptor": "file:$packedPackagesDirectory/zimic-interceptor.tgz"
  }
}
EOF

    cat > "$consumerDirectory/index.ts" << 'EOF'
import { type HttpSchema } from '@zimic/http';
import {
  createHttpInterceptor,
  type HttpInterceptorAuthOptions,
  type LocalHttpInterceptor,
} from '@zimic/interceptor/http';

type Schema = HttpSchema<{
  '/health': {
    GET: {
      response: { 200: { body: { status: 'ok' } } };
    };
  };
}>;

const interceptor = createHttpInterceptor<Schema>({
  type: 'local',
  baseURL: 'http://localhost',
});

const typedInterceptor: LocalHttpInterceptor<Schema> = interceptor;
const auth: HttpInterceptorAuthOptions = { token: 'token' };
void typedInterceptor;
void auth;
EOF

    cat > "$consumerDirectory/smoke.mjs" << 'EOF'
import { createHttpInterceptor } from '@zimic/interceptor/http';

if (typeof createHttpInterceptor !== 'function') {
  throw new TypeError('Expected the ESM HTTP interceptor export to be a function.');
}
EOF

    cat > "$consumerDirectory/smoke.cjs" << 'EOF'
const { createHttpInterceptor } = require('@zimic/interceptor/http');

if (typeof createHttpInterceptor !== 'function') {
  throw new TypeError('Expected the CommonJS HTTP interceptor export to be a function.');
}
EOF
  else
    cat > "$consumerDirectory/package.json" << EOF
{
  "name": "zimic-packed-websocket-consumer",
  "private": true,
  "type": "module",
  "dependencies": {
    "@zimic/interceptor": "file:$packedPackagesDirectory/zimic-interceptor.tgz",
    "@zimic/ws": "file:$packedPackagesDirectory/zimic-ws.tgz"
  }
}
EOF

    cat > "$consumerDirectory/index.ts" << 'EOF'
import {
  createWebSocketInterceptor,
  type LocalWebSocketInterceptor,
} from '@zimic/interceptor/experimental/ws';
import { type WebSocketSchema } from '@zimic/ws';

type Schema = WebSocketSchema<{ type: 'ping'; data: string }>;

const interceptor = createWebSocketInterceptor<Schema>({
  type: 'local',
  baseURL: 'ws://localhost',
});

const typedInterceptor: LocalWebSocketInterceptor<Schema> = interceptor;
void typedInterceptor;
EOF

    cat > "$consumerDirectory/smoke.mjs" << 'EOF'
import { createWebSocketInterceptor } from '@zimic/interceptor/experimental/ws';

if (typeof createWebSocketInterceptor !== 'function') {
  throw new TypeError('Expected the ESM WebSocket interceptor export to be a function.');
}
EOF

    cat > "$consumerDirectory/smoke.cjs" << 'EOF'
const { createWebSocketInterceptor } = require('@zimic/interceptor/experimental/ws');

if (typeof createWebSocketInterceptor !== 'function') {
  throw new TypeError('Expected the CommonJS WebSocket interceptor export to be a function.');
}
EOF
  fi

  cat > "$consumerDirectory/tsconfig.json" << 'EOF'
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "noEmit": true,
    "skipLibCheck": false,
    "strict": true,
    "target": "ES2022"
  },
  "include": ["index.ts"]
}
EOF

  pnpm --dir "$consumerDirectory" install \
    --offline \
    --ignore-scripts \
    --store-dir "$pnpmStoreDirectory"

  if [[ "$protocol" == 'http' ]]; then
    test ! -e "$consumerDirectory/node_modules/@zimic/ws"
  else
    test ! -e "$consumerDirectory/node_modules/@zimic/http"
  fi

  pnpm exec tsc --project "$consumerDirectory/tsconfig.json"
  node "$consumerDirectory/smoke.mjs"
  node "$consumerDirectory/smoke.cjs"
}

createConsumer http
createConsumer websocket
