import { createHttpInterceptor } from 'zimic/interceptor';

import { GITHUB_API_BASE_URL, GitHubRepository } from '../../src/app';

const githubInterceptor = createHttpInterceptor<{
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
});

export default githubInterceptor;
