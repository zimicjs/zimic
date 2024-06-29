import ts from 'typescript';

import { HttpMethod } from '@/http/types/schema';
import { isDefined } from '@/utils/data';

import { NodeTransformationContext, SUPPORTED_HTTP_METHODS } from '../openapi';
import { renameComponentReferences } from './components';
import { createOperationsIdentifier } from './operations';
import { isUnknownType, isNeverTypeMember, isNeverType, isNullType } from './types';

function normalizeRequestBodyMember(requestBodyMember: ts.TypeElement, context: NodeTransformationContext) {
  if (ts.isPropertySignature(requestBodyMember) && ts.isStringLiteral(requestBodyMember.name)) {
    if (!requestBodyMember.type) {
      return undefined;
    }

    const newIdentifier = ts.factory.createIdentifier('body');
    let newType = renameComponentReferences(requestBodyMember.type, context);

    const containsRedundantNullUnion =
      ts.isUnionTypeNode(newType) &&
      newType.types.some((type) => ts.isLiteralTypeNode(type) && isNullType(type.literal)) &&
      newType.types.some(
        (type) =>
          ts.isParenthesizedTypeNode(type) &&
          ts.isUnionTypeNode(type.type) &&
          type.type.types.some((subType) => ts.isLiteralTypeNode(subType) && isNullType(subType.literal)),
      );

    if (ts.isUnionTypeNode(newType) && containsRedundantNullUnion) {
      const typesWithoutRedundantNullUnion = newType.types
        .filter((type) => !(ts.isLiteralTypeNode(type) && isNullType(type.literal)))
        .flatMap((type) => {
          if (ts.isParenthesizedTypeNode(type) && ts.isUnionTypeNode(type.type)) {
            return type.type.types;
          }
          return [type];
        });

      newType = ts.factory.createUnionTypeNode(typesWithoutRedundantNullUnion);
    }

    const contentTypeName = requestBodyMember.name.text;

    if (contentTypeName === 'multipart/form-data') {
      context.typeImports.root.add('HttpFormData');
      newType = ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('HttpFormData'), [newType]);
    }

    if (contentTypeName === 'x-www-form-urlencoded') {
      context.typeImports.root.add('HttpSearchParams');
      context.typeImports.root.add('HttpSearchParamsSerialized');

      newType = ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('HttpSearchParams'), [
        ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('HttpSearchParamsSerialized'), [
          renameComponentReferences(newType, context),
        ]),
      ]);
    }

    return {
      propertySignature: ts.factory.updatePropertySignature(
        requestBodyMember,
        requestBodyMember.modifiers,
        newIdentifier,
        requestBodyMember.questionToken,
        newType,
      ),
      contentTypeName,
    };
  }

  return undefined;
}

export function normalizeRequestBody(requestBody: ts.TypeNode | undefined, context: NodeTransformationContext) {
  if (requestBody && ts.isTypeLiteralNode(requestBody)) {
    const newMembers = requestBody.members
      .map((member) => normalizeRequestBodyMember(member, context))
      .filter(isDefined);

    return newMembers;
  }

  return undefined;
}

function normalizeHeader(headerType: ts.TypeNode | undefined, context: NodeTransformationContext) {
  if (!headerType || isNeverType(headerType)) {
    return undefined;
  }

  if (ts.isTypeLiteralNode(headerType)) {
    const newMembers = headerType.members.filter(
      (member) => !ts.isIndexSignatureDeclaration(member) || !isUnknownType(member.type),
    );

    if (newMembers.length === 0) {
      return undefined;
    }

    context.typeImports.root.add('HttpHeadersSerialized');

    return ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('HttpHeadersSerialized'), [
      ts.factory.updateTypeLiteralNode(headerType, ts.factory.createNodeArray(newMembers)),
    ]);
  }

  return headerType;
}

function normalizeRequestMemberHeader(requestMember: ts.TypeElement, context: NodeTransformationContext) {
  if (ts.isPropertySignature(requestMember) && ts.isIdentifier(requestMember.name)) {
    if (requestMember.name.text === 'headers') {
      const newType = normalizeHeader(requestMember.type, context);

      if (!newType) {
        return undefined;
      }

      return ts.factory.updatePropertySignature(
        requestMember,
        requestMember.modifiers,
        requestMember.name,
        requestMember.questionToken,
        newType,
      );
    }
  }

  return undefined;
}

