import { createFetch } from '@zimic/fetch';

import { GitHubSchema } from './typegen/generated';

export const GITHUB_API_BASE_URL = 'https://api.github.com';

export const githubFetch = createFetch<GitHubSchema>({
  baseURL: GITHUB_API_BASE_URL,
});
