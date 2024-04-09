import { HttpServiceSchema } from '@/http/types/schema';
import { LocalHttpInterceptor, createHttpInterceptor } from '@/interceptor';
import { LocalHttpInterceptorOptions } from '@/interceptor/http/interceptor/types/options';

export async function usingLocalHttpInterceptor<Schema extends HttpServiceSchema>(
  options: LocalHttpInterceptorOptions,
  callback: (interceptor: LocalHttpInterceptor<Schema>) => Promise<void> | void,
) {
  const interceptor = createHttpInterceptor<Schema>(options);

  try {
    await callback(interceptor);
  } finally {
    interceptor.clear();
  }
}