function normalizeRequestMemberBody(requestMember: ts.TypeElement, context: NodeTransformationContext) {
  if (ts.isPropertySignature(requestMember) && ts.isIdentifier(requestMember.name)) {
    if (requestMember.name.text === 'content') {
      return normalizeRequestBody(requestMember.type, context);
    }
  }

  return undefined;
}

export function normalizeMethodContentType(
  contentType: ts.TypeNode,
  context: NodeTransformationContext,
  options: { bodyQuestionToken: ts.QuestionToken | undefined },
) {
  const { bodyQuestionToken } = options;

  if (ts.isTypeLiteralNode(contentType)) {
    const newHeaderMember = contentType.members
      .map((member) => normalizeRequestMemberHeader(member, context))
      .find(isDefined);

    const newBodyMembers = contentType.members
      .flatMap((member) => normalizeRequestMemberBody(member, context))
      .filter(isDefined);

    const newBodyMemberPropertySignatures = newBodyMembers.map((member) =>
      ts.factory.updatePropertySignature(
        member.propertySignature,
        member.propertySignature.modifiers,
        member.propertySignature.name,
        bodyQuestionToken,
        member.propertySignature.type,
      ),
    );

    if (newBodyMembers.length <= 1) {
      const newMembers = [newHeaderMember, ...newBodyMemberPropertySignatures];
      return ts.factory.updateTypeLiteralNode(contentType, ts.factory.createNodeArray(newMembers.filter(isDefined)));
    } else if (newBodyMembers.length > 1) {
      const unionTypes = newBodyMembers.map((bodyMember, index) => {
        const propertySignature = newBodyMemberPropertySignatures[index];

        let headerMemberType = ts.factory.createTypeLiteralNode([
          ts.factory.createPropertySignature(
            undefined,
            ts.factory.createIdentifier('"content-type"'),
            undefined,
            ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(bodyMember.contentTypeName)),
          ),
        ]);

        if (newHeaderMember?.type && ts.isTypeLiteralNode(newHeaderMember.type)) {
          headerMemberType = ts.factory.updateTypeLiteralNode(
            newHeaderMember.type,
            ts.factory.createNodeArray([...headerMemberType.members, ...newHeaderMember.type.members]),
          );
        }

        const headerMember = ts.factory.createPropertySignature(
          newHeaderMember?.modifiers,
          ts.factory.createIdentifier('headers'),
          undefined,
          headerMemberType,
        );

        return ts.factory.createTypeLiteralNode([headerMember, propertySignature]);
      });

      return ts.factory.createUnionTypeNode(unionTypes);
    }
  } else if (ts.isIndexedAccessTypeNode(contentType)) {
    return renameComponentReferences(contentType, context);
  }

  return contentType;
}

function normalizeMethodRequest(request: ts.PropertySignature, context: NodeTransformationContext) {
  const newIdentifier = ts.factory.createIdentifier('request');

  if (!request.type) {
    return undefined;
  }

  const newType = normalizeMethodContentType(request.type, context, { bodyQuestionToken: request.questionToken });

  if (request.questionToken && ts.isIndexedAccessTypeNode(request.type)) {
    const referencedComponentName =
      ts.isLiteralTypeNode(request.type.indexType) && ts.isStringLiteral(request.type.indexType.literal)
        ? request.type.indexType.literal.text
        : undefined;

    if (referencedComponentName) {
      const existingActions = context.pendingActions.components.requests.get(referencedComponentName) ?? [];
      existingActions.push({ type: 'markAsOptional' });
      context.pendingActions.components.requests.set(referencedComponentName, existingActions);
    }
  }

  return ts.factory.updatePropertySignature(request, request.modifiers, newIdentifier, undefined, newType);
}

function normalizeMethodResponsesMemberType(
  responseMember: ts.PropertySignature,
  context: NodeTransformationContext,
  options: { isComponent: boolean },
) {
  const { isComponent } = options;

  if (responseMember.type && ts.isTypeLiteralNode(responseMember.type)) {
    const newType = normalizeMethodContentType(responseMember.type, context, {
      bodyQuestionToken: responseMember.questionToken,
    });

    if (!isComponent) {
      return newType;
    }

    context.typeImports.root.add('HttpSchema');

    const wrappedNewType = ts.factory.createTypeReferenceNode(
      ts.factory.createQualifiedName(
        ts.factory.createIdentifier('HttpSchema'),
        ts.factory.createIdentifier('Response'),
      ),
      [newType],
    );
    return wrappedNewType;
  }

  return responseMember.type;
}

