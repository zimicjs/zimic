import ts from 'typescript';

import { Override } from '@/types/utils';
import { isDefined } from '@/utils/data';

import { TypeTransformContext } from './context';
import { normalizeMethod } from './methods';

export function createPathsIdentifier(serviceName: string) {
  return ts.factory.createIdentifier(`${serviceName}Schema`);
}

type PathsDeclaration = ts.InterfaceDeclaration;

export function isPathsDeclaration(node: ts.Node | undefined): node is PathsDeclaration {
  return node !== undefined && ts.isInterfaceDeclaration(node) && node.name.text === 'paths';
}

type Path = Override<
  ts.PropertySignature,
  {
    type: ts.TypeLiteralNode;
    name: ts.StringLiteral;
  }
>;

function isPath(node: ts.TypeElement): node is Path {
  return (
    ts.isPropertySignature(node) &&
    node.type !== undefined &&
    ts.isTypeLiteralNode(node.type) &&
    (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
  );
}

function normalizePathNameWithParameters(pathName: string) {
  return pathName.replace(/{([^}]+)}/g, ':$1');
}

function wrapComponentPathTypeInHttpSchema(type: ts.TypeNode, context: TypeTransformContext) {
  context.typeImports.root.add('HttpSchema');

  const httpSchemaMethodsWrapper = ts.factory.createQualifiedName(
    ts.factory.createIdentifier('HttpSchema'),
    ts.factory.createIdentifier('Methods'),
  );
  return ts.factory.createTypeReferenceNode(httpSchemaMethodsWrapper, [type]);
}

export function normalizePath(
  path: ts.TypeElement,
  context: TypeTransformContext,
  options: { isComponent?: boolean } = {},
) {
  const { isComponent = false } = options;

  if (!isPath(path)) {
    return undefined;
  }

  const newPathName = isComponent ? path.name.text : normalizePathNameWithParameters(path.name.text);
  const newMethods = path.type.members
    .map((method) => normalizeMethod(method, context, { pathName: newPathName }))
    .filter(isDefined);

  if (newMethods.length === 0) {
    return undefined;
  }

  const newIdentifier = isComponent ? path.name : ts.factory.createStringLiteral(newPathName);
  const newType = ts.factory.updateTypeLiteralNode(path.type, ts.factory.createNodeArray(newMethods));

  return ts.factory.updatePropertySignature(
    path,
    path.modifiers,
    newIdentifier,
    path.questionToken,
    isComponent ? wrapComponentPathTypeInHttpSchema(newType, context) : newType,
  );
}

function wrapPathsTypeInHttpSchema(type: ts.TypeLiteralNode, context: TypeTransformContext) {
  context.typeImports.root.add('HttpSchema');

  const httpSchemaPathsWrapper = ts.factory.createQualifiedName(
    ts.factory.createIdentifier('HttpSchema'),
    ts.factory.createIdentifier('Paths'),
  );
  return ts.factory.createTypeReferenceNode(httpSchemaPathsWrapper, [type]);
}

export function normalizePaths(paths: ts.InterfaceDeclaration, context: TypeTransformContext) {
  const newIdentifier = createPathsIdentifier(context.serviceName);
  const newMembers = paths.members.map((path) => normalizePath(path, context)).filter(isDefined);
  const newType = ts.factory.createTypeLiteralNode(newMembers);

  return ts.factory.createTypeAliasDeclaration(
    paths.modifiers,
    newIdentifier,
    paths.typeParameters,
    wrapPathsTypeInHttpSchema(newType, context),
  );
}
