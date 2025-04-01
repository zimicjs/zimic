import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import color from 'picocolors';
import util from 'util';
import { z } from 'zod';

import { logWithPrefix } from '@/utils/console';
import { pathExists } from '@/utils/files';

import InterceptorAuthError from '../errors/InterceptorAuthError';
import InvalidInterceptorTokenError from '../errors/InvalidInterceptorTokenError';
import InvalidInterceptorTokenFileError from '../errors/InvalidInterceptorTokenFileError';

export const DEFAULT_INTERCEPTOR_TOKEN_SECRET_LENGTH = 32;

const INTERCEPTOR_TOKEN_ID_LENGTH = 32;
const INTERCEPTOR_TOKEN_ID_REGEX = new RegExp(`^[a-z0-9]{${INTERCEPTOR_TOKEN_ID_LENGTH}}$`);

export const INTERCEPTOR_TOKEN_SALT_LENGTH = 32;
export const INTERCEPTOR_TOKEN_HASH_ITERATIONS = 1_000_000;
export const INTERCEPTOR_TOKEN_HASH_LENGTH = 64;
export const INTERCEPTOR_TOKEN_HASH_ALGORITHM = 'sha512';

const pbkdf2 = util.promisify(crypto.pbkdf2);

async function hashInterceptorToken(plainToken: string, salt: string) {
  const hashBuffer = await pbkdf2(
    plainToken,
    salt,
    INTERCEPTOR_TOKEN_HASH_ITERATIONS,
    INTERCEPTOR_TOKEN_HASH_LENGTH,
    INTERCEPTOR_TOKEN_HASH_ALGORITHM,
  );

  const hash = hashBuffer.toString('hex');
  return hash;
}

export interface InterceptorToken {
  id: string;
  name?: string;
  secret: { hash: string; salt: string };
  value: string;
  createdAt: Date;
}

function isValidInterceptorTokenId(tokenId: string) {
  return INTERCEPTOR_TOKEN_ID_REGEX.test(tokenId);
}

export async function createInterceptorToken(options: {
  tokenName?: string;
  secretLength: number;
}): Promise<InterceptorToken> {
  const tokenId = crypto.randomUUID().replace(/[^a-z0-9]/g, '');

  if (!isValidInterceptorTokenId(tokenId)) {
    throw new InvalidInterceptorTokenError(tokenId);
  }

  const tokenSecret = crypto.randomBytes(options.secretLength).toString('hex');
  const tokenSecretSalt = crypto.randomBytes(INTERCEPTOR_TOKEN_SALT_LENGTH).toString('hex');
  const tokenSecretHash = await hashInterceptorToken(tokenSecret, tokenSecretSalt);

  const tokenValue = Buffer.from(`${tokenId}${tokenSecret}`, 'hex').toString('base64url');

  return {
    id: tokenId,
    name: options.tokenName,
    secret: { hash: tokenSecretHash, salt: tokenSecretSalt },
    value: tokenValue,
    createdAt: new Date(),
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
      `${color.red(color.bold('✖'))} Failed to create the tokens directory: ${color.magenta(tokensDirectory)}`,
      { method: 'error' },
    );
    throw error;
  }
}

const interceptorTokenFileContentSchema = z.object({
  version: z.literal(1),
  token: z.object({
    id: z.string().regex(INTERCEPTOR_TOKEN_ID_REGEX),
    name: z.string().optional(),
    secret: z.object({
      hash: z.string().length(INTERCEPTOR_TOKEN_HASH_LENGTH * 2),
      salt: z.string().length(INTERCEPTOR_TOKEN_SALT_LENGTH * 2),
    }),
    createdAt: z
      .string()
      .datetime()
      .transform((dateString) => new Date(dateString)),
  }),
});

type InterceptorTokenFileContent = z.infer<typeof interceptorTokenFileContentSchema>;

namespace InterceptorTokenFileContent {
  export type Input = z.input<typeof interceptorTokenFileContentSchema>;
}

