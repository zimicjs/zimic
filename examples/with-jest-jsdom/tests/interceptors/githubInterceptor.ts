import { createHttpInterceptor } from 'zimic/interceptor';

import { GITHUB_API_BASE_URL, GitHubRepository } from '../../src/app';
import interceptorWorker from './worker';

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
  worker: interceptorWorker,
  baseURL: GITHUB_API_BASE_URL,
});

export default githubInterceptor;
