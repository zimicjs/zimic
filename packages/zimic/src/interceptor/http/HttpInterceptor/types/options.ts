enum HttpInterceptorEnvironmentEnum {
  BROWSER = 'browser',
  NODE = 'node',
}
type HttpInterceptorEnvironmentUnion = `${HttpInterceptorEnvironmentEnum}`;

export type HttpInterceptorEnvironment = HttpInterceptorEnvironmentEnum | HttpInterceptorEnvironmentUnion;
export const HttpInterceptorEnvironment = HttpInterceptorEnvironmentEnum; // eslint-disable-line @typescript-eslint/no-redeclare

export interface HttpInterceptorOptions {
  baseURL?: string;
}
