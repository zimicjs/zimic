import { HttpInterceptorEnvironment } from '../../HttpInterceptor/types/options';

class InvalidInterceptorEnvironmentError extends Error {
  constructor(environment: unknown) {
    const validEnvironments = Object.values(HttpInterceptorEnvironment)
      .map((environment) => `'${environment}'`)
      .join(', ');

    super(`Invalid interceptor environment: ${environment}. The valid options are ${validEnvironments}.`);
  }
}

export default InvalidInterceptorEnvironmentError;
