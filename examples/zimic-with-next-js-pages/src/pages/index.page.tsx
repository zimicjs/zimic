import { useRouter } from 'next/router';

import GitHubRepositoryForm from './components/GitHubRepositoryForm';
import GitHubRepositoryShowcase from './components/GitHubRepositoryShowcase';
import { HomePageSearchParams } from './hooks/useHomePageSearchParams';

export default function Home() {
  const router = useRouter();

  const { owner: ownerName, repo: repositoryName } = router.query as HomePageSearchParams;
  const shouldFetchRepository = ownerName && repositoryName;

  return (
    <main className="mx-auto flex w-full max-w-[24rem] flex-col items-center space-y-6 rounded-xl bg-white p-8 shadow-lg">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Search a GitHub Repo!</h1>
        <h2 className="text-slate-700">Pages Router</h2>
      </div>

      <GitHubRepositoryForm />

      {shouldFetchRepository && <GitHubRepositoryShowcase ownerName={ownerName} repositoryName={repositoryName} />}
    </main>
  );
}
