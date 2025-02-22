import { HttpSchema } from '@zimic/http';
import {
  httpInterceptor,
  HttpInterceptorOptions,
  LocalHttpInterceptor,
  RemoteHttpInterceptor,
} from '@zimic/interceptor/http';

import { PossiblePromise } from '@/types/utils';

type UsingInterceptorCallback<Schema extends HttpSchema> = (
  interceptor: LocalHttpInterceptor<Schema> | RemoteHttpInterceptor<Schema>,
) => PossiblePromise<void>;

export async function usingHttpInterceptor<Schema extends HttpSchema>(
  interceptorOptions: HttpInterceptorOptions,
  callback: UsingInterceptorCallback<HttpSchema<Schema>>,
): Promise<void> {
  const interceptor = httpInterceptor.create<Schema>({
    ...interceptorOptions,
    onUnhandledRequest: { action: 'reject', log: false },
  });

  try {
    await interceptor.start();

    await callback(interceptor);

    await interceptor.checkTimes();
  } finally {
    await interceptor.stop();
  }
}
