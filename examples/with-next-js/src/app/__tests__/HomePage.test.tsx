import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useRouter } from 'next/navigation';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import githubInterceptor from '../../../tests/interceptors/github';
import HomePage from '../page';
import { GitHubRepository } from '../services/github';

const useRouterMock = vi.mocked(useRouter);

describe('Home page', () => {
  const routerReplace = vi.fn();

  beforeAll(() => {
    useRouterMock.mockReturnValue({
      replace: routerReplace,
    } as unknown as AppRouterInstance);
  });

  beforeEach(() => {
    routerReplace.mockClear();
  });

  it('should render a GitHub repository, if found', async () => {
    const ownerName = 'diego-aquino';
    const repositoryName = 'zimic';

    const repository: GitHubRepository = {
      id: 1,
      full_name: 'diego-aquino/zimic',
      html_url: 'https://github.com/diego-aquino/zimic',
    };

    const getRepositoryHandler = await githubInterceptor.get(`/repos/${ownerName}/${repositoryName}`).respond({
      status: 200,
      body: repository,
    });

    const { rerender } = render(<></>);
    rerender(<HomePage searchParams={{}} />);

    const ownerInput = await screen.findByRole('textbox', { name: 'Owner' });
    await userEvent.type(ownerInput, ownerName);

    const repositoryInput = await screen.findByRole('textbox', { name: 'Repository' });
    await userEvent.type(repositoryInput, repositoryName);

    const submitButton = await screen.findByRole('button', { name: 'Search' });
    await userEvent.click(submitButton);

    rerender(<HomePage searchParams={{ owner: ownerName, repo: repositoryName }} />);

    const repositoryLink = await screen.findByRole('link', { name: repository.full_name });
    expect(repositoryLink).toHaveAttribute('href', repository.html_url);
    expect(repositoryLink).toHaveAttribute('target', '_blank');
    expect(repositoryLink).toHaveAttribute('rel', 'noopener noreferrer');

    const getRepositoryRequests = await getRepositoryHandler.requests();
    expect(getRepositoryRequests).toHaveLength(1);
  });

  it('should render a message if the GitHub repository is not found', async () => {
    const ownerName = 'diego-aquino';
    const repositoryName = 'zimic';

    const getRepositoryHandler = await githubInterceptor.get(`/repos/${ownerName}/${repositoryName}`).respond({
      status: 404,
      body: { message: 'Not Found' },
    });

    const { rerender } = render(<></>);
    rerender(<HomePage searchParams={{}} />);

    const ownerInput = await screen.findByRole('textbox', { name: 'Owner' });
    await userEvent.type(ownerInput, ownerName);

    const repositoryInput = await screen.findByRole('textbox', { name: 'Repository' });
    await userEvent.type(repositoryInput, repositoryName);

    const submitButton = await screen.findByRole('button', { name: 'Search' });
    await userEvent.click(submitButton);

    rerender(<HomePage searchParams={{ owner: ownerName, repo: repositoryName }} />);

    const message = await screen.findByText('Repository not found.');
    expect(message).toBeInTheDocument();

    const getRepositoryRequests = await getRepositoryHandler.requests();
    expect(getRepositoryRequests).toHaveLength(1);
  });
});
