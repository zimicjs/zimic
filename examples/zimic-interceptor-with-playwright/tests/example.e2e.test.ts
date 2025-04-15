import { expect } from '@playwright/test';

import { GitHubRepository } from '../src/clients/github';
import githubInterceptor from './interceptors/github';
import { test } from './playwright';

test.describe('Home page', () => {
  const repository: GitHubRepository = {
    id: 1,
    name: 'zimic-example',
    full_name: 'zimicjs/zimic-example',
    html_url: 'https://github.com/zimicjs/zimic-example',
    owner: { login: 'zimicjs' },
  };

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should render a GitHub repository, if found', async ({ page }) => {
    await githubInterceptor
      .get('/repos/zimicjs/zimic')
      .respond({
        status: 200,
        body: repository,
      })
      .times(1);

    const ownerInput = page.getByRole('textbox', { name: 'Owner' });
    await expect(ownerInput).toBeVisible();
    await ownerInput.fill(repository.owner.login);

    const repositoryInput = page.getByRole('textbox', { name: 'Repository' });
    await expect(repositoryInput).toBeVisible();
    await repositoryInput.fill(repository.name);

    const submitButton = page.getByRole('button', { name: 'Search' });
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    const repositoryLink = page.getByRole('link', { name: repository.full_name });
    await expect(repositoryLink).toBeVisible();
    await expect(repositoryLink).toHaveAttribute('href', repository.html_url);
    await expect(repositoryLink).toHaveAttribute('target', '_blank');
    await expect(repositoryLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('should render a message if the GitHub repository is not found', async ({ page }) => {
    await githubInterceptor
      .get('/repos/:owner/:name')
      .respond({
        status: 404,
        body: { message: 'Not Found' },
      })
      .times(1);

    const ownerInput = page.getByRole('textbox', { name: 'Owner' });
    await expect(ownerInput).toBeVisible();
    await ownerInput.fill('unknown');

    const repositoryInput = page.getByRole('textbox', { name: 'Repository' });
    await expect(repositoryInput).toBeVisible();
    await repositoryInput.fill('unknown');

    const submitButton = page.getByRole('button', { name: 'Search' });
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    const notFoundMessage = page.getByText('Repository not found.');
    await expect(notFoundMessage).toBeVisible();
  });
});
