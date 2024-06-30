import { createImportDeclaration, createImportSpecifier } from '../utils/types';
import { TypeTransformContext } from './context';

export const TYPEGEN_ROOT_IMPORT_MODULE = process.env.TYPEGEN_ROOT_IMPORT_MODULE ?? 'zimic';

export function createImportDeclarations(context: TypeTransformContext) {
  if (context.typeImports.root.size === 0) {
    return [];
  }

  const rootTypeImports = Array.from(context.typeImports.root).sort().map(createImportSpecifier);
  const rootImportDeclaration = createImportDeclaration(rootTypeImports, TYPEGEN_ROOT_IMPORT_MODULE, {
    typeOnly: true,
  });
  return [rootImportDeclaration];
}
