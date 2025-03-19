import { HttpSchema } from '@zimic/http';
import {
  HttpInterceptor,
  createHttpInterceptor,
  HttpInterceptorOptions,
  LocalHttpInterceptor,
  RemoteHttpInterceptor,
} from '@zimic/interceptor/http';
import { PossiblePromise } from '@zimic/utils/types';
import { afterAll, afterEach } from 'vitest';

const interceptorsToCheckTimes: HttpInterceptor<never>[] = [];

afterEach(async () => {
  try {
    for (const interceptor of interceptorsToCheckTimes) {
      await interceptor.checkTimes();
    }
  } finally {
    interceptorsToCheckTimes.length = 0;
  }
});

const interceptorsToStop: HttpInterceptor<never>[] = [];

afterAll(async () => {
  try {
    for (const interceptor of interceptorsToStop) {
      await interceptor.stop();
    }
  } finally {
    interceptorsToStop.length = 0;
  }
});

type UsingInterceptorCallback<Schema extends HttpSchema> = (
  interceptor: LocalHttpInterceptor<Schema> | RemoteHttpInterceptor<Schema>,
) => PossiblePromise<void>;

export async function usingHttpInterceptor<Schema extends HttpSchema>(
  interceptorOptions: HttpInterceptorOptions,
  callback: UsingInterceptorCallback<Schema>,
): Promise<void> {
  const interceptor = createHttpInterceptor<Schema>(interceptorOptions);

  await interceptor.start();

  interceptorsToCheckTimes.push(interceptor);
  interceptorsToStop.push(interceptor);

  await callback(interceptor);
}
