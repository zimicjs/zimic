import { createHttpInterceptor } from '@zimic/interceptor/http';

import { GITHUB_API_BASE_URL, GitHubSchema } from '../../src/clients/github';

const githubInterceptor = createHttpInterceptor<GitHubSchema>({
  type: 'local',
  baseURL: GITHUB_API_BASE_URL,
  saveRequests: true,
});

export default githubInterceptor;
