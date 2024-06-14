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

function isNumberType(type: ts.TypeNode) {
  return type.kind === ts.SyntaxKind.NumberKeyword;
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

function renameComponentReferences(node: ts.TypeNode, context: NodeTransformationContext): ts.TypeNode {
  if (ts.isArrayTypeNode(node)) {
    const newElementType = renameComponentReferences(node.elementType, context);
    return ts.factory.updateArrayTypeNode(node, newElementType);
  }

  if (ts.isIndexedAccessTypeNode(node) && ts.isIndexedAccessTypeNode(node.objectType)) {
    const newObjectType = renameComponentReferences(node.objectType, context);
    return ts.factory.updateIndexedAccessTypeNode(node, newObjectType, node.indexType);
  }

  if (
    ts.isIndexedAccessTypeNode(node) &&
    ts.isTypeReferenceNode(node.objectType) &&
    ts.isIdentifier(node.objectType.typeName) &&
    node.objectType.typeName.text === 'components'
  ) {
    const newIdentifier = createComponentsIdentifier(context.serviceName);
    const newObjectType = ts.factory.updateTypeReferenceNode(
      node.objectType,
      newIdentifier,
      node.objectType.typeArguments,
    );

    return ts.factory.updateIndexedAccessTypeNode(node, newObjectType, node.indexType);
  }

  return node;
}

function normalizeBodyContentTypeMember(contentType: ts.TypeElement, context: NodeTransformationContext) {
  if (
    ts.isPropertySignature(contentType) &&
    ts.isStringLiteral(contentType.name) &&
    contentType.name.text === 'application/json'
  ) {
    const newIdentifier = ts.factory.createIdentifier('body');
    const newType = contentType.type ? renameComponentReferences(contentType.type, context) : undefined;

    return ts.factory.updatePropertySignature(
      contentType,
      contentType.modifiers,
      newIdentifier,
      contentType.questionToken,
      newType,
    );
  }

  return undefined;
}

function normalizeBodyContentTypeMembers(contentType: ts.TypeNode | undefined, context: NodeTransformationContext) {
  if (contentType && ts.isTypeLiteralNode(contentType)) {
    const newType = contentType.members
      .map((member) => normalizeBodyContentTypeMember(member, context))
      .find(isDefined);
    return newType;
  }
  return undefined;
}

function normalizeBodyHeaderType(headerType: ts.TypeNode | undefined) {
  if (headerType && ts.isTypeLiteralNode(headerType)) {
    const knownTypeMembers = headerType.members.filter(
      (member) => !ts.isIndexSignatureDeclaration(member) || !isUnknownType(member.type),
    );

    if (knownTypeMembers.length === 0) {
      return undefined;
    }

    return ts.factory.updateTypeLiteralNode(headerType, ts.factory.createNodeArray(knownTypeMembers));
  }

  return headerType;
}

function normalizeBodyMember(bodyMember: ts.TypeElement, context: NodeTransformationContext) {
  if (ts.isPropertySignature(bodyMember) && ts.isIdentifier(bodyMember.name)) {
    if (bodyMember.name.text === 'content') {
      const newMember = normalizeBodyContentTypeMembers(bodyMember.type, context);
      return newMember;
    }

    if (bodyMember.name.text === 'headers') {
      const newType = normalizeBodyHeaderType(bodyMember.type);

      if (!newType) {
        return undefined;
      }

      return ts.factory.updatePropertySignature(
        bodyMember,
        bodyMember.modifiers,
        bodyMember.name,
        bodyMember.questionToken,
        newType,
      );
    }
  }

  return bodyMember;
}

function normalizeMethodRequestBody(requestBody: ts.PropertySignature, context: NodeTransformationContext) {
  const newIdentifier = ts.factory.createIdentifier('request');

  if (requestBody.type && ts.isTypeLiteralNode(requestBody.type)) {
    const newMembers = requestBody.type.members.map((member) => normalizeBodyMember(member, context)).filter(isDefined);

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

function normalizeMethodResponsesMemberType(
  responseMemberType: ts.TypeNode | undefined,
  context: NodeTransformationContext,
) {
  if (responseMemberType && ts.isTypeLiteralNode(responseMemberType)) {
    const newMembers = responseMemberType.members
      .map((member) => normalizeBodyMember(member, context))
      .filter(isDefined);
    return ts.factory.updateTypeLiteralNode(responseMemberType, ts.factory.createNodeArray(newMembers));
  }

  return responseMemberType;
}

function normalizeMethodResponsesMember(responseMember: ts.TypeElement, context: NodeTransformationContext) {
  if (ts.isPropertySignature(responseMember)) {
    if (ts.isIdentifier(responseMember.name) && responseMember.name.text === 'default') {
      return undefined;
    }

    const newType = normalizeMethodResponsesMemberType(responseMember.type, context);

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

function normalizeMethodResponses(responses: ts.PropertySignature, context: NodeTransformationContext) {
  const newIdentifier = ts.factory.createIdentifier('response');

  if (responses.type && ts.isTypeLiteralNode(responses.type)) {
    const newMembers = responses.type.members
      .map((member) => normalizeMethodResponsesMember(member, context))
      .filter(isDefined);

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

function normalizeMethodMember(member: ts.TypeElement, context: NodeTransformationContext) {
  if (ts.isPropertySignature(member) && ts.isIdentifier(member.name)) {
    if (member.name.text === 'requestBody') {
      return normalizeMethodRequestBody(member, context);
    }
    if (member.name.text === 'responses') {
      return normalizeMethodResponses(member, context);
    }
    return member;
  }

  return member;
}

function normalizeNumericMembersToTemplateLiterals(recordType: ts.TypeNode) {
  if (ts.isTypeLiteralNode(recordType)) {
    const newMembers = recordType.members.map((member) => {
      if (ts.isPropertySignature(member) && member.type && isNumberType(member.type)) {
        const newType = ts.factory.createTemplateLiteralType(ts.factory.createTemplateHead(''), [
          ts.factory.createTemplateLiteralTypeSpan(
            ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('number'), undefined),
            ts.factory.createTemplateTail(''),
          ),
        ]);

        return ts.factory.updatePropertySignature(member, member.modifiers, member.name, member.questionToken, newType);
      }

      return member;
    });

    return ts.factory.updateTypeLiteralNode(recordType, ts.factory.createNodeArray(newMembers));
  }

  return recordType;
}

function normalizeMethodRequestParameterMember(member: ts.TypeElement, context: NodeTransformationContext) {
  if (ts.isPropertySignature(member) && ts.isIdentifier(member.name)) {
    if (member.name.text === 'query') {
      const newIdentifier = ts.factory.createIdentifier('searchParams');
      const newType = member.type
        ? normalizeNumericMembersToTemplateLiterals(renameComponentReferences(member.type, context))
        : undefined;

      return ts.factory.updatePropertySignature(member, member.modifiers, newIdentifier, undefined, newType);
    }

    if (member.name.text === 'header') {
      const newIdentifier = ts.factory.createIdentifier('headers');
      const newType = member.type
        ? normalizeNumericMembersToTemplateLiterals(renameComponentReferences(member.type, context))
        : undefined;

      return ts.factory.updatePropertySignature(member, member.modifiers, newIdentifier, undefined, newType);
    }

    if (member.name.text === 'path' || member.name.text === 'cookie') {
      return undefined;
    }

    return member;
  }

  return member;
}

function normalizeMethodParameter(
  parameter: ts.TypeElement,
  parameters: ts.TypeElement[],
  context: NodeTransformationContext,
) {
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
        .map((member) => normalizeMethodRequestParameterMember(member, context))
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

function normalizeMethodParameters(parameters: ts.TypeElement[], context: NodeTransformationContext) {
  const newMembers = parameters
    .map((parameter) => normalizeMethodParameter(parameter, parameters, context))
    .filter(isDefined);

  return newMembers;
}

function normalizeMethodTypeLiteral(methodType: ts.TypeLiteralNode, context: NodeTransformationContext) {
  const newMembers = normalizeMethodParameters(
    methodType.members.map((member) => normalizeMethodMember(member, context)).filter(isDefined),
    context,
  );
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
    newType = normalizeMethodTypeLiteral(method.type, context);
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
    const newTypeMembers = path.type.members
      .map((pathMethod) => normalizePathMethod(pathMethod, context))
      .filter(isDefined);
    const newType = ts.factory.updateTypeLiteralNode(path.type, ts.factory.createNodeArray(newTypeMembers));
    return ts.factory.updatePropertySignature(path, path.modifiers, path.name, path.questionToken, newType);
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

function normalizeOperation(operation: ts.TypeElement, context: NodeTransformationContext) {
  if (!ts.isPropertySignature(operation)) {
    return operation;
  }

  const isNever = !operation.type || isNeverType(operation.type);
  if (isNever) {
    return undefined;
  }

  const newType = ts.isTypeLiteralNode(operation.type)
    ? normalizeMethodTypeLiteral(operation.type, context)
    : operation.type;

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

  const newMembers = operations.members.map((member) => normalizeOperation(member, context)).filter(isDefined);

  return ts.factory.updateInterfaceDeclaration(
    operations,
    operations.modifiers,
    newIdentifier,
    operations.typeParameters,
    operations.heritageClauses,
    newMembers,
  );
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
    const newType = renameComponentReferences(component.type, context);

    return ts.factory.updatePropertySignature(
      component,
      component.modifiers,
      component.name,
      component.questionToken,
      newType,
    );
  }

  if (ts.isArrayTypeNode(component.type)) {
    const newType = renameComponentReferences(component.type.elementType, context);

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

  if (newMembers.length === 0) {
    return undefined;
  }

  return ts.factory.updateInterfaceDeclaration(
    components,
    components.modifiers,
    newIdentifier,
    components.typeParameters,
    components.heritageClauses,
    newMembers,
  );
}

function normalizeRootNode(node: ts.Node, context: NodeTransformationContext) {
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
    .map((node) => normalizeRootNode(node, { serviceName: toPascalCase(rawServiceName) }))
    .filter(isDefined);

  addImportDeclarations(transformedNodes);

  const content = convertTypeASTToString(transformedNodes, { formatOptions: { removeComments } });
  await filesystem.promises.writeFile(path.resolve(outputFilePath), content);
}

export default generateServiceSchemaFromOpenAPI;
