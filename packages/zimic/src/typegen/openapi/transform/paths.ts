import ts from 'typescript';

import { Override } from '@/types/utils';
import { isDefined } from '@/utils/data';

import { renameComponentReferences } from './components';
import { TypeTransformContext } from './context';
import { normalizeMethod } from './methods';

export function createPathsIdentifier(serviceName: string) {
  return ts.factory.createIdentifier(`${serviceName}Schema`);
}

type PathsDeclaration = ts.InterfaceDeclaration | ts.TypeAliasDeclaration;

export function isPathsDeclaration(node: ts.Node | undefined): node is PathsDeclaration {
  return (
    node !== undefined &&
    (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) &&
    node.name.text === 'paths'
  );
}

type Path = Override<
  ts.PropertySignature,
  {
    type: ts.TypeLiteralNode | ts.IndexedAccessTypeNode;
    name: ts.Identifier | ts.StringLiteral;
  }
>;

function isPath(node: ts.TypeElement): node is Path {
  return (
    ts.isPropertySignature(node) &&
    (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
    node.type !== undefined &&
    (ts.isTypeLiteralNode(node.type) || ts.isIndexedAccessTypeNode(node.type))
  );
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
  return ts.factory.createTypeReferenceNode(httpSchemaMethodsWrapper, [type]);
}

export function normalizePath(
  path: ts.TypeElement,
  context: TypeTransformContext,
  options: { isComponent?: boolean } = {},
) {
  const { isComponent = false } = options;

  /* istanbul ignore if -- @preserve
   * Path members are always expected to be a path. */
  if (!isPath(path)) {
    return undefined;
  }

  const newPathName = isComponent ? path.name.text : normalizePathNameWithParameters(path.name.text);
  const newIdentifier = isComponent ? path.name : ts.factory.createStringLiteral(newPathName);

  let newType: ts.TypeNode;

  if (ts.isTypeLiteralNode(path.type)) {
    const newMethods = path.type.members
      .map((method) => normalizeMethod(method, context, { pathName: newPathName }))
      .filter(isDefined);

    if (newMethods.length === 0) {
      return undefined;
    }

    newType = ts.factory.updateTypeLiteralNode(path.type, ts.factory.createNodeArray(newMethods));
  } else {
    newType = renameComponentReferences(path.type, context);
  }

  return ts.factory.updatePropertySignature(
    path,
    path.modifiers,
    newIdentifier,
    path.questionToken,
    isComponent ? wrapComponentPathType(newType, context) : newType,
  );
}

function wrapPathsType(type: ts.TypeLiteralNode, context: TypeTransformContext) {
  context.typeImports.root.add('HttpSchema');

  const httpSchemaPathsWrapper = ts.factory.createQualifiedName(
    ts.factory.createIdentifier('HttpSchema'),
    ts.factory.createIdentifier('Paths'),
  );
  return ts.factory.createTypeReferenceNode(httpSchemaPathsWrapper, [type]);
}

export function normalizePaths(pathsOrTypeAlias: PathsDeclaration, context: TypeTransformContext) {
  const newIdentifier = createPathsIdentifier(context.serviceName);

  const paths = ts.isTypeAliasDeclaration(pathsOrTypeAlias)
    ? ts.factory.createInterfaceDeclaration(pathsOrTypeAlias.modifiers, pathsOrTypeAlias.name, undefined, undefined, [])
    : pathsOrTypeAlias;

  const newMembers = paths.members.map((path) => normalizePath(path, context)).filter(isDefined);
  const newType = ts.factory.createTypeLiteralNode(newMembers);

  return ts.factory.createTypeAliasDeclaration(
    paths.modifiers,
    newIdentifier,
    paths.typeParameters,
    wrapPathsType(newType, context),
  );
}
