import { createFetch } from '@zimic/fetch';
import type { HttpSchema } from '@zimic/http';

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

export const GITHUB_API_BASE_URL = 'https://api.github.com';

export const githubFetch = createFetch<GitHubSchema>({
  baseURL: GITHUB_API_BASE_URL,
});

export async function fetchGitHubRepository(ownerName: string, repositoryName: string) {
  const response = await githubFetch(`/repos/${ownerName}/${repositoryName}`, { method: 'GET' });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw response.error;
  }

  const repository = await response.json();
  return repository;
}
