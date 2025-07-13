import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import color from 'picocolors';
import util from 'util';
import * as z from 'zod';

import {
  BASE64URL_REGEX,
  convertHexLengthToBase64urlLength,
  convertHexLengthToByteLength,
  HEX_REGEX,
} from '@/utils/data';
import { pathExists } from '@/utils/files';
import { logger } from '@/utils/logging';

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
export const INTERCEPTOR_TOKEN_VALUE_BASE64URL_LENGTH = convertHexLengthToBase64urlLength(
  INTERCEPTOR_TOKEN_VALUE_HEX_LENGTH,
);

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

interface InterceptorTokenSecret {
  hash: string;
  salt: string;
  value: string;
}

export interface InterceptorToken {
  id: string;
  name?: string;
  secret: InterceptorTokenSecret;
  value: string;
  createdAt: Date;
}

export function createInterceptorTokenId() {
  return crypto.randomUUID().replace(/[^a-z0-9]/g, '');
}

export function isValidInterceptorTokenId(tokenId: string) {
  return tokenId.length === INTERCEPTOR_TOKEN_ID_HEX_LENGTH && HEX_REGEX.test(tokenId);
}

function isValidInterceptorTokenValue(tokenValue: string) {
  return tokenValue.length === INTERCEPTOR_TOKEN_VALUE_BASE64URL_LENGTH && BASE64URL_REGEX.test(tokenValue);
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
    id: z.string().length(INTERCEPTOR_TOKEN_ID_HEX_LENGTH).regex(HEX_REGEX),
    name: z.string().optional(),
    secret: z.object({
      hash: z.string().length(INTERCEPTOR_TOKEN_HASH_HEX_LENGTH).regex(HEX_REGEX),
      salt: z.string().length(INTERCEPTOR_TOKEN_SALT_HEX_LENGTH).regex(HEX_REGEX),
    }),
    createdAt: z.iso.datetime().transform((value) => new Date(value)),
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

  const tokenFileContentAsString = await fs.promises.readFile(tokenFilePath, { encoding: 'utf-8' });

  const validation = interceptorTokenFileContentSchema.safeParse(JSON.parse(tokenFileContentAsString) as unknown);

  if (!validation.success) {
    throw new InvalidInterceptorTokenFileError(tokenFilePath, validation.error.message);
  }

  return validation.data.token;
}

export async function createInterceptorToken(
  options: { name?: string; tokensDirectory?: string } = {},
): Promise<InterceptorToken> {
  const { name, tokensDirectory = DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY } = options;

  const tokensDirectoryExists = await pathExists(tokensDirectory);

  if (!tokensDirectoryExists) {
    await createInterceptorTokensDirectory(tokensDirectory);
  }

  const tokenId = createInterceptorTokenId();

  /* istanbul ignore if -- @preserve
   * This should never happen, but let's check that the token identifier is valid after generated. */
  if (!isValidInterceptorTokenId(tokenId)) {
    throw new InvalidInterceptorTokenError(tokenId);
  }

  const tokenSecretSizeInBytes = convertHexLengthToByteLength(INTERCEPTOR_TOKEN_SECRET_HEX_LENGTH);
  const tokenSecret = crypto.randomBytes(tokenSecretSizeInBytes).toString('hex');

  const tokenSecretSaltSizeInBytes = convertHexLengthToByteLength(INTERCEPTOR_TOKEN_SALT_HEX_LENGTH);
  const tokenSecretSalt = crypto.randomBytes(tokenSecretSaltSizeInBytes).toString('hex');
  const tokenSecretHash = await hashInterceptorToken(tokenSecret, tokenSecretSalt);

  const tokenValue = Buffer.from(`${tokenId}${tokenSecret}`, 'hex').toString('base64url');

  /* istanbul ignore if -- @preserve
   * This should never happen, but let's check that the token value is valid after generated. */
  if (!isValidInterceptorTokenValue(tokenValue)) {
    throw new InvalidInterceptorTokenValueError(tokenValue);
  }

  const token: InterceptorToken = {
    id: tokenId,
    name,
    secret: {
      hash: tokenSecretHash,
      salt: tokenSecretSalt,
      value: tokenSecret,
    },
    value: tokenValue,
    createdAt: new Date(),
  };

  await saveInterceptorTokenToFile(tokensDirectory, token);

  return token;
}

export async function listInterceptorTokens(options: { tokensDirectory?: string } = {}) {
  const { tokensDirectory = DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY } = options;

  const tokensDirectoryExists = await pathExists(tokensDirectory);

  if (!tokensDirectoryExists) {
    return [];
  }

  const files = await fs.promises.readdir(tokensDirectory);

  const tokenReadPromises = files.map(async (file) => {
    if (!isValidInterceptorTokenId(file)) {
      return null;
    }

    const tokenId = file;
    const token = await readInterceptorTokenFromFile(tokenId, { tokensDirectory });
    return token;
  });

  const tokenCandidates = await Promise.allSettled(tokenReadPromises);

  const tokens: PersistedInterceptorToken[] = [];

  for (const tokenCandidate of tokenCandidates) {
    if (tokenCandidate.status === 'rejected') {
      console.error(tokenCandidate.reason);
    } else if (tokenCandidate.value !== null) {
      tokens.push(tokenCandidate.value);
    }
  }

  tokens.sort((token, otherToken) => token.createdAt.getTime() - otherToken.createdAt.getTime());

  return tokens;
}

export async function validateInterceptorToken(tokenValue: string, options: { tokensDirectory: string }) {
  if (!isValidInterceptorTokenValue(tokenValue)) {
    throw new InvalidInterceptorTokenValueError(tokenValue);
  }

  const decodedTokenValue = Buffer.from(tokenValue, 'base64url').toString('hex');

  const tokenId = decodedTokenValue.slice(0, INTERCEPTOR_TOKEN_ID_HEX_LENGTH);
  const tokenSecret = decodedTokenValue.slice(
    INTERCEPTOR_TOKEN_ID_HEX_LENGTH,
    INTERCEPTOR_TOKEN_ID_HEX_LENGTH + INTERCEPTOR_TOKEN_VALUE_HEX_LENGTH,
  );

  const tokenFromFile = await readInterceptorTokenFromFile(tokenId, options);

  if (!tokenFromFile) {
    throw new InvalidInterceptorTokenValueError(tokenValue);
  }

  const tokenSecretHash = await hashInterceptorToken(tokenSecret, tokenFromFile.secret.salt);

  if (tokenSecretHash !== tokenFromFile.secret.hash) {
    throw new InvalidInterceptorTokenValueError(tokenValue);
  }
}

export async function removeInterceptorToken(tokenId: string, options: { tokensDirectory?: string } = {}) {
  const { tokensDirectory = DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY } = options;

  /* istanbul ignore if -- @preserve
   * At this point, we should have a valid tokenId. This is just a sanity check. */
  if (!isValidInterceptorTokenId(tokenId)) {
    throw new InvalidInterceptorTokenError(tokenId);
  }

  const tokenFilePath = path.join(tokensDirectory, tokenId);

  await fs.promises.rm(tokenFilePath, { force: true });
}
