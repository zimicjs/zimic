import { describe, expect, it } from 'vitest';

import { GITHUB_API_BASE_URL } from '../src/config/github';
import { GitHubRepository } from '../src/types/github';
import githubInterceptor from './interceptors/github';

describe('Example tests', () => {
  const repository: GitHubRepository = {
    id: 1,
    name: 'zimic',
    full_name: 'zimicjs/zimic',
    html_url: 'https://github.com/zimicjs/zimic',
    owner: { login: 'zimicjs' },
  };

  it('should return a GitHub repository, if found', async () => {
    githubInterceptor
      .get('/repos/zimicjs/zimic')
      .respond({
        status: 200,
        body: repository,
      })
      .times(1);

    const response = await fetch(`${GITHUB_API_BASE_URL}/repos/zimicjs/zimic`);
    expect(response.status).toBe(200);

    const data = (await response.json()) as GitHubRepository;
    expect(data).toEqual(repository);
  });

  it('should return a 404 status code, if the GitHub repository is not found', async () => {
    githubInterceptor
      .get('/repos/:owner/:name')
      .respond({
        status: 404,
        body: { message: 'Not Found' },
      })
      .times(1);

    const response = await fetch(`${GITHUB_API_BASE_URL}/repos/unknown/unknown`);
    expect(response.status).toBe(404);

    const data = (await response.json()) as { message: string };
    expect(data).toEqual({ message: 'Not Found' });
  });
});
