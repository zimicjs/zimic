import filesystem from 'fs';
import generateTypesFromOpenAPI, { astToString as convertTypeASTToString } from 'openapi-typescript';
import path from 'path';
import ts from 'typescript';

import { HTTP_METHODS, HttpMethod } from '@/http/types/schema';
import { toPascalCase } from '@/utils/strings';
import { createURL } from '@/utils/urls';

const SUPPORTED_HTTP_METHODS = new Set<string>(HTTP_METHODS);

function createFileURL(filePathOrURL: string) {
  const isRemoteFile = /^[^:]+:\/\//.test(filePathOrURL);
  const fileURL = isRemoteFile ? createURL(filePathOrURL) : new URL(`file://${path.resolve(filePathOrURL)}`);
  return fileURL;
}

interface NodeTransformationContext {
  serviceName: string;
}

function isNeverType(type: ts.TypeNode) {
  return type.kind === ts.SyntaxKind.NeverKeyword;
}

function isUnknownType(type: ts.TypeNode) {
  return type.kind === ts.SyntaxKind.UnknownKeyword;
}

function noUndefined<Value>(value: Value): value is Exclude<Value, undefined> {
  return value !== undefined;
}

function normalizeBodyContentType(contentType: ts.TypeElement) {
  if (
    ts.isPropertySignature(contentType) &&
    ts.isStringLiteral(contentType.name) &&
    contentType.name.text === 'application/json'
  ) {
    const newIdentifier = ts.factory.createIdentifier('body');

    return ts.factory.updatePropertySignature(
      contentType,
      contentType.modifiers,
      newIdentifier,
      contentType.questionToken,
      contentType.type,
    );
  }

  return undefined;
}

function normalizeBodyMemberType(requestBodyMemberType: ts.TypeNode | undefined) {
  if (requestBodyMemberType && ts.isTypeLiteralNode(requestBodyMemberType)) {
    const newType = requestBodyMemberType.members.map(normalizeBodyContentType).find(noUndefined);
    return newType;
  }
  return undefined;
}

function normalizeBodyMember(requestBodyMember: ts.TypeElement) {
  if (ts.isPropertySignature(requestBodyMember) && ts.isIdentifier(requestBodyMember.name)) {
    if (requestBodyMember.name.text === 'content') {
      return normalizeBodyMemberType(requestBodyMember.type);
    }

    if (requestBodyMember.name.text === 'headers') {
      const allTypesAreUnknown =
        requestBodyMember.type !== undefined &&
        ts.isTypeLiteralNode(requestBodyMember.type) &&
        requestBodyMember.type.members.every(
          (member) => ts.isIndexSignatureDeclaration(member) && isUnknownType(member.type),
        );

      if (allTypesAreUnknown) {
        return undefined;
      }
    }
  }

  return requestBodyMember;
}

function normalizeMethodRequestBody(requestBody: ts.PropertySignature) {
  const newIdentifier = ts.factory.createIdentifier('request');

  if (requestBody.type && ts.isTypeLiteralNode(requestBody.type)) {
    const newMembers = requestBody.type.members.map(normalizeBodyMember).filter(noUndefined);

    return ts.factory.updatePropertySignature(
      requestBody,
      requestBody.modifiers,
      newIdentifier,
      undefined,
      ts.factory.updateTypeLiteralNode(requestBody.type, ts.factory.createNodeArray(newMembers)),
    );
  }

  return ts.factory.updatePropertySignature(
    requestBody,
    requestBody.modifiers,
    newIdentifier,
    undefined,
    requestBody.type,
  );
}

function normalizeMethodResponsesMemberType(responseMemberType: ts.TypeNode | undefined) {
  if (responseMemberType && ts.isTypeLiteralNode(responseMemberType)) {
    const newMembers = responseMemberType.members.map(normalizeBodyMember).filter(noUndefined);
    return ts.factory.updateTypeLiteralNode(responseMemberType, ts.factory.createNodeArray(newMembers));
  }

  return responseMemberType;
}

function normalizeMethodResponsesMember(responseMember: ts.TypeElement) {
  if (
    ts.isPropertySignature(responseMember) &&
    ts.isIdentifier(responseMember.name) &&
    responseMember.name.text === 'default'
  ) {
    const newIdentifier = ts.factory.createIdentifier('200');
    const newType = normalizeMethodResponsesMemberType(responseMember.type);

    return ts.factory.updatePropertySignature(
      responseMember,
      responseMember.modifiers,
      newIdentifier,
      responseMember.questionToken,
      newType,
    );
  }

  return responseMember;
}

function normalizeMethodResponses(responses: ts.PropertySignature) {
  const newIdentifier = ts.factory.createIdentifier('response');

  if (responses.type && ts.isTypeLiteralNode(responses.type)) {
    const newMembers = responses.type.members.map(normalizeMethodResponsesMember).filter(noUndefined);

    return ts.factory.updatePropertySignature(
      responses,
      responses.modifiers,
      newIdentifier,
      undefined,
      ts.factory.updateTypeLiteralNode(responses.type, ts.factory.createNodeArray(newMembers)),
    );
  }

  return ts.factory.updatePropertySignature(responses, responses.modifiers, newIdentifier, undefined, responses.type);
}

