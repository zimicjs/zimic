import { createHttpInterceptor } from '@zimic/interceptor/http';

import { GitHubRepository, GitHubSchema } from '../../src/clients/github';
import environment from '../../src/config/environment';

const githubInterceptor = createHttpInterceptor<GitHubSchema>({
  type: 'remote',
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

  async apply() {
    await githubInterceptor.get('/repos/:owner/:name').respond({
      status: 404,
      body: { message: 'Not Found' },
    });

    await githubInterceptor.get(`/repos/${this.repository.owner.login}/${this.repository.name}`).respond({
      status: 200,
      body: this.repository,
    });
  },
};

export default githubInterceptor;
