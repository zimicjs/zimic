import ts from 'typescript';

export function isNeverType(type: ts.TypeNode | undefined): type is undefined {
  return !type || type.kind === ts.SyntaxKind.NeverKeyword;
}

export function isNeverTypeMember(member: ts.TypeElement) {
  return ts.isPropertySignature(member) && member.type !== undefined && isNeverType(member.type);
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
