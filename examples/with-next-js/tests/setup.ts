import '@testing-library/jest-dom/vitest';

import { beforeAll, beforeEach, afterAll, vi } from 'vitest';

import githubInterceptor from './interceptors/github';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn().mockImplementation(() => ({})),
  useSearchParams: vi.fn().mockImplementation(() => new URLSearchParams()),
}));

vi.mock('next/font/google', () => ({
  Inter: () => ({
    className: 'font-inter',
  }),
}));

beforeAll(async () => {
  await githubInterceptor.start();

  process.env.GITHUB_API_BASE_URL = 'https://api.github.com';
});

beforeEach(async () => {
  await githubInterceptor.clear();
});

afterAll(async () => {
  await githubInterceptor.stop();
});
