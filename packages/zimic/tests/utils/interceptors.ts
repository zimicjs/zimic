import { HttpInterceptor } from '@/interceptor';
import { HttpInterceptorSchema } from '@/interceptor/http/interceptor/types/schema';

export async function usingHttpInterceptor<Schema extends HttpInterceptorSchema>(
  interceptor: HttpInterceptor<Schema>,
  callback: () => Promise<void> | void,
) {
  try {
    await callback();
  } finally {
    interceptor.stop();
  }
}
