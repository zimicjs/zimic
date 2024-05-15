import { cache } from 'react';
import type { JSONValue } from 'zimic';

import { waitForLoadedInterceptors } from '../providers/interceptors/utils';

export const GITHUB_API_BASE_URL = process.env.NEXT_PUBLIC_GITHUB_API_BASE_URL ?? '';

export type GitHubRepository = JSONValue<{
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  owner: { login: string };
}>;

export const fetchGitHubRepository = cache(async (ownerName: string, repositoryName: string) => {
  await waitForLoadedInterceptors();

  try {
    const repositoryURL = `${GITHUB_API_BASE_URL}/repos/${ownerName}/${repositoryName}`;
    const repositoryResponse = await fetch(repositoryURL, {
      cache: process.env.NODE_ENV === 'development' ? 'no-store' : 'default',
    });

    if (repositoryResponse.status !== 200) {
      return null;
    }

    const repository = (await repositoryResponse.json()) as GitHubRepository;
    return repository;
  } catch (error) {
    console.error(error);
    return null;
  }
});
