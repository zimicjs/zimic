import { Suspense } from 'react';

import GitHubRepositoryForm from './components/GitHubRepositoryForm';
import GitHubRepositoryShowcase from './components/GitHubRepositoryShowcase';
import { HomePageSearchParams } from './hooks/useHomePageSearchParams';

interface Props {
  searchParams: HomePageSearchParams;
}

function HomePage({ searchParams }: Props) {
  const { owner: ownerName, repo: repositoryName } = searchParams;
  const shouldFetchRepository = ownerName && repositoryName;

  return (
    <main className="bg-white rounded-xl mx-auto flex flex-col items-center w-full max-w-[24rem] p-8 shadow-lg space-y-6">
      <div className="text-center">
        <h1 className="font-bold text-2xl">Search a GitHub Repo!</h1>
        <h2 className="text-slate-700">App Router</h2>
      </div>

      <GitHubRepositoryForm />

      {shouldFetchRepository && (
        <Suspense fallback={<p role="status">Loading...</p>}>
          <GitHubRepositoryShowcase ownerName={ownerName} repositoryName={repositoryName} />
        </Suspense>
      )}
    </main>
  );
}

export default HomePage;
