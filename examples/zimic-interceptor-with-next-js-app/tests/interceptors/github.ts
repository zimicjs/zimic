import { createHttpInterceptor } from '@zimic/interceptor/http';

import { GitHubRepository, GitHubSchema } from '../../src/clients/github';
import environment from '../../src/config/environment';

const githubInterceptor = createHttpInterceptor<GitHubSchema>({
  type: 'remote',
  baseURL: environment.GITHUB_API_BASE_URL,
});

export const githubMockData = {
  repositories: [
    {
      id: 1,
      name: 'zimic-example',
      full_name: 'zimicjs/zimic-example',
      html_url: 'https://github.com/zimicjs/zimic-example',
      owner: { login: 'zimicjs' },
    },
  ] satisfies GitHubRepository[],

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
