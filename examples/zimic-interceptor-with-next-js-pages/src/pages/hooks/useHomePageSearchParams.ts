import { useRouter } from 'next/router';
import { useCallback } from 'react';

export interface HomePageSearchParams {
  owner?: string;
  repo?: string;
}

function useHomePageSearchParams() {
  const router = useRouter();
  const { owner: ownerName, repo: repositoryName } = router.query as HomePageSearchParams;

  const setHomePageSearchParams = useCallback(
    async (params: Partial<HomePageSearchParams>) => {
      const newURL = new URL(window.location.href);

      for (const [key, value] of Object.entries(params)) {
        if (value) {
          newURL.searchParams.set(key, value);
        } else {
          newURL.searchParams.delete(key);
        }
      }

      await router.replace(newURL);
    },
    [router],
  );

  return {
    ownerName,
    repositoryName,
    setHomePageSearchParams,
  };
}

export default useHomePageSearchParams;
