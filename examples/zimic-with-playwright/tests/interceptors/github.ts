import { createHttpInterceptor } from '@zimic/interceptor/http';

import { GitHubSchema } from '@/clients/github';
import environment from '@/config/environment';

const githubInterceptor = createHttpInterceptor<GitHubSchema>({
  type: 'remote',
  baseURL: `${environment.GITHUB_API_BASE_URL}/${environment.PLAYWRIGHT_WORKER_INDEX}`,
});

export default githubInterceptor;
