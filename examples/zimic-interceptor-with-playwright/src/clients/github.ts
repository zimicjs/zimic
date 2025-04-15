import { createFetch } from '@zimic/fetch';
import type { HttpSchema } from '@zimic/http';

import environment from '../config/environment';

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  owner: { login: string };
}

export type GitHubSchema = HttpSchema<{
  '/repos/:owner/:name': {
    GET: {
      response: {
        200: { body: GitHubRepository };
        403: { body: { message: string } };
        404: { body: { message: string } };
      };
    };
  };
}>;

export const githubFetch = createFetch<GitHubSchema>({
  baseURL: environment.GITHUB_API_BASE_URL,
});

const GITHUB_REPO_CACHE_STRATEGY = process.env.NODE_ENV === 'production' ? 'default' : 'no-store';

export async function fetchGitHubRepository(ownerName: string, repositoryName: string) {
  const sanitizedOwnerName = encodeURIComponent(ownerName);
  const sanitizedRepositoryName = encodeURIComponent(repositoryName);

  const response = await githubFetch(`/repos/${sanitizedOwnerName}/${sanitizedRepositoryName}`, {
    method: 'GET',
    cache: GITHUB_REPO_CACHE_STRATEGY,
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw response.error;
  }

  const repository = await response.json();
  return repository;
}
