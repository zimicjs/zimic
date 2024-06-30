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
