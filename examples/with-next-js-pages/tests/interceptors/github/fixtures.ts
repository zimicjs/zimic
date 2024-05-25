import { GitHubRepository } from '../../../src/services/github';
import githubInterceptor from './interceptor';

export const githubFixtures = {
  repository: {
    id: 1,
    name: 'example',
    full_name: 'owner/example',
    html_url: 'https://github.com/owner/example',
    owner: { login: 'owner' },
  },
} satisfies Record<string, GitHubRepository>;

export function applyGitHubFixtures() {
  const { repository } = githubFixtures;

  githubInterceptor.get('/repos/:owner/:name').respond({
    status: 404,
    body: { message: 'Not Found' },
  });

  githubInterceptor.get(`/repos/${repository.owner.login}/${repository.name}`).respond({
    status: 200,
    body: repository,
  });
}
