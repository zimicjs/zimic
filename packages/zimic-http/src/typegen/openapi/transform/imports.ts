import { typeImportDeclaration } from '../utils/types';
import { TypeDependencies } from './context';

/* istanbul ignore next -- @preserve
 * The root import module is defined at build time. The fallback is not expected to be used. */
export const TYPEGEN_HTTP_IMPORT_MODULE = process.env.TYPEGEN_HTTP_IMPORT_MODULE ?? '@zimic/http';

export function createImportDeclaration(httpImports: TypeDependencies['httpImports']) {
  return typeImportDeclaration(Array.from(httpImports).sort(), TYPEGEN_HTTP_IMPORT_MODULE);
}
