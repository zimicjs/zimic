import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app, { GitHubRepository } from '../src/app';
import githubInterceptor from './interceptors/githubInterceptor';

describe('Example tests', () => {
  const zimicRepository: GitHubRepository = {
    id: 1,
    name: 'zimic',
    topics: ['api', 'http'],
  };

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return a GitHub repository, if found', async () => {
    const getRepositoryTracker = githubInterceptor.get('/repos/:owner/:name').respond({
      status: 200,
      body: zimicRepository,
    });

    const response = await supertest(app.server).get('/github/repositories/diego-aquino/zimic');
    expect(response.status).toBe(200);
    expect(response.body).toEqual(zimicRepository);

    const getRequests = getRepositoryTracker.requests();
    expect(getRequests).toHaveLength(1);
  });

  it('should return a 404 status code, if the GitHub repository is not found', async () => {
    const getRepositoryTracker = githubInterceptor.get('/repos/:owner/:name').respond({
      status: 404,
      body: { message: 'Not Found' },
    });

    const response = await supertest(app.server).get('/github/repositories/diego-aquino/zimic');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({});

    const getRequests = getRepositoryTracker.requests();
    expect(getRequests).toHaveLength(1);
  });
});
