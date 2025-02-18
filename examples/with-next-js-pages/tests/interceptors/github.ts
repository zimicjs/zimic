import { httpInterceptor } from 'zimic/interceptor/http';

import { GitHubRepository, GitHubSchema } from '../../src/clients/github';
import environment from '../../src/config/environment';

const githubInterceptor = httpInterceptor.create<GitHubSchema>({
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
