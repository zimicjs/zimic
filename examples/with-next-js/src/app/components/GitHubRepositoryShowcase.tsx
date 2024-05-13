import type { JSONValue } from 'zimic';

export const GITHUB_API_BASE_URL = 'https://api.github.com';

export type GitHubRepository = JSONValue<{
  id: number;
  full_name: string;
  html_url: string;
}>;

async function fetchGitHubRepository(ownerName: string, repositoryName: string) {
  const repositoryURL = `${GITHUB_API_BASE_URL}/repos/${ownerName}/${repositoryName}`;
  const repositoryResponse = await fetch(repositoryURL);

  if (repositoryResponse.status === 404) {
    return null;
  }

  if (repositoryResponse.status !== 200) {
    throw new Error(`Failed to fetch repository: ${repositoryResponse.status} ${await repositoryResponse.text()}`);
  }

  const repository = (await repositoryResponse.json()) as GitHubRepository;
  return repository;
}

interface Props {
  ownerName: string;
  repositoryName: string;
}

async function GitHubRepositoryShowcase({ ownerName, repositoryName }: Props) {
  const repository = await fetchGitHubRepository(ownerName, repositoryName);

  return (
    <section className="w-full">
      {repository ? (
        <>
          <h1 className="font-medium">Repository:</h1>
          <a
            className="text-blue-700 hover:underline"
            href={repository.html_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {repository.full_name}
          </a>
        </>
      ) : (
        <p>Repository not found.</p>
      )}
    </section>
  );
}

export default GitHubRepositoryShowcase;
