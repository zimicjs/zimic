import createCachedDynamicImport from '@zimic/utils/import/createCachedDynamicImport';

export const importExeca = createCachedDynamicImport(() => import('execa'));
