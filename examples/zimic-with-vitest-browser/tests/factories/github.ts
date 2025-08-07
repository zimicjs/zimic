import { GitHubRepository } from '../../src/clients/github';

export function createGitHubRepository(partialRepository: Partial<GitHubRepository> = {}): GitHubRepository {
  return {
    id: 1,
    name: 'zimic-example',
    full_name: 'zimicjs/zimic-example',
    html_url: 'https://github.com/zimicjs/zimic-example',
    owner: { login: 'zimicjs' },
    ...partialRepository,
  };
}
