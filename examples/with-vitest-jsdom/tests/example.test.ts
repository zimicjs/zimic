import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import renderApp, { GitHubRepository } from '../src/app';
import githubInterceptor from './interceptors/github';

describe('Example tests', () => {
  const ownerName = 'diego-aquino';
  const repositoryName = 'zimic';

  const repository: GitHubRepository = {
    id: 1,
    full_name: 'diego-aquino/zimic',
    html_url: 'https://github.com/diego-aquino/zimic',
  };

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should render a GitHub repository, if found', async () => {
    const getRepositoryHandler = githubInterceptor.get(`/repos/${ownerName}/${repositoryName}`).respond({
      status: 200,
      body: repository,
    });

    renderApp();

    const ownerInput = screen.getByRole('textbox', { name: 'Owner' });
    await userEvent.type(ownerInput, ownerName);

    const repositoryInput = screen.getByRole('textbox', { name: 'Repository' });
    await userEvent.type(repositoryInput, repositoryName);

    const searchButton = screen.getByRole('button', { name: 'Search' });
    await userEvent.click(searchButton);

    const repositoryHeading = await screen.findByRole('heading', { name: repository.full_name });
    expect(repositoryHeading).toBeInTheDocument();

    const repositoryURL = await screen.findByRole('link', { name: repository.html_url });
    expect(repositoryURL).toBeInTheDocument();

    const getRequests = getRepositoryHandler.requests();
    expect(getRequests).toHaveLength(1);
  });

  it('should return a 404 status code, if the GitHub repository is not found', async () => {
    const getRepositoryHandler = githubInterceptor.get(`/repos/${ownerName}/${repositoryName}`).respond({
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

    const repositoryHeading = await screen.findByRole('heading', { name: 'Repository not found' });
    expect(repositoryHeading).toBeInTheDocument();

    const repositoryURLPromise = screen.findByRole('link', {}, { timeout: 200 });
    await expect(repositoryURLPromise).rejects.toThrowError();

    const getRequests = getRepositoryHandler.requests();
    expect(getRequests).toHaveLength(1);
  });
});
