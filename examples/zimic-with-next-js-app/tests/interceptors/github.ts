import { createHttpInterceptor } from '@zimic/interceptor/http';

import { GitHubSchema } from '../../src/clients/github';
import environment from '../../src/config/environment';
import { createGitHubRepository } from '../factories/github';

const githubInterceptor = createHttpInterceptor<GitHubSchema>({
  type: 'remote',
  baseURL: environment.GITHUB_API_BASE_URL,
});

export const githubMockData = {
  repositories: [createGitHubRepository()],

  async apply() {
    await githubInterceptor.get('/repos/:owner/:name').respond({
      status: 404,
      body: { message: 'Not Found' },
    });

    await Promise.all(
      this.repositories.map(async (repository) => {
        await githubInterceptor
          .get(`/repos/${repository.owner.login}/${repository.name}`)
          .respond({ status: 200, body: repository });
      }),
    );
  },
};

export default githubInterceptor;
