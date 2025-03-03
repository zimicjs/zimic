import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import renderApp from '../src/app';
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

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should render a GitHub repository, if found', async () => {
    githubInterceptor
      .get(`/repos/${ownerName}/${repositoryName}`)
      .respond({
        status: 200,
        body: repository,
      })
      .times(1);

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
  });

  it('should return a 404 status code, if the GitHub repository is not found', async () => {
    githubInterceptor
      .get(`/repos/${ownerName}/${repositoryName}`)
      .respond({
        status: 404,
        body: { message: 'Not Found' },
      })
      .times(1);

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
  });
});