export function normalizeMethodResponsesMember(
  responseMember: ts.TypeElement,
  context: NodeTransformationContext,
  options: { isComponent?: boolean } = {},
) {
  const { isComponent = false } = options;

  if (ts.isPropertySignature(responseMember)) {
    if (!isComponent && ts.isIdentifier(responseMember.name) && responseMember.name.text === 'default') {
      console.warn('[zimic] Response using `default` are not supported. Please use a specific, numeric status code.');
      return undefined;
    }

    const newType = normalizeMethodResponsesMemberType(responseMember, context, { isComponent });

    if (!newType) {
      return undefined;
    }

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

export function normalizeMethodResponses(responses: ts.PropertySignature, context: NodeTransformationContext) {
  const newIdentifier = ts.factory.createIdentifier('response');
  const newQuestionToken = undefined;

  if (!responses.type || isNeverType(responses.type)) {
    return undefined;
  }

  if (ts.isTypeLiteralNode(responses.type)) {
    const newMembers = responses.type.members
      .map((member) => normalizeMethodResponsesMember(member, context), context)
      .filter(isDefined);

    return ts.factory.updatePropertySignature(
      responses,
      responses.modifiers,
      newIdentifier,
      newQuestionToken,
      renameComponentReferences(
        ts.factory.updateTypeLiteralNode(responses.type, ts.factory.createNodeArray(newMembers)),
        context,
      ),
    );
  }

  return ts.factory.updatePropertySignature(
    responses,
    responses.modifiers,
    newIdentifier,
    newQuestionToken,
    responses.type,
  );
}

function normalizeMethodMember(methodMember: ts.TypeElement, context: NodeTransformationContext) {
  if (ts.isPropertySignature(methodMember) && ts.isIdentifier(methodMember.name)) {
    if (methodMember.name.text === 'requestBody') {
      return normalizeMethodRequest(methodMember, context);
    }
    if (methodMember.name.text === 'responses') {
      return normalizeMethodResponses(methodMember, context);
    }
    if (methodMember.name.text === 'parameters') {
      return methodMember;
    }
  }

  return undefined;
}

function normalizeMethodRequestMemberWithParameters(
  methodRequestMember: ts.TypeElement,
  context: NodeTransformationContext,
) {
  if (ts.isPropertySignature(methodRequestMember) && ts.isIdentifier(methodRequestMember.name)) {
    if (
      methodRequestMember.name.text === 'path' ||
      !methodRequestMember.type ||
      isNeverType(methodRequestMember.type)
    ) {
      return undefined;
    }

    const newQuestionToken = undefined;

    if (methodRequestMember.name.text === 'query') {
      context.typeImports.root.add('HttpSearchParamsSerialized');

      const newIdentifier = ts.factory.createIdentifier('searchParams');
      const newType = ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('HttpSearchParamsSerialized'), [
        renameComponentReferences(methodRequestMember.type, context),
      ]);

      return ts.factory.updatePropertySignature(
        methodRequestMember,
        methodRequestMember.modifiers,
        newIdentifier,
        newQuestionToken,
        newType,
      );
    } else if (methodRequestMember.name.text === 'header') {
      context.typeImports.root.add('HttpHeadersSerialized');

      const newIdentifier = ts.factory.createIdentifier('headers');
      const newType = ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('HttpHeadersSerialized'), [
        renameComponentReferences(methodRequestMember.type, context),
      ]);

      return ts.factory.updatePropertySignature(
        methodRequestMember,
        methodRequestMember.modifiers,
        newIdentifier,
        newQuestionToken,
        newType,
      );
    }
  }

  return methodRequestMember;
}

