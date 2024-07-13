import ts from 'typescript';

export function isNeverType(type: ts.TypeNode) {
  return type.kind === ts.SyntaxKind.NeverKeyword;
}

export function isUnknownType(type: ts.TypeNode) {
  return type.kind === ts.SyntaxKind.UnknownKeyword;
}

export function isNumericType(type: ts.TypeNode) {
  return type.kind === ts.SyntaxKind.NumberKeyword;
}

export function isBooleanType(type: ts.TypeNode) {
  return type.kind === ts.SyntaxKind.BooleanKeyword;
}

export function isNullType(type: ts.TypeNode | ts.LiteralTypeNode['literal']) {
  return type.kind === ts.SyntaxKind.NullKeyword;
}

export function createBlobType() {
  return ts.factory.createTypeReferenceNode('Blob');
}

export function createNullType() {
  return ts.factory.createLiteralTypeNode(ts.factory.createNull());
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
