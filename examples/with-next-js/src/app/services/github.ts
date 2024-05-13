import type { JSONValue } from 'zimic';

export function getGitHubAPIBaseURL() {
  return process.env.GITHUB_API_BASE_URL ?? '';
}

export type GitHubRepository = JSONValue<{
  id: number;
  full_name: string;
  html_url: string;
}>;

export async function fetchGitHubRepository(ownerName: string, repositoryName: string) {
  const repositoryURL = `${getGitHubAPIBaseURL()}/repos/${ownerName}/${repositoryName}`;
  const repositoryResponse = await fetch(repositoryURL);

  if (repositoryResponse.status !== 200) {
    return null;
  }

  const repository = (await repositoryResponse.json()) as GitHubRepository;
  return repository;
}
