import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import clsx from 'clsx';
import type { AppProps } from 'next/app';
import { Inter } from 'next/font/google';
import { useState } from 'react';

import InterceptorProvider from '../providers/interceptors/InterceptorProvider';

import '../styles/global.css';

const inter = Inter({ subsets: ['latin'] });

function App({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <InterceptorProvider>
        <div className={clsx(inter.className, 'bg-slate-100 flex flex-col items-center justify-center min-h-screen')}>
          <Component {...pageProps} />
        </div>
      </InterceptorProvider>
    </QueryClientProvider>
  );
}

export default App;
