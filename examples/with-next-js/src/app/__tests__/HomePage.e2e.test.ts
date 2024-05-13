import test, { expect } from '@playwright/test';

import githubInterceptor from '../../../tests/interceptors/github';
import { GitHubRepository } from '../services/github';

import '@tests/setup';

test.describe('Home page', () => {
  const ownerName = 'diego-aquino';
  const repositoryName = 'zimic';

  const repository: GitHubRepository = {
    id: 1,
    full_name: 'diego-aquino/zimic',
    html_url: 'https://github.com/diego-aquino/zimic',
  };

  test.beforeAll(async () => {
    await githubInterceptor.get('/repos/:owner/:repo').respond({
      status: 404,
      body: { message: 'Not Found' },
    });

    await githubInterceptor.get(`/repos/${ownerName}/${repositoryName}`).respond({
      status: 200,
      body: repository,
    });
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should render a GitHub repository, if found', async ({ page }) => {
    const getHandler = await githubInterceptor.get('/repos/:owner/:repo').respond({
      status: 200,
      body: repository,
    });

    const ownerInput = page.getByRole('textbox', { name: 'Owner' });
    await expect(ownerInput).toBeVisible();
    await ownerInput.fill(ownerName);

    const repositoryInput = page.getByRole('textbox', { name: 'Repository' });
    await expect(repositoryInput).toBeVisible();
    await repositoryInput.fill(repositoryName);

    const submitButton = page.getByRole('button', { name: 'Search' });
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    const repositoryLink = page.getByRole('link', { name: repository.full_name });
    await expect(repositoryLink).toBeVisible();
    await expect(repositoryLink).toHaveAttribute('href', repository.html_url);
    await expect(repositoryLink).toHaveAttribute('target', '_blank');
    await expect(repositoryLink).toHaveAttribute('rel', 'noopener noreferrer');

    const getRequests = await getHandler.requests();
    expect(getRequests).toHaveLength(1);
  });

  test('should render a message if the GitHub repository is not found', async ({ page }) => {
    const getHandler = await githubInterceptor.get(`/repos/${ownerName}/${repositoryName}`).respond({
      status: 404,
      body: { message: 'Not Found' },
    });

    const ownerInput = page.getByRole('textbox', { name: 'Owner' });
    await expect(ownerInput).toBeVisible();
    await ownerInput.fill(ownerName);

    const repositoryInput = page.getByRole('textbox', { name: 'Repository' });
    await expect(repositoryInput).toBeVisible();
    await repositoryInput.fill(repositoryName);

    const submitButton = page.getByRole('button', { name: 'Search' });
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    const notFoundMessage = page.getByRole('status');
    await expect(notFoundMessage).toBeVisible();
    await expect(notFoundMessage).toHaveText('Repository not found.');

    const getRequests = await getHandler.requests();
    expect(getRequests).toHaveLength(1);
  });
});
