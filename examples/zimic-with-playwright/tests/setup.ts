import githubInterceptor from './interceptors/github';

export async function beforeAll() {
  await githubInterceptor.start();
}

export async function beforeEach() {
  await githubInterceptor.clear();
}

export async function afterEach() {
  await githubInterceptor.checkTimes();
}

export async function afterAll() {
  await githubInterceptor.stop();
}
