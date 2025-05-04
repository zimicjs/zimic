import { Suspense } from 'react';

import GitHubRepositoryForm from './components/GitHubRepositoryForm';
import GitHubRepositoryShowcase from './components/GitHubRepositoryShowcase';
import { HomePageSearchParams } from './hooks/useHomePageSearchParams';

interface Props {
  searchParams: Promise<HomePageSearchParams>;
}

async function HomePage({ searchParams }: Props) {
  const { owner: ownerName, repo: repositoryName } = await searchParams;
  const shouldFetchRepository = ownerName && repositoryName;

  return (
    <main className="mx-auto flex w-full max-w-[24rem] flex-col items-center space-y-6 rounded-xl bg-white p-8 shadow-lg">
      <h1 className="text-2xl font-bold">Search a GitHub Repo!</h1>

      <GitHubRepositoryForm />

      {shouldFetchRepository && (
        <Suspense fallback={<output>Loading...</output>}>
          <GitHubRepositoryShowcase ownerName={ownerName} repositoryName={repositoryName} />
        </Suspense>
      )}
    </main>
  );
}

export default HomePage;
