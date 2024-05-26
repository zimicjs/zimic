import { beforeEach, describe, expect, it } from '@jest/globals';
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

import renderApp, { GitHubRepository } from '../src/app';
import githubInterceptor from './interceptors/github';

describe('Example tests', () => {
  const ownerName = 'owner';
  const repositoryName = 'example';

  const repository: GitHubRepository = {
    id: 1,
    full_name: `${ownerName}/${repositoryName}`,
    html_url: `https://github.com/${ownerName}/${repositoryName}`,
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

    const repositoryLink = await screen.findByRole('link', { name: repository.html_url });
    expect(repositoryLink).toBeInTheDocument();

    const getRequests = getRepositoryHandler.requests();
    expect(getRequests).toHaveLength(1);
  });

  it('should return a 404 status code, if the GitHub repository is not found', async () => {
    const getRepositoryHandler = githubInterceptor.get('/repos/:owner/:name').respond({
      status: 404,
      body: { message: 'Not Found' },
    });

    renderApp();

    const ownerInput = screen.getByRole('textbox', { name: 'Owner' });
    await userEvent.type(ownerInput, ownerName);

    const repositoryInput = screen.getByRole('textbox', { name: 'Repository' });
    await userEvent.type(repositoryInput, repositoryName);

    const searchButton = screen.getByRole('button', { name: 'Search' });
    await userEvent.click(searchButton);

    const repositoryHeading = await screen.findByRole('heading', { name: 'Repository not found' });
    expect(repositoryHeading).toBeInTheDocument();

    const repositoryLinkPromise = screen.findByRole('link', {}, { timeout: 200 });
    await expect(repositoryLinkPromise).rejects.toThrowError();

    const getRequests = getRepositoryHandler.requests();
    expect(getRequests).toHaveLength(1);
  });
});
