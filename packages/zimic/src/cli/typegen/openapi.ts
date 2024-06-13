import filesystem from 'fs';
import generateTypesFromOpenAPI, { astToString as convertTypeASTToString } from 'openapi-typescript';
import path from 'path';
import ts from 'typescript';

import { HTTP_METHODS, HttpMethod } from '@/http/types/schema';
import { isDefined } from '@/utils/data';
import { toPascalCase } from '@/utils/strings';
import { createFileURL } from '@/utils/urls';

const SUPPORTED_HTTP_METHODS = new Set<string>(HTTP_METHODS);

export const TYPEGEN_IMPORT_FROM = process.env.TYPEGEN_IMPORT_FROM!; // eslint-disable-line @typescript-eslint/no-non-null-assertion

interface NodeTransformationContext {
  serviceName: string;
}

function isNeverType(type: ts.TypeNode) {
  return type.kind === ts.SyntaxKind.NeverKeyword;
}

function isNeverTypeMember(member: ts.TypeElement) {
  return ts.isPropertySignature(member) && member.type !== undefined && isNeverType(member.type);
}

function isUnknownType(type: ts.TypeNode) {
  return type.kind === ts.SyntaxKind.UnknownKeyword;
}

function createOperationsIdentifier(serviceName: string) {
  return ts.factory.createIdentifier(`${serviceName}Operations`);
}

function createPathsIdentifier(serviceName: string) {
  return ts.factory.createIdentifier(`${serviceName}Schema`);
}

function createComponentsIdentifier(serviceName: string) {
  return ts.factory.createIdentifier(`${serviceName}Components`);
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
    const newType = requestBodyMemberType.members.map(normalizeBodyContentType).find(isDefined);
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
    const newMembers = requestBody.type.members.map(normalizeBodyMember).filter(isDefined);

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
    const newMembers = responseMemberType.members.map(normalizeBodyMember).filter(isDefined);
    return ts.factory.updateTypeLiteralNode(responseMemberType, ts.factory.createNodeArray(newMembers));
  }

  return responseMemberType;
}

function normalizeMethodResponsesMember(responseMember: ts.TypeElement) {
  if (ts.isPropertySignature(responseMember)) {
    if (ts.isIdentifier(responseMember.name) && responseMember.name.text === 'default') {
      return undefined;
    }

    const newType = normalizeMethodResponsesMemberType(responseMember.type);

    return ts.factory.updatePropertySignature(
      responseMember,
      responseMember.modifiers,
      responseMember.name,
      responseMember.questionToken,
      newType,
    );
  }

  return responseMember;
}

function normalizeMethodResponses(responses: ts.PropertySignature) {
  const newIdentifier = ts.factory.createIdentifier('response');

  if (responses.type && ts.isTypeLiteralNode(responses.type)) {
    const newMembers = responses.type.members.map(normalizeMethodResponsesMember).filter(isDefined);

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
    return member;
  }

  return member;
}

function normalizeMethodRequestParameterMember(member: ts.TypeElement) {
  if (ts.isPropertySignature(member) && ts.isIdentifier(member.name)) {
    if (member.name.text === 'query') {
      return ts.factory.updatePropertySignature(
        member,
        member.modifiers,
        ts.factory.createIdentifier('searchParams'),
        member.questionToken,
        member.type,
      );
    }
    if (member.name.text === 'header') {
      return ts.factory.updatePropertySignature(
        member,
        member.modifiers,
        ts.factory.createIdentifier('headers'),
        member.questionToken,
        member.type,
      );
    }
    if (member.name.text === 'path' || member.name.text === 'cookie') {
      return undefined;
    }
    return member;
  }

  return member;
}

function normalizeMethodParameter(parameter: ts.TypeElement, parameters: ts.TypeElement[]) {
  if (ts.isPropertySignature(parameter) && ts.isIdentifier(parameter.name)) {
    if (parameter.name.text === 'parameters') {
      return undefined;
    }

    if (parameter.name.text === 'request' && parameter.type) {
      const requestParameterTypeMembers = ts.isTypeLiteralNode(parameter.type) ? parameter.type.members : [];

      const parametersMember = parameters.find(
        (member): member is ts.PropertySignature =>
          ts.isPropertySignature(member) && ts.isIdentifier(member.name) && member.name.text === 'parameters',
      );
      const parametersParameterTypeMembers =
        parametersMember?.type && ts.isTypeLiteralNode(parametersMember.type) ? parametersMember.type.members : [];

      const newTypeMembers = [...requestParameterTypeMembers, ...parametersParameterTypeMembers]
        .map(normalizeMethodRequestParameterMember)
        .filter((member): member is ts.TypeElement => isDefined(member) && !isNeverTypeMember(member));

      const newType = ts.factory.createTypeLiteralNode(newTypeMembers);

      return ts.factory.updatePropertySignature(
        parameter,
        parameter.modifiers,
        parameter.name,
        parameter.questionToken,
        newType,
      );
    }
  }

  return parameter;
}

