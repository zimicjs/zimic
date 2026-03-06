import { createHttpInterceptor } from '@zimic/interceptor/http';

import { GITHUB_API_BASE_URL } from '@/clients/github/client';
import { GitHubSchema } from '@/clients/github/typegen/generated';

const githubInterceptor = createHttpInterceptor<GitHubSchema>({
  baseURL: GITHUB_API_BASE_URL,
});

export default githubInterceptor;
