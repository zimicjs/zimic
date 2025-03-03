import { createImportDeclaration, createImportSpecifier } from '../utils/types';
import { TypeTransformContext } from './context';

/* istanbul ignore next -- @preserve
 * The root import module is defined at build time. The fallback is not expected to be used. */
export const TYPEGEN_HTTP_IMPORT_MODULE = process.env.TYPEGEN_HTTP_IMPORT_MODULE ?? '@zimic/http';

export function createImportDeclarations(context: TypeTransformContext) {
  const httpTypeImports = Array.from(context.typeImports.http).sort().map(createImportSpecifier);
  const httpImportDeclaration = createImportDeclaration(httpTypeImports, TYPEGEN_HTTP_IMPORT_MODULE, {
    typeOnly: true,
  });

  return [httpImportDeclaration];
}
