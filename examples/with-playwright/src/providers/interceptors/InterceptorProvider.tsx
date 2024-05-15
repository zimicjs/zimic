'use client';

import { PropsWithChildren, useEffect } from 'react';

import { loadInterceptors } from '../../../tests/interceptors';
import { markInterceptorsAsLoaded } from './utils';

type Props = PropsWithChildren;

function InterceptorProvider({ children }: Props) {
  useEffect(() => {
    async function load() {
      if (process.env.NODE_ENV === 'development') {
        await loadInterceptors();
        markInterceptorsAsLoaded();
      }
    }
    void load();
  }, []);

  return children;
}

export default InterceptorProvider;
