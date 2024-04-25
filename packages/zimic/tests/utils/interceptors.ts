import { HttpServiceSchema } from '@/http/types/schema';
import { createHttpInterceptor, HttpInterceptor } from '@/interceptor';
import LocalHttpInterceptor from '@/interceptor/http/interceptor/LocalHttpInterceptor';
import RemoteHttpInterceptor from '@/interceptor/http/interceptor/RemoteHttpInterceptor';
import {
  LocalHttpInterceptorOptions,
  RemoteHttpInterceptorOptions,
} from '@/interceptor/http/interceptor/types/options';
import { createHttpInterceptorWorker } from '@/interceptor/http/interceptorWorker/factory';
import LocalHttpInterceptorWorker from '@/interceptor/http/interceptorWorker/LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker from '@/interceptor/http/interceptorWorker/RemoteHttpInterceptorWorker';
import { HttpInterceptorWorkerOptions } from '@/interceptor/http/interceptorWorker/types/options';
import { PublicHttpInterceptorWorker } from '@/interceptor/http/interceptorWorker/types/public';

export function createInternalHttpInterceptorWorker(workerOptions: HttpInterceptorWorkerOptions) {
  return createHttpInterceptorWorker(workerOptions) satisfies PublicHttpInterceptorWorker as
    | LocalHttpInterceptorWorker
    | RemoteHttpInterceptorWorker;
}

export function createInternalHttpInterceptor<Schema extends HttpServiceSchema>(
  options: LocalHttpInterceptorOptions | RemoteHttpInterceptorOptions,
) {
  return createHttpInterceptor<Schema>(options) satisfies HttpInterceptor<Schema> as
    | LocalHttpInterceptor<Schema>
    | RemoteHttpInterceptor<Schema>;
}

export async function usingHttpInterceptor<Schema extends HttpServiceSchema>(
  options: LocalHttpInterceptorOptions | RemoteHttpInterceptorOptions,
  callback: (interceptor: LocalHttpInterceptor<Schema> | RemoteHttpInterceptor<Schema>) => Promise<void> | void,
) {
  const interceptor = createInternalHttpInterceptor<Schema>(options);

  try {
    await callback(interceptor);
  } finally {
    await interceptor.clear();
  }
}
