'use client';

import { PropsWithChildren, useEffect } from 'react';

import { loadInterceptors } from '../../tests/interceptors';

type Props = PropsWithChildren;

function InterceptorProvider({ children }: Props) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      void loadInterceptors();
    }
  }, []);

  return children;
}

export default InterceptorProvider;