function normalizeMethodParameters(parameters: ts.TypeElement[]) {
  const newMembers = parameters.map((parameter) => normalizeMethodParameter(parameter, parameters)).filter(isDefined);

  return newMembers;
}

function normalizeMethodTypeLiteral(methodType: ts.TypeLiteralNode) {
  const newMembers = normalizeMethodParameters(methodType.members.map(normalizeMethodMember).filter(isDefined));

  return ts.factory.updateTypeLiteralNode(methodType, ts.factory.createNodeArray(newMembers));
}

function normalizeMethodTypeIndexedAccess(methodType: ts.IndexedAccessTypeNode, context: NodeTransformationContext) {
  let newObjectType = methodType.objectType;

  if (
    ts.isTypeReferenceNode(methodType.objectType) &&
    ts.isIdentifier(methodType.objectType.typeName) &&
    methodType.objectType.typeName.text === 'operations'
  ) {
    newObjectType = ts.factory.createTypeReferenceNode(
      createOperationsIdentifier(context.serviceName),
      methodType.objectType.typeArguments,
    );
  }

  return ts.factory.updateIndexedAccessTypeNode(methodType, newObjectType, methodType.indexType);
}

function normalizeMethod(method: ts.PropertySignature, methodName: HttpMethod, context: NodeTransformationContext) {
  const isNever = !method.type || isNeverType(method.type);
  if (isNever) {
    return undefined;
  }

  const newIdentifier = ts.factory.createIdentifier(methodName);

  let newType: ts.TypeNode | undefined = method.type;
  if (ts.isTypeLiteralNode(method.type)) {
    newType = normalizeMethodTypeLiteral(method.type);
  } else if (ts.isIndexedAccessTypeNode(method.type)) {
    newType = normalizeMethodTypeIndexedAccess(method.type, context);
  }

  return ts.factory.updatePropertySignature(method, method.modifiers, newIdentifier, method.questionToken, newType);
}

function normalizePathMethod(pathMethod: ts.TypeElement, context: NodeTransformationContext) {
  if (ts.isPropertySignature(pathMethod) && ts.isIdentifier(pathMethod.name)) {
    const methodName = pathMethod.name.text.toUpperCase<HttpMethod>();
    if (!SUPPORTED_HTTP_METHODS.has(methodName)) {
      return undefined;
    }
    return normalizeMethod(pathMethod, methodName, context);
  }

  return pathMethod;
}

function normalizePath(path: ts.TypeElement, context: NodeTransformationContext) {
  if (ts.isPropertySignature(path) && path.type && ts.isTypeLiteralNode(path.type)) {
    const newPathMembers = path.type.members
      .map((pathMethod) => normalizePathMethod(pathMethod, context))
      .filter(isDefined);

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
  const newIdentifier = createPathsIdentifier(context.serviceName);
  const newPaths = paths.members.map((path) => normalizePath(path, context));
  const newPathsType = ts.factory.createTypeLiteralNode(ts.factory.createNodeArray(newPaths));

  return ts.factory.createTypeAliasDeclaration(
    paths.modifiers,
    newIdentifier,
    paths.typeParameters,
    ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('HttpSchema.Paths'), [newPathsType]),
  );
}

function normalizeOperation(operation: ts.TypeElement) {
  if (!ts.isPropertySignature(operation)) {
    return operation;
  }

  const isNever = !operation.type || isNeverType(operation.type);
  if (isNever) {
    return undefined;
  }

  const newType = ts.isTypeLiteralNode(operation.type) ? normalizeMethodTypeLiteral(operation.type) : operation.type;

  return ts.factory.updatePropertySignature(
    operation,
    operation.modifiers,
    operation.name,
    operation.questionToken,
    newType,
  );
}

function normalizeOperations(operations: ts.InterfaceDeclaration, context: NodeTransformationContext) {
  const newIdentifier = createOperationsIdentifier(context.serviceName);

  const newMembers = operations.members.map(normalizeOperation).filter(isDefined);

  return ts.factory.updateInterfaceDeclaration(
    operations,
    operations.modifiers,
    newIdentifier,
    operations.typeParameters,
    operations.heritageClauses,
    newMembers,
  );
}

function normalizeComponentType(componentType: ts.TypeNode, context: NodeTransformationContext): ts.TypeNode {
  if (ts.isArrayTypeNode(componentType)) {
    const newElementType = normalizeComponentType(componentType.elementType, context);
    return ts.factory.updateArrayTypeNode(componentType, newElementType);
  }

  if (ts.isIndexedAccessTypeNode(componentType) && ts.isIndexedAccessTypeNode(componentType.objectType)) {
    const newObjectType = normalizeComponentType(componentType.objectType, context);
    return ts.factory.updateIndexedAccessTypeNode(componentType, newObjectType, componentType.indexType);
  }

  if (
    ts.isIndexedAccessTypeNode(componentType) &&
    ts.isTypeReferenceNode(componentType.objectType) &&
    ts.isIdentifier(componentType.objectType.typeName) &&
    componentType.objectType.typeName.text === 'components'
  ) {
    const newIdentifier = createComponentsIdentifier(context.serviceName);
    const newObjectType = ts.factory.updateTypeReferenceNode(
      componentType.objectType,
      newIdentifier,
      componentType.objectType.typeArguments,
    );

    return ts.factory.updateIndexedAccessTypeNode(componentType, newObjectType, componentType.indexType);
  }

  return componentType;
}

