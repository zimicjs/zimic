import { createFetch } from '@zimic/fetch';

import { GitHubSchema } from './typegen/generated';

export const GITHUB_API_BASE_URL = 'https://api.github.com';

export const githubFetch = createFetch<GitHubSchema>({
  baseURL: GITHUB_API_BASE_URL,
});

export async function fetchGitHubRepository(ownerName: string, repositoryName: string) {
  const response = await githubFetch(`/repos/${ownerName}/${repositoryName}`, { method: 'GET' });

  if (response.status === 404 || response.status === 301) {
    return null;
  }

  if (!response.ok) {
    throw response.error;
  }

  const repository = await response.json();
  return repository;
}
