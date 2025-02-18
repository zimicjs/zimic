import { beforeAll, describe, expect, it, afterAll } from '@jest/globals';
import supertest from 'supertest';

import app from '../src/app';
import { GitHubRepository } from '../src/clients/github';
import githubInterceptor from './interceptors/github';

describe('Example tests', () => {
  const ownerName = 'owner';
  const repositoryName = 'example';

  const repository: GitHubRepository = {
    id: 1,
    name: repositoryName,
    full_name: `${ownerName}/${repositoryName}`,
    html_url: `https://github.com/${ownerName}/${repositoryName}`,
    owner: { login: ownerName },
  };

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return a GitHub repository, if found', async () => {
    githubInterceptor
      .get(`/repos/${ownerName}/${repositoryName}`)
      .respond({
        status: 200,
        body: repository,
      })
      .times(1);

    const response = await supertest(app.server).get(`/github/repositories/${ownerName}/${repositoryName}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: repository.id,
      fullName: repository.full_name,
      homepageURL: repository.html_url,
    });
  });

  it('should return a 404 status code, if the GitHub repository is not found', async () => {
    githubInterceptor
      .get('/repos/:owner/:name')
      .respond({
        status: 404,
        body: { message: 'Not Found' },
      })
      .times(1);

    const response = await supertest(app.server).get(`/github/repositories/${ownerName}/${repositoryName}`);
    expect(response.status).toBe(404);
    expect(response.body).toEqual({});
  });
});
