import { cache } from 'react';
import type { JSONValue } from 'zimic';

import environment from '../config/environment';
import { waitForLoadedInterceptors } from '../providers/interceptors/utils';

const CACHE_STRATEGY = process.env.NODE_ENV === 'development' ? 'no-store' : 'default';

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
    const url = `${environment.GITHUB_API_BASE_URL}/repos/${ownerName}/${repositoryName}`;
    const response = await fetch(url, { cache: CACHE_STRATEGY });

    if (response.status !== 200) {
      return null;
    }

    const repository = (await response.json()) as GitHubRepository;
    return repository;
  } catch (error) {
    console.error(error);
    return null;
  }
});
