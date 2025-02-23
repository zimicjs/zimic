import { expect } from 'vitest';

import { PossiblePromise } from '@/types';

import waitFor, { WaitForOptions } from './waitFor';

async function waitForNot(callback: () => PossiblePromise<void>, options?: WaitForOptions) {
  const waitForPromise = waitFor(callback, { timeout: 100, ...options });
  await expect(waitForPromise).rejects.toThrowError();
}

export default waitForNot;
