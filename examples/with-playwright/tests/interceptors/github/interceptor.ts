import { createHttpInterceptor } from 'zimic/interceptor';

import { GITHUB_API_BASE_URL, GitHubRepository } from '../../../src/services/github';

const githubInterceptor = createHttpInterceptor<{
  '/repos/:owner/:name': {
    GET: {
      response: {
        200: { body: GitHubRepository };
        404: { body: { message: string } };
        500: { body: { message: string } };
      };
    };
  };
}>({
  type: 'remote',
  baseURL: GITHUB_API_BASE_URL,
});

export default githubInterceptor;
