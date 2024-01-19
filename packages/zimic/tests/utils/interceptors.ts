import BrowserHttpInterceptor from '@/interceptor/http/HttpInterceptor/BrowserHttpInterceptor';
import NodeHttpInterceptor from '@/interceptor/http/HttpInterceptor/NodeHttpInterceptor';
import { HttpInterceptorSchema } from '@/interceptor/http/HttpInterceptor/types/schema';

export async function usingHttpInterceptor<Schema extends HttpInterceptorSchema>(
  interceptor: BrowserHttpInterceptor<Schema> | NodeHttpInterceptor<Schema>,
  callback: () => Promise<void> | void,
) {
  try {
    await callback();
  } finally {
    interceptor.stop();
  }
}
