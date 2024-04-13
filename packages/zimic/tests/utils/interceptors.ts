import { HttpServiceSchema } from '@/http/types/schema';
import { HttpInterceptor, createHttpInterceptor } from '@/interceptor';
import LocalHttpInterceptor from '@/interceptor/http/interceptor/LocalHttpInterceptor';
import RemoteHttpInterceptor from '@/interceptor/http/interceptor/RemoteHttpInterceptor';
import {
  LocalHttpInterceptorOptions,
  RemoteHttpInterceptorOptions,
} from '@/interceptor/http/interceptor/types/options';

export async function usingHttpInterceptor<Schema extends HttpServiceSchema>(
  options: LocalHttpInterceptorOptions | RemoteHttpInterceptorOptions,
  callback: (interceptor: LocalHttpInterceptor<Schema> | RemoteHttpInterceptor<Schema>) => Promise<void> | void,
) {
  const interceptor = createHttpInterceptor<Schema>(options) satisfies HttpInterceptor<Schema> as
    | LocalHttpInterceptor<Schema>
    | RemoteHttpInterceptor<Schema>;

  try {
    await callback(interceptor);
  } finally {
    await interceptor.clear();
  }
}
