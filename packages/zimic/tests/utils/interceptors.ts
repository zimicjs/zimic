import { HttpServiceSchema } from '@/http/types/schema';
import { HttpInterceptor, HttpInterceptorOptions, createHttpInterceptor } from '@/interceptor';

export async function usingHttpInterceptor<Schema extends HttpServiceSchema>(
  options: HttpInterceptorOptions,
  callback: (interceptor: HttpInterceptor<Schema>) => Promise<void> | void,
) {
  const interceptor = createHttpInterceptor<Schema>(options);

  try {
    await callback(interceptor);
  } finally {
    interceptor.clear();
  }
}
