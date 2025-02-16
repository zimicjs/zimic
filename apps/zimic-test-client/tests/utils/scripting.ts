import { createCachedDynamicImport } from './imports';

export const importExeca = createCachedDynamicImport(() => import('execa'));
