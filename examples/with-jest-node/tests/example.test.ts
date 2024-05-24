import { beforeAll, describe, expect, it, afterAll } from '@jest/globals';
import supertest from 'supertest';

import app, { GitHubRepository } from '../src/app';
import githubInterceptor from './interceptors/github';

describe('Example tests', () => {
  const ownerName = 'diego-aquino';
  const repositoryName = 'zimic';

  const repository: GitHubRepository = {
    id: 1,
    full_name: 'diego-aquino/zimic',
    html_url: 'https://github.com/diego-aquino/zimic',
  };

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return a GitHub repository, if found', async () => {
    const getRepositoryHandler = githubInterceptor.get(`/repos/${ownerName}/${repositoryName}`).respond({
      status: 200,
      body: repository,
    });

    const response = await supertest(app.server).get(`/github/repositories/${ownerName}/${repositoryName}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: repository.id,
      fullName: repository.full_name,
      homepageURL: repository.html_url,
    });

    const getRequests = getRepositoryHandler.requests();
    expect(getRequests).toHaveLength(1);
  });

  it('should return a 404 status code, if the GitHub repository is not found', async () => {
    const getRepositoryHandler = githubInterceptor.get('/repos/:owner/:name').respond({
      status: 404,
      body: { message: 'Not Found' },
    });

    const response = await supertest(app.server).get(`/github/repositories/${ownerName}/${repositoryName}`);
    expect(response.status).toBe(404);
    expect(response.body).toEqual({});

    const getRequests = getRepositoryHandler.requests();
    expect(getRequests).toHaveLength(1);
  });
});
