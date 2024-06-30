import ts from 'typescript';

import { isDefined } from '@/utils/data';

import { TypeTransformContext } from './context';
import { normalizeMethod } from './methods';

export function createPathsIdentifier(serviceName: string) {
  return ts.factory.createIdentifier(`${serviceName}Schema`);
}

export function isPathsDeclaration(node: ts.Node | undefined): node is ts.InterfaceDeclaration {
  return node !== undefined && ts.isInterfaceDeclaration(node) && node.name.text === 'paths';
}

function normalizePathNameWithParameters(pathName: string) {
  return pathName.replace(/{([^}]+)}/g, ':$1');
}

function wrapComponentPathType(type: ts.TypeNode, context: TypeTransformContext) {
  context.typeImports.root.add('HttpSchema');

  const httpSchemaMethodsWrapper = ts.factory.createQualifiedName(
    ts.factory.createIdentifier('HttpSchema'),
    ts.factory.createIdentifier('Methods'),
  );

  const wrappedType = ts.factory.createTypeReferenceNode(httpSchemaMethodsWrapper, [type]);
  return wrappedType;
}

export function normalizePath(
  path: ts.TypeElement,
  context: TypeTransformContext,
  options: { isComponent?: boolean } = {},
) {
  const { isComponent = false } = options;

  if (
    !ts.isPropertySignature(path) ||
    path.type === undefined ||
    !ts.isTypeLiteralNode(path.type) ||
    !ts.isStringLiteral(path.name)
  ) {
    return undefined;
  }

  const newPathName = isComponent ? path.name.text : normalizePathNameWithParameters(path.name.text);
  const newIdentifier = isComponent ? path.name : ts.factory.createStringLiteral(newPathName);

  const newTypeMembers = path.type.members
    .map((pathMethod) => normalizeMethod(pathMethod, context, { pathName: newPathName }))
    .filter(isDefined);

  if (newTypeMembers.length === 0) {
    return undefined;
  }

  let newType: ts.TypeNode = ts.factory.updateTypeLiteralNode(path.type, ts.factory.createNodeArray(newTypeMembers));

  if (isComponent) {
    newType = wrapComponentPathType(newType, context);
  }

  const newPath = ts.factory.updatePropertySignature(path, path.modifiers, newIdentifier, path.questionToken, newType);
  return newPath;
}

export function normalizePaths(paths: ts.InterfaceDeclaration, context: TypeTransformContext) {
  const newIdentifier = createPathsIdentifier(context.serviceName);

  const newMembers = paths.members.map((path) => normalizePath(path, context)).filter(isDefined);
  const newType = ts.factory.createTypeLiteralNode(newMembers);

  context.typeImports.root.add('HttpSchema');

  const httpSchemaPathsWrapper = ts.factory.createQualifiedName(
    ts.factory.createIdentifier('HttpSchema'),
    ts.factory.createIdentifier('Paths'),
  );
  const wrappedNewType = ts.factory.createTypeReferenceNode(httpSchemaPathsWrapper, [newType]);

  return ts.factory.createTypeAliasDeclaration(paths.modifiers, newIdentifier, paths.typeParameters, wrappedNewType);
}