function normalizeMethodRequestTypeWithParameters(
  methodMemberType: ts.TypeNode,
  methodMembers: ts.TypeElement[],
  context: NodeTransformationContext,
): ts.TypeNode | undefined {
  if (ts.isUnionTypeNode(methodMemberType)) {
    const newTypes = methodMemberType.types
      .map((type) => normalizeMethodRequestTypeWithParameters(type, methodMembers, context))
      .filter(isDefined);

    return ts.factory.updateUnionTypeNode(methodMemberType, ts.factory.createNodeArray(newTypes));
  }

  if (ts.isIndexedAccessTypeNode(methodMemberType)) {
    const partialNewType = normalizeMethodRequestTypeWithParameters(
      ts.factory.createTypeLiteralNode([]),
      methodMembers,
      context,
    );

    return ts.factory.createIntersectionTypeNode([methodMemberType, partialNewType].filter(isDefined));
  }

  const methodMemberTypeMembers = ts.isTypeLiteralNode(methodMemberType) ? methodMemberType.members : [];

  const parametersMember = methodMembers.find((member): member is ts.PropertySignature => {
    return ts.isPropertySignature(member) && ts.isIdentifier(member.name) && member.name.text === 'parameters';
  });
  const parametersTypeMembers =
    parametersMember?.type && ts.isTypeLiteralNode(parametersMember.type) ? parametersMember.type.members : [];

  const newTypeMembers = [
    ...parametersTypeMembers.toSorted((member, otherMember) => {
      if (member.name && ts.isIdentifier(member.name) && otherMember.name && ts.isIdentifier(otherMember.name)) {
        return member.name.text.localeCompare(otherMember.name.text);
      }
      return 0;
    }),
    ...methodMemberTypeMembers,
  ]
    .map((member) => normalizeMethodRequestMemberWithParameters(member, context))
    .filter((member): member is ts.PropertySignature => isDefined(member) && !isNeverTypeMember(member));

  if (newTypeMembers.length === 0) {
    if (ts.isIndexedAccessTypeNode(methodMemberType)) {
      return renameComponentReferences(methodMemberType, context);
    }
    return undefined;
  }

  return ts.factory.createTypeLiteralNode(newTypeMembers);
}

function normalizeMethodMemberWithParameters(
  methodMember: ts.TypeElement,
  methodMembers: ts.TypeElement[],
  context: NodeTransformationContext,
) {
  if (ts.isPropertySignature(methodMember) && ts.isIdentifier(methodMember.name)) {
    if (methodMember.name.text === 'request' && methodMember.type) {
      const newType = normalizeMethodRequestTypeWithParameters(methodMember.type, methodMembers, context);

      if (!newType) {
        return undefined;
      }

      return ts.factory.updatePropertySignature(
        methodMember,
        methodMember.modifiers,
        methodMember.name,
        undefined,
        newType,
      );
    }

    if (methodMember.name.text === 'response') {
      return methodMember;
    }
  }

  return undefined;
}

function normalizeMethodParameters(methodMembers: ts.TypeElement[], context: NodeTransformationContext) {
  const newMembers = methodMembers
    .map((member) => normalizeMethodMemberWithParameters(member, methodMembers, context))
    .filter(isDefined);

  return newMembers;
}

export function normalizeMethodTypeLiteral(methodType: ts.TypeLiteralNode, context: NodeTransformationContext) {
  const newMembers = normalizeMethodParameters(
    methodType.members.map((member) => normalizeMethodMember(member, context)).filter(isDefined),
    context,
  );

  return ts.factory.updateTypeLiteralNode(methodType, ts.factory.createNodeArray(newMembers));
}

function normalizeMethodIndexedAccessType(methodType: ts.IndexedAccessTypeNode, context: NodeTransformationContext) {
  if (
    ts.isTypeReferenceNode(methodType.objectType) &&
    ts.isIdentifier(methodType.objectType.typeName) &&
    methodType.objectType.typeName.text === 'operations'
  ) {
    const newIdentifier = createOperationsIdentifier(context.serviceName);
    const newObjectType = ts.factory.createTypeReferenceNode(newIdentifier, methodType.objectType.typeArguments);

    return ts.factory.updateIndexedAccessTypeNode(methodType, newObjectType, methodType.indexType);
  }

  return methodType;
}

export function normalizeMethod(
  method: ts.TypeElement,
  context: NodeTransformationContext,
  options: { pathName: string },
) {
  if (!ts.isPropertySignature(method) || !ts.isIdentifier(method.name) || isNeverType(method.type)) {
    return undefined;
  }

  const methodName = method.name.text.toUpperCase<HttpMethod>();

  if (!SUPPORTED_HTTP_METHODS.has(methodName)) {
    return undefined;
  }

  if (context.filters.paths) {
    const pathMethodCompareString = `${methodName} ${options.pathName}`;

    const isIncluded = context.filters.paths.some((filter) => filter.test(pathMethodCompareString));
    if (!isIncluded) {
      return undefined;
    }
  }

  const newIdentifier = ts.factory.createIdentifier(methodName);

  let newType: ts.TypeNode | undefined = method.type;
  if (ts.isTypeLiteralNode(method.type)) {
    newType = normalizeMethodTypeLiteral(method.type, context);
  } else if (ts.isIndexedAccessTypeNode(method.type)) {
    newType = normalizeMethodIndexedAccessType(method.type, context);
  }

  return ts.factory.updatePropertySignature(method, method.modifiers, newIdentifier, method.questionToken, newType);
}
