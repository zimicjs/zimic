import { httpInterceptor } from 'zimic/interceptor/http';

import { GITHUB_API_BASE_URL } from '../../src/app';
import { GitHubSchema } from '../../src/types/github/typegen/generated';

const githubInterceptor = httpInterceptor.create<GitHubSchema>({
  type: 'local',
  baseURL: GITHUB_API_BASE_URL,
  saveRequests: true,
});

export default githubInterceptor;
