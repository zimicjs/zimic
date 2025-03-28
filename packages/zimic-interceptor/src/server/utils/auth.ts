import crypto from 'crypto';
import fs from 'fs';
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

export async function createInterceptorToken(options: { length: number }): Promise<InterceptorToken> {
  const tokenId = crypto.randomUUID();
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
  } catch (error) {
    logWithPrefix(
      `${color.red(color.bold('✖'))} Failed to create the tokens directory: ${color.yellow(tokensDirectory)}`,
      { method: 'error' },
    );
    throw error;
  }
}

export interface InterceptorTokenFileContent {
  version: 1;
  token: Pick<InterceptorToken, 'id' | 'hash' | 'salt'>;
}

export async function saveInterceptorTokenToFile(tokensDirectory: string, token: InterceptorToken) {
  const filePath = path.join(tokensDirectory, token.id);

  const fileContent = JSON.stringify({
    version: 1,
    token: { id: token.id, hash: token.hash, salt: token.salt },
  } satisfies InterceptorTokenFileContent);

  await fs.promises.writeFile(filePath, fileContent, { mode: 0o600, encoding: 'utf-8' });

  return filePath;
}
