import BrowserHttpInterceptor from '../BrowserHttpInterceptor';
import NodeHttpInterceptor from '../NodeHttpInterceptor';

export type HttpInterceptorClass = typeof BrowserHttpInterceptor | typeof NodeHttpInterceptor;
