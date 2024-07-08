import { httpInterceptor } from 'zimic/interceptor/http';

import { GITHUB_API_BASE_URL, GitHubRepository } from '../../src/app';

const githubInterceptor = httpInterceptor.create<{
  '/repos/:owner/:name': {
    GET: {
      response: {
        200: { body: GitHubRepository };
        404: { body: { message: string } };
      };
    };
  };
}>({
  type: 'local',
  baseURL: GITHUB_API_BASE_URL,
  saveRequests: true,
});

export default githubInterceptor;
