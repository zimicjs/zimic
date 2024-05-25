import { useQuery } from '@tanstack/react-query';

import { fetchGitHubRepository } from '../../services/github';

interface Props {
  ownerName: string;
  repositoryName: string;
}

function GitHubRepositoryShowcase({ ownerName, repositoryName }: Props) {
  const { data: repository = null, isLoading } = useQuery({
    queryKey: ['github-repository', { ownerName, repositoryName }],
    queryFn: () => fetchGitHubRepository(ownerName, repositoryName),
    enabled: !!ownerName && !!repositoryName,
  });

  if (isLoading) {
    return <p role="status">Loading...</p>;
  }

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
        <p role="status">Repository not found.</p>
      )}
    </div>
  );
}

export default GitHubRepositoryShowcase;
