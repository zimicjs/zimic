const INDENTATION = '  ';
const IDENTIFIER_REGEX = /^[A-Za-z_$][A-Za-z_$0-9]*$/;

type KeywordTypeName = 'any' | 'boolean' | 'never' | 'null' | 'number' | 'string' | 'undefined';

interface KeywordTypeExpression {
  kind: 'keyword';
  name: KeywordTypeName;
  code: string;
}

interface CompositeTypeExpression {
  kind: 'union' | 'intersection';
  members: TypeExpression[];
  code: string;
}

interface OtherTypeExpression {
  kind: 'literal' | 'reference' | 'array' | 'tuple' | 'object';
  code: string;
}

/**
 * A generated TypeScript type. The `code` may span multiple lines, with indentation relative to its first line, so it
 * can be embedded at any depth.
 */
export type TypeExpression = KeywordTypeExpression | CompositeTypeExpression | OtherTypeExpression;

function createKeywordType(name: KeywordTypeName): KeywordTypeExpression {
  return { kind: 'keyword', name, code: name };
}

/** Untyped schemas generate `any`. This instance identifies them, so they can be skipped where they add no value. */
export const ANY_TYPE = createKeywordType('any');
export const BOOLEAN_TYPE = createKeywordType('boolean');
export const NEVER_TYPE = createKeywordType('never');
export const NULL_TYPE = createKeywordType('null');
export const NUMBER_TYPE = createKeywordType('number');
export const STRING_TYPE = createKeywordType('string');

const PRIMITIVE_TYPE_NAMES = new Set<KeywordTypeName>(['boolean', 'never', 'null', 'number', 'string', 'undefined']);

export function isPrimitiveType(type: TypeExpression) {
  return type.kind === 'keyword' && PRIMITIVE_TYPE_NAMES.has(type.name);
}

function indentLines(code: string) {
  return code.replace(/\n/g, `\n${INDENTATION}`);
}

function parenthesizeComposite(type: TypeExpression) {
  return type.kind === 'union' || type.kind === 'intersection' ? `(${type.code})` : type.code;
}

/** Repeated primitive keywords add nothing to a union or intersection, so only their first occurrence is kept. */
function removeDuplicatePrimitives(types: TypeExpression[]) {
  const seenPrimitiveNames = new Set<KeywordTypeName>();

  return types.filter((type) => {
    if (type.kind !== 'keyword' || !isPrimitiveType(type)) {
      return true;
    }

    if (seenPrimitiveNames.has(type.name)) {
      return false;
    }

    seenPrimitiveNames.add(type.name);
    return true;
  });
}

export function stringLiteral(value: string) {
  return JSON.stringify(value);
}

export function propertyKey(name: string) {
  const isNonNegativeNumber = String(Number(name)) === name && !name.startsWith('-');

  if (isNonNegativeNumber || IDENTIFIER_REGEX.test(name)) {
    return name;
  }

  return stringLiteral(name);
}

export function referenceType(name: string, typeArguments: TypeExpression[] = []): TypeExpression {
  const typeArgumentsCode = typeArguments.length > 0 ? `<${typeArguments.map((type) => type.code).join(', ')}>` : '';
  return { kind: 'reference', code: `${name}${typeArgumentsCode}` };
}

export function indexedAccessType(objectType: TypeExpression, indexes: string[]): TypeExpression {
  const indexesCode = indexes.map((index) => `[${stringLiteral(index)}]`).join('');
  return { kind: 'reference', code: `${parenthesizeComposite(objectType)}${indexesCode}` };
}

export function arrayType(elementType: TypeExpression): TypeExpression {
  return { kind: 'array', code: `${parenthesizeComposite(elementType)}[]` };
}

export function tupleType(elementTypes: TypeExpression[]): TypeExpression {
  if (elementTypes.length === 0) {
    return { kind: 'tuple', code: '[]' };
  }

  const elementsCode = elementTypes.map((type) => `${INDENTATION}${indentLines(type.code)}`).join(',\n');
  return { kind: 'tuple', code: `[\n${elementsCode}\n]` };
}

function createCompositeType(kind: CompositeTypeExpression['kind'], types: TypeExpression[]): TypeExpression {
  if (types.length === 0) {
    return NEVER_TYPE;
  }

  if (types.length === 1) {
    return types[0];
  }

  const members = removeDuplicatePrimitives(types);
  const separator = kind === 'union' ? ' | ' : ' & ';

  return { kind, members, code: members.map(parenthesizeComposite).join(separator) };
}

export function unionType(types: TypeExpression[]): TypeExpression {
  return createCompositeType('union', types);
}

export function intersectionType(types: TypeExpression[]): TypeExpression {
  return createCompositeType('intersection', types);
}

/** Appends `null` to a type, keeping a union type grouped, as in `(A | B) | null`. */
export function nullableType(type: TypeExpression): TypeExpression {
  const members = [type, NULL_TYPE];
  return { kind: 'union', members, code: members.map(parenthesizeComposite).join(' | ') };
}

/** A member of an object type or interface, such as a property or an index signature, with its leading comment. */
export type TypeMember = string;

interface TypeMemberOptions {
  key: string;
  type: TypeExpression;
  isOptional?: boolean;
  isReadonly?: boolean;
  comment?: string;
}

export function typeMember({ key, type, isOptional = false, isReadonly = false, comment }: TypeMemberOptions) {
  const modifiers = isReadonly ? 'readonly ' : '';
  const signature = `${modifiers}${key}${isOptional ? '?' : ''}: ${type.code};`;
  return comment === undefined ? signature : `${comment}\n${signature}`;
}

export function indexSignatureKey(parameterName: string, keyType: TypeExpression) {
  return `[${parameterName}: ${keyType.code}]`;
}

function membersBlock(members: TypeMember[]) {
  return members.map((member) => `${INDENTATION}${indentLines(member)}`).join('\n');
}

export function objectType(members: TypeMember[]): TypeExpression {
  return { kind: 'object', code: members.length === 0 ? '{}' : `{\n${membersBlock(members)}\n}` };
}

export function literalType(value: unknown): TypeExpression {
  if (typeof value === 'string') {
    return { kind: 'literal', code: stringLiteral(value) };
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return { kind: 'literal', code: String(value) };
  }

  if (value === null) {
    return NULL_TYPE;
  }

  if (Array.isArray(value)) {
    return value.length === 0 ? arrayType(NEVER_TYPE) : tupleType(value.map(literalType));
  }

  if (typeof value === 'object') {
    const members = Object.entries(value).map(([key, propertyValue]) =>
      typeMember({ key: propertyKey(key), type: literalType(propertyValue) }),
    );

    return members.length > 0 ? objectType(members) : referenceType('Record', [STRING_TYPE, NEVER_TYPE]);
  }

  return ANY_TYPE;
}

export function interfaceDeclaration(name: string, members: TypeMember[]) {
  const membersCode = members.length === 0 ? '' : `${membersBlock(members)}\n`;
  return `export interface ${name} {\n${membersCode}}`;
}

export function typeAliasDeclaration(name: string, type: TypeExpression) {
  return `export type ${name} = ${type.code};`;
}

export function typeImportDeclaration(importNames: string[], moduleName: string) {
  return `import type { ${importNames.join(', ')} } from ${stringLiteral(moduleName)};`;
}