export type PersistedInterceptorToken = InterceptorTokenFileContent['token'];

export async function saveInterceptorTokenToFile(tokensDirectory: string, token: InterceptorToken) {
  const tokeFilePath = path.join(tokensDirectory, token.id);

  const tokenFileContent = interceptorTokenFileContentSchema.parse({
    version: 1,
    token: {
      id: token.id,
      name: token.name,
      secret: {
        hash: token.secret.hash,
        salt: token.secret.salt,
      },
      createdAt: token.createdAt.toISOString(),
    },
  } satisfies InterceptorTokenFileContent.Input);

  await fs.promises.writeFile(tokeFilePath, JSON.stringify(tokenFileContent), {
    mode: 0o600,
    encoding: 'utf-8',
  });

  return tokeFilePath;
}

export async function readInterceptorTokenFromFile(
  tokenId: InterceptorToken['id'],
  options: { tokensDirectory: string },
): Promise<PersistedInterceptorToken | null> {
  if (!isValidInterceptorTokenId(tokenId)) {
    throw new InvalidInterceptorTokenError(tokenId);
  }

  const tokenFilePath = path.join(options.tokensDirectory, tokenId);
  const tokenFileExists = await pathExists(tokenFilePath);

  if (!tokenFileExists) {
    return null;
  }

  const tokenFileContentAsString = await fs.promises.readFile(tokenFilePath, {
    encoding: 'utf-8',
  });

  const tokenFileContentValidation = interceptorTokenFileContentSchema.safeParse(
    JSON.parse(tokenFileContentAsString) as unknown,
  );

  if (!tokenFileContentValidation.success) {
    const error = new InvalidInterceptorTokenFileError(tokenFilePath);
    error.cause = tokenFileContentValidation.error;
    throw error;
  }

  const {
    data: { token },
  } = tokenFileContentValidation;

  return token;
}

export async function listInterceptorTokens(options: { tokensDirectory: string }) {
  const tokensDirectoryExists = await pathExists(options.tokensDirectory);

  if (!tokensDirectoryExists) {
    return [];
  }

  const files = await fs.promises.readdir(options.tokensDirectory);
  const tokenIds = files.filter((file) => isValidInterceptorTokenId(file));

  const tokenReadPromises = tokenIds.map((tokenId) => readInterceptorTokenFromFile(tokenId, options));
  const tokenCandidates = await Promise.allSettled(tokenReadPromises);

  const tokens: PersistedInterceptorToken[] = [];

  for (const tokenCandidate of tokenCandidates) {
    if (tokenCandidate.status === 'rejected') {
      console.error(tokenCandidate.reason);
      continue;
    }

    if (tokenCandidate.value !== null) {
      tokens.push(tokenCandidate.value);
    }
  }

  tokens.sort((token, otherToken) => token.createdAt.getTime() - otherToken.createdAt.getTime());

  return tokens;
}

export async function validateInterceptorToken(tokenValue: unknown, options: { tokensDirectory: string }) {
  try {
    if (typeof tokenValue !== 'string') {
      throw new InvalidInterceptorTokenError();
    }

    const tokenValueBuffer = Buffer.from(tokenValue, 'base64url');
    const tokenId = tokenValueBuffer.subarray(0, INTERCEPTOR_TOKEN_ID_LENGTH).toString('hex');
    const tokenSecret = tokenValueBuffer.subarray(INTERCEPTOR_TOKEN_ID_LENGTH).toString('hex');

    const tokenFromFile = await readInterceptorTokenFromFile(tokenId, options);
    if (!tokenFromFile) {
      return false;
    }

    const tokenSecretHash = await hashInterceptorToken(tokenSecret, tokenFromFile.secret.salt);
    return tokenSecretHash === tokenFromFile.secret.hash;
  } catch (error) {
    if (error instanceof InterceptorAuthError) {
      throw error;
    }

    const newError = new InvalidInterceptorTokenError();
    newError.cause = error;
    throw newError;
  }
}
