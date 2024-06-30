import ts from 'typescript';

export function createBlobType() {
  return ts.factory.createTypeReferenceNode('Blob');
}

export function createNullType() {
  return ts.factory.createLiteralTypeNode(ts.factory.createNull());
}

export function createUnionType(types: ts.TypeNode[]) {
  return ts.factory.createUnionTypeNode(types);
}

export function createImportSpecifier(importName: string) {
  return ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier(importName));
}

export function createImportDeclaration(
  importSpecifiers: ts.ImportSpecifier[],
  moduleName: string,
  options: { typeOnly: boolean },
) {
  return ts.factory.createImportDeclaration(
    undefined,
    ts.factory.createImportClause(options.typeOnly, undefined, ts.factory.createNamedImports(importSpecifiers)),
    ts.factory.createStringLiteral(moduleName),
  );
}
