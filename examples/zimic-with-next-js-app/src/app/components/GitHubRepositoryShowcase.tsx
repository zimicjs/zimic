import { fetchGitHubRepository } from '../../clients/github';

interface Props {
  ownerName: string;
  repositoryName: string;
}

async function GitHubRepositoryShowcase({ ownerName, repositoryName }: Props) {
  const repository = await fetchGitHubRepository(ownerName, repositoryName);

  return (
    <div className="w-full">
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
        <output>Repository not found.</output>
      )}
    </div>
  );
}

export default GitHubRepositoryShowcase;
