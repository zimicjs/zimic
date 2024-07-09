import { createImportDeclaration, createImportSpecifier } from '../utils/types';
import { TypeTransformContext } from './context';

/* istanbul ignore next -- @preserve
 * The root import module is defined at build time. The fallback is not expected to be used. */
export const TYPEGEN_ROOT_IMPORT_MODULE = process.env.TYPEGEN_ROOT_IMPORT_MODULE ?? 'zimic';

export function createImportDeclarations(context: TypeTransformContext) {
  const rootTypeImports = Array.from(context.typeImports.http).sort().map(createImportSpecifier);
  const rootImportDeclaration = createImportDeclaration(rootTypeImports, TYPEGEN_ROOT_IMPORT_MODULE, {
    typeOnly: true,
  });
  return [rootImportDeclaration];
}