function normalizeComponent(component: ts.TypeElement, context: NodeTransformationContext): ts.TypeElement | undefined {
  if (!ts.isPropertySignature(component)) {
    return component;
  }

  const isNever = !component.type || isNeverType(component.type);
  if (isNever) {
    return undefined;
  }

  if (ts.isTypeLiteralNode(component.type)) {
    const newMembers = component.type.members
      .map((component) => normalizeComponent(component, context))
      .filter(isDefined);

    return ts.factory.updatePropertySignature(
      component,
      component.modifiers,
      component.name,
      component.questionToken,
      ts.factory.updateTypeLiteralNode(component.type, ts.factory.createNodeArray(newMembers)),
    );
  }

  if (ts.isIndexedAccessTypeNode(component.type)) {
    const newType = normalizeComponentType(component.type, context);

    return ts.factory.updatePropertySignature(
      component,
      component.modifiers,
      component.name,
      component.questionToken,
      newType,
    );
  }

  if (ts.isArrayTypeNode(component.type)) {
    const newType = normalizeComponentType(component.type.elementType, context);

    return ts.factory.updatePropertySignature(
      component,
      component.modifiers,
      component.name,
      component.questionToken,
      ts.factory.updateArrayTypeNode(component.type, newType),
    );
  }

  return component;
}

function normalizeComponentMemberType(componentType: ts.TypeNode, context: NodeTransformationContext) {
  if (ts.isTypeLiteralNode(componentType)) {
    const newMembers = componentType.members
      .map((component) => normalizeComponent(component, context))
      .filter(isDefined);

    return ts.factory.updateTypeLiteralNode(componentType, ts.factory.createNodeArray(newMembers));
  }

  return componentType;
}

function normalizeComponents(components: ts.InterfaceDeclaration, context: NodeTransformationContext) {
  const newIdentifier = createComponentsIdentifier(context.serviceName);

  const newMembers = components.members
    .map((component) => {
      if (!ts.isPropertySignature(component)) {
        return component;
      }

      const isNever = !component.type || isNeverType(component.type);
      if (isNever) {
        return undefined;
      }

      const newType = normalizeComponentMemberType(component.type, context);

      return ts.factory.updatePropertySignature(
        component,
        component.modifiers,
        component.name,
        component.questionToken,
        newType,
      );
    })
    .filter(isDefined);

  return ts.factory.updateInterfaceDeclaration(
    components,
    components.modifiers,
    newIdentifier,
    components.typeParameters,
    components.heritageClauses,
    newMembers,
  );
}

function transformRootNode(node: ts.Node, context: NodeTransformationContext) {
  if (ts.isInterfaceDeclaration(node) && node.name.text === 'paths') {
    return normalizePaths(node, context);
  }
  if (ts.isInterfaceDeclaration(node) && node.name.text === 'operations') {
    return normalizeOperations(node, context);
  }
  if (ts.isInterfaceDeclaration(node) && node.name.text === 'components') {
    return normalizeComponents(node, context);
  }
  if (ts.isTypeAliasDeclaration(node) && ['webhooks', 'operations', 'components', '$defs'].includes(node.name.text)) {
    return undefined;
  }
  return node;
}

function addImportDeclarations(nodes: ts.Node[]) {
  const rootImportDeclaration = ts.factory.createImportDeclaration(
    undefined,
    ts.factory.createImportClause(
      true,
      undefined,
      ts.factory.createNamedImports([
        ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier('HttpSchema')),
      ]),
    ),
    ts.factory.createStringLiteral(TYPEGEN_IMPORT_FROM),
  );

  nodes.unshift(rootImportDeclaration);
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
  const fileURL = createFileURL(path.resolve(inputFilePath));

  const nodes = await generateTypesFromOpenAPI(fileURL, {
    alphabetize: false,
    excludeDeprecated: false,
    propertiesRequiredByDefault: true,
    pathParamsAsTypes: false,
    emptyObjectsUnknown: false,
    exportType: false,
    enum: false,
    silent: true,
  });

  const transformedNodes = nodes
    .map((node) => transformRootNode(node, { serviceName: toPascalCase(rawServiceName) }))
    .filter(isDefined);

  addImportDeclarations(transformedNodes);

  const content = convertTypeASTToString(transformedNodes, { formatOptions: { removeComments } });
  await filesystem.promises.writeFile(path.resolve(outputFilePath), content);
}

export default generateServiceSchemaFromOpenAPI;
