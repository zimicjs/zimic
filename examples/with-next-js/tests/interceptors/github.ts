import crypto from 'crypto';
import { createHttpInterceptor } from 'zimic/interceptor';

import { GitHubRepository } from '../../src/app/services/github';

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
  baseURL: `${process.env.ZIMIC_SERVER_URL}/github-${crypto.randomUUID()}`,
});

export default githubInterceptor;
