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

export function isNumberType(type: ts.TypeNode) {
  return type.kind === ts.SyntaxKind.NumberKeyword;
}
