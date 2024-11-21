import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import clsx from 'clsx';
import type { AppProps } from 'next/app';
import { Inter } from 'next/font/google';
import { useEffect, useMemo, useState } from 'react';

import { loadInterceptors } from '../../tests/interceptors/utils';

import '../styles/global.css';

const inter = Inter({ subsets: ['latin'] });
const SHOULD_LOAD_INTERCEPTORS = process.env.NODE_ENV !== 'production';

function App({ Component, pageProps }: AppProps) {
  const queryClient = useMemo(() => new QueryClient(), []);

  const [isLoading, setIsLoading] = useState(SHOULD_LOAD_INTERCEPTORS);

  useEffect(() => {
    if (SHOULD_LOAD_INTERCEPTORS) {
      void (async () => {
        await loadInterceptors();
        setIsLoading(false);
      })();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div className={clsx(inter.className, 'bg-slate-100 flex flex-col items-center justify-center min-h-screen')}>
        {!isLoading && <Component {...pageProps} />}
      </div>
    </QueryClientProvider>
  );
}

export default App;
