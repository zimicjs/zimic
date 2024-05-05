import { beforeAll, describe, expect, it, afterAll } from '@jest/globals';
import supertest from 'supertest';

import app, { GitHubRepository } from '../src/app';
import githubInterceptor from './interceptors/github';

describe('Example tests', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return a GitHub repository, if found', async () => {
    const zimicRepository: GitHubRepository = {
      id: 1,
      full_name: 'diego-aquino/zimic',
      html_url: 'https://github.com/diego-aquino/zimic',
    };

    const getRepositoryTracker = githubInterceptor.get('/repos/:owner/:name').respond({
      status: 200,
      body: zimicRepository,
    });

    const response = await supertest(app.server).get('/github/repositories/diego-aquino/zimic');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: zimicRepository.id,
      fullName: zimicRepository.full_name,
      homepageURL: zimicRepository.html_url,
    });

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
