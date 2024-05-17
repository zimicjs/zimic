import { useRouter } from 'next/router';

import { HomePageSearchParams } from '../app/hooks/useHomePageSearchParams';
import GitHubRepositoryForm from './components/GitHubRepositoryForm';
import GitHubRepositoryShowcase from './components/GitHubRepositoryShowcase';

export default function Home() {
  const router = useRouter();

  const { owner: ownerName, repo: repositoryName } = router.query as HomePageSearchParams;
  const shouldFetchRepository = ownerName && repositoryName;

  return (
    <main className="bg-white rounded-xl mx-auto flex flex-col items-center w-full max-w-[24rem] p-8 shadow-lg space-y-6">
      <div className="text-center">
        <h1 className="font-bold text-2xl">Search a GitHub Repo!</h1>
        <h2 className="text-slate-700">Pages Router</h2>
      </div>

      <GitHubRepositoryForm />

      {shouldFetchRepository && <GitHubRepositoryShowcase ownerName={ownerName} repositoryName={repositoryName} />}
    </main>
  );
}
