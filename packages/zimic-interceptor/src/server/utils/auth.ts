import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import color from 'picocolors';

import { logWithPrefix } from '@/utils/console';

export const DEFAULT_INTERCEPTOR_TOKEN_LENGTH = 32;

export const INTERCEPTOR_TOKEN_SALT_LENGTH = 32;
export const INTERCEPTOR_TOKEN_HASH_ITERATIONS = 1_000_000;
export const INTERCEPTOR_TOKEN_HASH_LENGTH = 64;
export const INTERCEPTOR_TOKEN_HASH_ALGORITHM = 'sha512';

async function hashInterceptorToken(plainToken: string) {
  const salt = crypto.randomBytes(INTERCEPTOR_TOKEN_SALT_LENGTH).toString('hex');

  const hash = await new Promise<string>((resolve, reject) => {
    crypto.pbkdf2(
      plainToken,
      salt,
      INTERCEPTOR_TOKEN_HASH_ITERATIONS,
      INTERCEPTOR_TOKEN_HASH_LENGTH,
      INTERCEPTOR_TOKEN_HASH_ALGORITHM,
      (error, derivedBuffer) => {
        if (error) {
          reject(error);
        } else {
          resolve(derivedBuffer.toString('hex'));
        }
      },
    );
  });

  return { hash, salt };
}

export interface InterceptorToken {
  id: string;
  value: string;
  hash: string;
  salt: string;
}

const INTERCEPTOR_TOKEN_ID_REGEX = /^[a-z0-9]{32}$/;

class InvalidInterceptorTokenError extends Error {
  constructor(tokenId: string, tokenValue?: string) {
    super(`Invalid interceptor token: ${tokenId}${tokenValue ? ` with value: ${tokenValue}` : ''}`);
    this.name = 'InvalidInterceptorTokenError';
  }
}

export async function createInterceptorToken(options: { length: number }): Promise<InterceptorToken> {
  const tokenId = crypto.randomUUID().replace(/[^a-z0-9]/g, '');

  if (!INTERCEPTOR_TOKEN_ID_REGEX.test(tokenId)) {
    throw new InvalidInterceptorTokenError(tokenId);
  }

  const value = crypto.randomBytes(options.length).toString('base64url');
  const { hash, salt } = await hashInterceptorToken(value);

  return {
    id: tokenId,
    value,
    hash,
    salt,
  };
}

export async function createInterceptorTokensDirectory(tokensDirectory: string) {
  try {
    const parentTokensDirectory = path.dirname(tokensDirectory);
    await fs.promises.mkdir(parentTokensDirectory, { recursive: true });

    await fs.promises.mkdir(tokensDirectory, { mode: 0o700, recursive: true });
    await fs.promises.appendFile(path.join(tokensDirectory, '.gitignore'), `*${os.EOL}`, { encoding: 'utf-8' });
  } catch (error) {
    logWithPrefix(
      `${color.red(color.bold('✖'))} Failed to create the tokens directory: ${color.yellow(tokensDirectory)}`,
      { method: 'error' },
    );
    throw error;
  }
}

export interface InterceptorTokenFileContent {
  version: number;
  token: Pick<InterceptorToken, 'id' | 'hash' | 'salt'>;
}

export async function saveInterceptorTokenToFile(tokensDirectory: string, token: InterceptorToken) {
  const tokeFilePath = path.join(tokensDirectory, token.id);

  const tokenFileContent: InterceptorTokenFileContent = {
    version: 1,
    token: {
      id: token.id,
      hash: token.hash,
      salt: token.salt,
    },
  };
  const tokenFileContentAsString = JSON.stringify(tokenFileContent);

  await fs.promises.writeFile(tokeFilePath, tokenFileContentAsString, { mode: 0o600, encoding: 'utf-8' });

  return tokeFilePath;
}
