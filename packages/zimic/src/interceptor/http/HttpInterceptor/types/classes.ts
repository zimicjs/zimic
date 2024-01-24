import BrowserHttpInterceptor from '../browser/BrowserHttpInterceptor';
import NodeHttpInterceptor from '../node/NodeHttpInterceptor';

export type HttpInterceptorClass = typeof BrowserHttpInterceptor | typeof NodeHttpInterceptor;
