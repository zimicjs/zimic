import type { JSONValue } from 'zimic';

const GITHUB_API_BASE_URL = process.env.GITHUB_API_BASE_URL ?? '';

export type GitHubRepository = JSONValue<{
  id: number;
  full_name: string;
  html_url: string;
}>;

export async function fetchGitHubRepository(ownerName: string, repositoryName: string) {
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
}
