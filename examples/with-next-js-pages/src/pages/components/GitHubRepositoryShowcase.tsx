import { useQuery } from '@tanstack/react-query';

import { fetchGitHubRepository } from '../../clients/github';

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
    return <output>Loading...</output>;
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
        <output>Repository not found.</output>
      )}
    </div>
  );
}

export default GitHubRepositoryShowcase;
