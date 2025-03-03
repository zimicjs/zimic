import { httpInterceptor } from '@zimic/interceptor/http';

import { GITHUB_API_BASE_URL, GitHubSchema } from '../../src/clients/github';

const githubInterceptor = httpInterceptor.create<GitHubSchema>({
  type: 'local',
  baseURL: GITHUB_API_BASE_URL,
});

export default githubInterceptor;
