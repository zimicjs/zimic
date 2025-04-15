import { createHttpInterceptor } from '@zimic/interceptor/http';

import { GITHUB_API_BASE_URL } from '../../src/config/github';
import { GitHubSchema } from '../../src/types/github';

const githubInterceptor = createHttpInterceptor<GitHubSchema>({
  baseURL: GITHUB_API_BASE_URL,
});

export default githubInterceptor;
