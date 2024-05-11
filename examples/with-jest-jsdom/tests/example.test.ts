import { beforeEach, describe, expect, it } from '@jest/globals';
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

import renderApp, { GitHubRepository } from '../src/app';
import githubInterceptor from './interceptors/github';

describe('Example tests', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should render a GitHub repository, if found', async () => {
    const zimicRepository: GitHubRepository = {
      id: 1,
      full_name: 'diego-aquino/zimic',
      html_url: 'https://github.com/diego-aquino/zimic',
    };

    const getRepositoryTracker = githubInterceptor.get('/repos/:owner/:name').respond({
      status: 200,
      body: zimicRepository,
    });

    renderApp();

    const ownerInput = screen.getByRole('textbox', { name: 'Owner' });
    await userEvent.type(ownerInput, 'diego-aquino');

    const repositoryInput = screen.getByRole('textbox', { name: 'Repository' });
    await userEvent.type(repositoryInput, 'zimic');

    const searchButton = screen.getByRole('button', { name: 'Search' });
    await userEvent.click(searchButton);

    const repositoryName = await screen.findByRole('heading', { name: zimicRepository.full_name });
    expect(repositoryName).toBeInTheDocument();

    const repositoryURL = await screen.findByRole('link', { name: zimicRepository.html_url });
    expect(repositoryURL).toBeInTheDocument();

    const getRequests = getRepositoryTracker.requests();
    expect(getRequests).toHaveLength(1);
  });

  it('should return a 404 status code, if the GitHub repository is not found', async () => {
    const getRepositoryTracker = githubInterceptor.get('/repos/:owner/:name').respond({
      status: 404,
      body: { message: 'Not Found' },
    });

    renderApp();

    const ownerInput = screen.getByRole('textbox', { name: 'Owner' });
    await userEvent.type(ownerInput, 'diego-aquino');

    const repositoryInput = screen.getByRole('textbox', { name: 'Repository' });
    await userEvent.type(repositoryInput, 'zimic');

    const searchButton = screen.getByRole('button', { name: 'Search' });
    await userEvent.click(searchButton);

    const repositoryName = await screen.findByRole('heading', { name: 'Repository not found' });
    expect(repositoryName).toBeInTheDocument();

    const repositoryURLPromise = screen.findByRole('link', {}, { timeout: 200 });
    await expect(repositoryURLPromise).rejects.toThrowError();

    const getRequests = getRepositoryTracker.requests();
    expect(getRequests).toHaveLength(1);
  });
});
