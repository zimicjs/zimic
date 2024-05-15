import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export interface HomePageSearchParams {
  owner?: string;
  repo?: string;
}

function useHomePageSearchParams() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const ownerName = searchParams.get('owner' satisfies keyof HomePageSearchParams) ?? '';
  const repositoryName = searchParams.get('repo' satisfies keyof HomePageSearchParams) ?? '';

  const setSearchParams = useCallback((params: Partial<HomePageSearchParams>) => {
    const newSearchParams = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        newSearchParams.set(key, value);
      } else {
        newSearchParams.delete(key);
      }
    }
    router.replace(`?${newSearchParams.toString()}`);
  }, []);

  return {
    ownerName,
    repositoryName,
    set: setSearchParams,
  };
}

export default useHomePageSearchParams;
