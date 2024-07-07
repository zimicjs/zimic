import type { JSONValue } from 'zimic/http';

import environment from '../config/environment';

const GITHUB_API_BASE_URL = environment.GITHUB_API_BASE_URL;
const CACHE_STRATEGY = process.env.NODE_ENV === 'production' ? 'default' : 'no-store';

export type GitHubRepository = JSONValue<{
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  owner: { login: string };
}>;

export async function fetchGitHubRepository(ownerName: string, repositoryName: string) {
  try {
    const sanitizedOwnerName = encodeURIComponent(ownerName);
    const sanitizedRepositoryName = encodeURIComponent(repositoryName);

    const response = await fetch(`${GITHUB_API_BASE_URL}/repos/${sanitizedOwnerName}/${sanitizedRepositoryName}`, {
      cache: CACHE_STRATEGY,
    });

    if (response.status !== 200) {
      return null;
    }

    const repository = (await response.json()) as GitHubRepository;
    return repository;
  } catch (error) {
    console.error(error);
    return null;
  }
}
