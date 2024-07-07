import { http } from 'zimic/interceptor/http';

import environment from '../../src/config/environment';
import { GitHubRepository } from '../../src/services/github';

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

export const githubFixtures = {
  repository: {
    id: 1,
    name: 'example',
    full_name: 'owner/example',
    html_url: 'https://github.com/owner/example',
    owner: { login: 'owner' },
  } satisfies GitHubRepository,

  apply() {
    githubInterceptor.get('/repos/:owner/:name').respond({
      status: 404,
      body: { message: 'Not Found' },
    });

    githubInterceptor.get(`/repos/${this.repository.owner.login}/${this.repository.name}`).respond({
      status: 200,
      body: this.repository,
    });
  },
};

export default githubInterceptor;
