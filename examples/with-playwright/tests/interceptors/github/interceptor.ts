import { createHttpInterceptor } from 'zimic/interceptor';

import { GitHubRepository } from '../../../src/services/github';

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
  baseURL: process.env.NEXT_PUBLIC_GITHUB_API_BASE_URL ?? '',
});

export default githubInterceptor;
