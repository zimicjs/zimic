import { listInterceptorTokens } from '@/server/utils/auth';
import { logger } from '@/utils/logging';

interface InterceptorServerListTokensOptions {
  tokensDirectory: string;
}

export async function listInterceptorServerTokens({ tokensDirectory }: InterceptorServerListTokensOptions) {
  const tokens = await listInterceptorTokens({ tokensDirectory });

  logger.raw.table(
    [
      { title: 'ID', property: 'id' },
      { title: 'NAME', property: 'name' },
      { title: 'CREATED AT', property: 'createdAt' },
    ],
    tokens.map((token) => ({
      id: token.id,
      name: token.name ?? '',
      createdAt: token.createdAt.toISOString(),
    })),
  );
}
