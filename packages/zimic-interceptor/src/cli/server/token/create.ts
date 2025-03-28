import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import color from 'picocolors';

import { getOrCreateConfigDirectories } from '@/cli/utils/config';
import { logWithPrefix } from '@/utils/console';

export const DEFAULT_INTERCEPTOR_SERVER_TOKEN_LENGTH = 32;

const INTERCEPTOR_SERVER_TOKEN_SALT_LENGTH = 32;
const INTERCEPTOR_SERVER_TOKEN_HASH_ITERATIONS = 1_000_000;
const INTERCEPTOR_SERVER_TOKEN_HASH_LENGTH = 64;
const INTERCEPTOR_SERVER_TOKEN_HASH_ALGORITHM = 'sha512';

function generateInterceptorServerToken(length: number) {
  return crypto.randomBytes(length).toString('base64url');
}

async function hashInterceptorServerToken(plainToken: string) {
  const salt = crypto.randomBytes(INTERCEPTOR_SERVER_TOKEN_SALT_LENGTH).toString('base64url');

  const hash = await new Promise<string>((resolve, reject) => {
    crypto.pbkdf2(
      plainToken,
      salt,
      INTERCEPTOR_SERVER_TOKEN_HASH_ITERATIONS,
      INTERCEPTOR_SERVER_TOKEN_HASH_LENGTH,
      INTERCEPTOR_SERVER_TOKEN_HASH_ALGORITHM,
      (error, derivedBuffer) => {
        if (error) {
          reject(error);
        } else {
          resolve(derivedBuffer.toString('base64url'));
        }
      },
    );
  });

  return { hash, salt };
}

interface InterceptorServerTokensFileLine {
  hash: string;
  salt: string;
}

export async function saveInterceptorServerTokenHash(tokensFilePath: string, hash: string, salt: string) {
  const line: InterceptorServerTokensFileLine = { hash, salt };
  const stringifiedLine = `${JSON.stringify(line)}${os.EOL}`;
  await fs.promises.appendFile(tokensFilePath, stringifiedLine, { mode: 0o600 });
}

interface CreateInterceptorServerTokenOptions {
  configDirectory: string;
  tokenLength: number;
}

export async function createInterceptorServerToken(options: CreateInterceptorServerTokenOptions) {
  const directories = await getOrCreateConfigDirectories(options.configDirectory);

  const plainToken = generateInterceptorServerToken(options.tokenLength);
  const { hash, salt } = await hashInterceptorServerToken(plainToken);

  await saveInterceptorServerTokenHash(directories.server.tokens.path, hash, salt);

  logWithPrefix(
    [
      `${color.green(color.bold('✔'))} Token created:`,
      '',
      color.yellow(plainToken),
      '',
      'Use this token to authenticate remote interceptors to this server. Store it securely. It cannot be retrieved ',
      `later. A hash of this token was added to ${color.green(directories.server.tokens.path)}.`,
      '',
      'Learn more: https://github.com/zimicjs/zimic/wiki/cli‐zimic‐interceptor‐server#authentication',
    ].join('\n'),
  );
}
