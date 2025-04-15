import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProps } from 'next/app';
import { Inter } from 'next/font/google';
import { useEffect, useMemo, useState } from 'react';

import githubInterceptor, { githubMockData } from '../../tests/interceptors/github';
import environment from '../config/environment';
import { cn } from '../utils/styles';


import '../styles/global.css';

const SHOULD_LOAD_MOCK_DATA = environment.NODE_ENV !== 'production';

const inter = Inter({ subsets: ['latin'] });

function App({ Component, pageProps }: AppProps) {
  const queryClient = useMemo(() => new QueryClient(), []);

  const [isLoadingMockData, setIsLoadingMockData] = useState(SHOULD_LOAD_MOCK_DATA);

  useEffect(() => {
    void (async () => {
      if (SHOULD_LOAD_MOCK_DATA) {
        await githubInterceptor.start();
        githubMockData.apply();

        setIsLoadingMockData(false);
      }
    })();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div className={cn(inter.className, 'bg-slate-100 flex flex-col items-center justify-center min-h-screen')}>
        {!isLoadingMockData && <Component {...pageProps} />}
      </div>
    </QueryClientProvider>
  );
}

export default App;
