import { createCachedDynamicImport } from '@/import';
import { PossiblePromise } from '@/types';

import waitFor, { WaitForOptions } from './waitFor';

const importVitest = createCachedDynamicImport(() => import('vitest'));

async function waitForNot(callback: () => PossiblePromise<void>, options?: WaitForOptions) {
  // We need to dynamically import Vitest to avoid including it in non-test environments.
  const { expect } = await importVitest();

  const waitForPromise = waitFor(callback, { timeout: 100, ...options });
  await expect(waitForPromise).rejects.toThrowError();
}

export default waitForNot;