function normalizeMethodMember(member: ts.TypeElement) {
  if (ts.isPropertySignature(member) && ts.isIdentifier(member.name)) {
    if (member.name.text === 'requestBody') {
      return normalizeMethodRequestBody(member);
    }
    if (member.name.text === 'responses') {
      return normalizeMethodResponses(member);
    }
    return undefined;
  }

  return member;
}

function normalizeMethodType(methodType: ts.TypeLiteralNode) {
  const newMembers = methodType.members.map(normalizeMethodMember).filter(noUndefined);
  return ts.factory.updateTypeLiteralNode(methodType, ts.factory.createNodeArray(newMembers));
}

function normalizeMethod(method: ts.PropertySignature, methodName: HttpMethod) {
  const isNever = method.type !== undefined && isNeverType(method.type);
  if (isNever) {
    return undefined;
  }

  const newIdentifier = ts.factory.createIdentifier(methodName);
  const newPathMemberType =
    method.type && ts.isTypeLiteralNode(method.type) ? normalizeMethodType(method.type) : method.type;

  return ts.factory.updatePropertySignature(
    method,
    method.modifiers,
    newIdentifier,
    method.questionToken,
    newPathMemberType,
  );
}

function normalizePathMethod(pathMethod: ts.TypeElement) {
  if (ts.isPropertySignature(pathMethod) && ts.isIdentifier(pathMethod.name)) {
    const methodName = pathMethod.name.text.toUpperCase<HttpMethod>();
    if (!SUPPORTED_HTTP_METHODS.has(methodName)) {
      return undefined;
    }
    return normalizeMethod(pathMethod, methodName);
  }

  return pathMethod;
}

function normalizePath(path: ts.TypeElement) {
  if (ts.isPropertySignature(path) && path.type && ts.isTypeLiteralNode(path.type)) {
    const newPathMembers = path.type.members.map(normalizePathMethod).filter(noUndefined);

    return ts.factory.updatePropertySignature(
      path,
      path.modifiers,
      path.name,
      path.questionToken,
      ts.factory.updateTypeLiteralNode(path.type, ts.factory.createNodeArray(newPathMembers)),
    );
  }

  return path;
}

function normalizePaths(paths: ts.InterfaceDeclaration, context: NodeTransformationContext) {
  const newIdentifier = ts.factory.createIdentifier(`${context.serviceName}Schema`);
  const newPaths = paths.members.map(normalizePath);
  const newPathsType = ts.factory.createTypeLiteralNode(ts.factory.createNodeArray(newPaths));

  return ts.factory.createTypeAliasDeclaration(
    paths.modifiers,
    newIdentifier,
    paths.typeParameters,
    ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('HttpSchema.Paths'), [newPathsType]),
  );
}

function transformRootNode(node: ts.Node, context: NodeTransformationContext) {
  if (ts.isInterfaceDeclaration(node) && node.name.text === 'paths') {
    return normalizePaths(node, context);
  }
  if (ts.isInterfaceDeclaration(node) && node.name.text === 'components') {
    return undefined;
  }
  if (ts.isTypeAliasDeclaration(node) && ['webhooks', 'operations', '$defs'].includes(node.name.text)) {
    return undefined;
  }
  return node;
}

function addImportDeclaration(nodes: ts.Node[]) {
  const httpSchemaImportDeclaration = ts.factory.createImportDeclaration(
    undefined,
    ts.factory.createImportClause(
      true,
      undefined,
      ts.factory.createNamedImports([
        ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier('HttpSchema')),
      ]),
    ),
    ts.factory.createStringLiteral('zimic'),
  );

  nodes.unshift(httpSchemaImportDeclaration);
}

interface OpenAPITypeGenerationOptions {
  inputFilePath: string;
  outputFilePath: string;
  serviceName: string;
  removeComments: boolean;
}

async function generateServiceSchemaFromOpenAPI({
  inputFilePath,
  outputFilePath,
  serviceName: rawServiceName,
  removeComments,
}: OpenAPITypeGenerationOptions) {
  const serviceName = toPascalCase(rawServiceName);

  const fileURL = createFileURL(inputFilePath);

  const nodes = await generateTypesFromOpenAPI(fileURL, {
    alphabetize: false,
    excludeDeprecated: false,
    propertiesRequiredByDefault: true,
    pathParamsAsTypes: false,
    exportType: false,
    enum: false,
    silent: true,
  });

  const transformedNodes = nodes.map((node) => transformRootNode(node, { serviceName })).filter(noUndefined);
  addImportDeclaration(transformedNodes);

  const content = convertTypeASTToString(transformedNodes, { formatOptions: { removeComments } });
  await filesystem.promises.writeFile(path.resolve(outputFilePath), content);
}

export default generateServiceSchemaFromOpenAPI;
