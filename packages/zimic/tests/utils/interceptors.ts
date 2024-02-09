import { HttpInterceptor, HttpInterceptorOptions, createHttpInterceptor } from '@/interceptor';
import { HttpInterceptorSchema } from '@/interceptor/http/interceptor/types/schema';

export async function usingHttpInterceptor<Schema extends HttpInterceptorSchema>(
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
