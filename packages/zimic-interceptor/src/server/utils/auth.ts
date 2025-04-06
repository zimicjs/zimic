import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import color from 'picocolors';
import util from 'util';
import { z } from 'zod';

import { convertHexLengthToBase64urlLength, convertHexLengthToByteLength } from '@/utils/data';
import { pathExists } from '@/utils/files';
import { logger } from '@/utils/logging';

import InterceptorAuthError from '../errors/InterceptorAuthError';
import InvalidInterceptorTokenError from '../errors/InvalidInterceptorTokenError';
import InvalidInterceptorTokenFileError from '../errors/InvalidInterceptorTokenFileError';
import InvalidInterceptorTokenValueError from '../errors/InvalidInterceptorTokenValueError';

export const DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY = path.join(
  '.zimic',
  'interceptor',
  'server',
  `tokens${process.env.VITEST_POOL_ID}`,
);

export const INTERCEPTOR_TOKEN_ID_HEX_LENGTH = 32;
export const INTERCEPTOR_TOKEN_SECRET_HEX_LENGTH = 64;
export const INTERCEPTOR_TOKEN_VALUE_HEX_LENGTH = INTERCEPTOR_TOKEN_ID_HEX_LENGTH + INTERCEPTOR_TOKEN_SECRET_HEX_LENGTH;

export const INTERCEPTOR_TOKEN_ID_REGEX = new RegExp(`^[a-z0-9]{${INTERCEPTOR_TOKEN_ID_HEX_LENGTH}}$`);

export const INTERCEPTOR_TOKEN_SALT_HEX_LENGTH = 64;
export const INTERCEPTOR_TOKEN_HASH_ITERATIONS = Number(process.env.INTERCEPTOR_TOKEN_HASH_ITERATIONS);
export const INTERCEPTOR_TOKEN_HASH_HEX_LENGTH = 128;
export const INTERCEPTOR_TOKEN_HASH_ALGORITHM = 'sha512';

const pbkdf2 = util.promisify(crypto.pbkdf2);

async function hashInterceptorToken(plainToken: string, salt: string) {
  const hashBuffer = await pbkdf2(
    plainToken,
    salt,
    INTERCEPTOR_TOKEN_HASH_ITERATIONS,
    convertHexLengthToByteLength(INTERCEPTOR_TOKEN_HASH_HEX_LENGTH),
    INTERCEPTOR_TOKEN_HASH_ALGORITHM,
  );

  const hash = hashBuffer.toString('hex');
  return hash;
}

export interface InterceptorToken {
  id: string;
  name?: string;
  secret: {
    hash: string;
    salt: string;
  };
  value: string;
  createdAt: Date;
}

function isValidInterceptorTokenId(tokenId: string) {
  return INTERCEPTOR_TOKEN_ID_REGEX.test(tokenId);
}

export function createInterceptorTokenId() {
  return crypto.randomUUID().replace(/[^a-z0-9]/g, '');
}

export async function createInterceptorToken(options: { tokenName?: string }): Promise<InterceptorToken> {
  const tokenId = createInterceptorTokenId();

  const tokenSecretSizeInBytes = convertHexLengthToByteLength(INTERCEPTOR_TOKEN_SECRET_HEX_LENGTH);
  const tokenSecret = crypto.randomBytes(tokenSecretSizeInBytes).toString('hex');

  const tokenSecretSaltSizeInBytes = convertHexLengthToByteLength(INTERCEPTOR_TOKEN_SALT_HEX_LENGTH);
  const tokenSecretSalt = crypto.randomBytes(tokenSecretSaltSizeInBytes).toString('hex');
  const tokenSecretHash = await hashInterceptorToken(tokenSecret, tokenSecretSalt);

  const tokenValue = Buffer.from(`${tokenId}${tokenSecret}`, 'hex').toString('base64url');

  return {
    id: tokenId,
    name: options.tokenName,
    secret: {
      hash: tokenSecretHash,
      salt: tokenSecretSalt,
    },
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
    logger.error(
      `${color.red(color.bold('✖'))} Failed to create the tokens directory: ${color.magenta(tokensDirectory)}`,
    );
    throw error;
  }
}

const interceptorTokenFileContentSchema = z.object({
  version: z.literal(1),
  token: z.object({
    id: z.string().length(INTERCEPTOR_TOKEN_ID_HEX_LENGTH).regex(INTERCEPTOR_TOKEN_ID_REGEX),
    name: z.string().optional(),
    secret: z.object({
      hash: z.string().length(INTERCEPTOR_TOKEN_HASH_HEX_LENGTH),
      salt: z.string().length(INTERCEPTOR_TOKEN_SALT_HEX_LENGTH),
    }),
    createdAt: z
      .string()
      .datetime()
      .transform((value) => new Date(value)),
  }),
});

export type InterceptorTokenFileContent = z.infer<typeof interceptorTokenFileContentSchema>;

export namespace InterceptorTokenFileContent {
  export type Input = z.input<typeof interceptorTokenFileContentSchema>;
}

export type PersistedInterceptorToken = InterceptorTokenFileContent['token'];

namespace PersistedInterceptorToken {
  export type Input = InterceptorTokenFileContent.Input['token'];
}

export async function saveInterceptorTokenToFile(tokensDirectory: string, token: InterceptorToken) {
  const tokeFilePath = path.join(tokensDirectory, token.id);

  const persistedToken: PersistedInterceptorToken.Input = {
    id: token.id,
    name: token.name,
    secret: {
      hash: token.secret.hash,
      salt: token.secret.salt,
    },
    createdAt: token.createdAt.toISOString(),
  };

  const tokenFileContent = interceptorTokenFileContentSchema.parse({
    version: 1,
    token: persistedToken,
  } satisfies InterceptorTokenFileContent.Input);

  await fs.promises.writeFile(tokeFilePath, JSON.stringify(tokenFileContent, null, 2), {
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

export async function validateInterceptorToken(tokenValue: string, options: { tokensDirectory: string }) {
  try {
    const expectedTokenValueBase64urlLength = convertHexLengthToBase64urlLength(INTERCEPTOR_TOKEN_VALUE_HEX_LENGTH);

    if (tokenValue.length !== expectedTokenValueBase64urlLength) {
      throw new InvalidInterceptorTokenValueError(tokenValue);
    }

    const decodedTokenValue = Buffer.from(tokenValue, 'base64url').toString('hex');

    const tokenId = decodedTokenValue.slice(0, INTERCEPTOR_TOKEN_ID_HEX_LENGTH);
    const tokenSecret = decodedTokenValue.slice(INTERCEPTOR_TOKEN_ID_HEX_LENGTH, INTERCEPTOR_TOKEN_VALUE_HEX_LENGTH);

    const tokenFromFile = await readInterceptorTokenFromFile(tokenId, options);

    if (!tokenFromFile) {
      throw new InvalidInterceptorTokenValueError(tokenValue);
    }

    const tokenSecretHash = await hashInterceptorToken(tokenSecret, tokenFromFile.secret.salt);

    if (tokenSecretHash !== tokenFromFile.secret.hash) {
      throw new InvalidInterceptorTokenValueError(tokenValue);
    }
  } catch (error) {
    if (error instanceof InterceptorAuthError) {
      throw error;
    }

    const newError = new InvalidInterceptorTokenValueError(tokenValue);
    newError.cause = error;
    throw newError;
  }
}

export async function removeInterceptorToken(tokenId: string, options: { tokensDirectory: string }) {
  const tokenFilePath = path.join(options.tokensDirectory, tokenId);

  await fs.promises.rm(tokenFilePath, { force: true });
}
