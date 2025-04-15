import { describe, expect, it } from 'vitest';

import { githubFetch, GitHubRepository } from '../src/clients/github';
import githubInterceptor from './interceptors/github';
import { expectResponseStatus } from './utils/expect';

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

    const response = await githubFetch('/repos/zimicjs/zimic', { method: 'GET' });
    expectResponseStatus(response, 200);

    const data = await response.json();
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

    const response = await githubFetch('/repos/unknown/unknown', { method: 'GET' });
    expectResponseStatus(response, 404);

    const data = await response.json();
    expect(data).toEqual({ message: 'Not Found' });
  });
});
