import { PropsWithChildren, useEffect } from 'react';

import { loadInterceptors } from '../../../tests/interceptors';

type Props = PropsWithChildren;

function InterceptorProvider({ children }: Props) {
  useEffect(() => {
    void loadInterceptors();
  }, []);

  return children;
}

export default InterceptorProvider;
