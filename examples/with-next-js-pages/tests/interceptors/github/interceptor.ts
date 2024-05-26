import { http } from 'zimic/interceptor';

import environment from '../../../src/config/environment';
import { GitHubRepository } from '../../../src/services/github';

const githubInterceptor = http.createInterceptor<{
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
  type: 'local',
  baseURL: environment.GITHUB_API_BASE_URL,
});

export default githubInterceptor;
