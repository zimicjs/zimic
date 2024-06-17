import ts from 'typescript';

import { HttpMethod } from '@/http/types/schema';
import { isDefined } from '@/utils/data';

import { NodeTransformationContext, SUPPORTED_HTTP_METHODS } from '../openapi';
import { renameComponentReferences } from './components';
import { createOperationsIdentifier } from './operations';
import { isUnknownType, isNumericType, isNeverTypeMember, isNeverType, isBooleanType } from './types';

function normalizeRequestBodyMember(requestBodyMember: ts.TypeElement, context: NodeTransformationContext) {
  if (ts.isPropertySignature(requestBodyMember)) {
    const newIdentifier = ts.factory.createIdentifier('body');
    const newType = requestBodyMember.type ? renameComponentReferences(requestBodyMember.type, context) : undefined;

    return ts.factory.updatePropertySignature(
      requestBodyMember,
      requestBodyMember.modifiers,
      newIdentifier,
      requestBodyMember.questionToken,
      newType,
    );
  }

  return undefined;
}

function normalizeRequestBody(requestBody: ts.TypeNode | undefined, context: NodeTransformationContext) {
  if (requestBody && ts.isTypeLiteralNode(requestBody)) {
    const newType = requestBody.members.map((member) => normalizeRequestBodyMember(member, context)).find(isDefined);
    return newType;
  }
  return undefined;
}

function normalizeBodyHeader(headerType: ts.TypeNode | undefined) {
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

function normalizeRequestMember(requestMember: ts.TypeElement, context: NodeTransformationContext) {
  if (ts.isPropertySignature(requestMember) && ts.isIdentifier(requestMember.name)) {
    if (requestMember.name.text === 'content') {
      return normalizeRequestBody(requestMember.type, context);
    }

    if (requestMember.name.text === 'headers') {
      const newType = normalizeBodyHeader(requestMember.type);
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

function normalizeMethodRequest(request: ts.PropertySignature, context: NodeTransformationContext) {
  const newIdentifier = ts.factory.createIdentifier('request');
  const newQuestionToken = undefined;

  let newType = request.type;

  if (request.type && ts.isTypeLiteralNode(request.type)) {
    const newMembers = request.type.members.map((member) => normalizeRequestMember(member, context)).filter(isDefined);
    newType = ts.factory.updateTypeLiteralNode(request.type, ts.factory.createNodeArray(newMembers));
  }

  return ts.factory.updatePropertySignature(request, request.modifiers, newIdentifier, newQuestionToken, newType);
}

function normalizeMethodResponsesMemberType(
  responseMemberType: ts.TypeNode | undefined,
  context: NodeTransformationContext,
) {
  if (responseMemberType && ts.isTypeLiteralNode(responseMemberType)) {
    const newMembers = responseMemberType.members
      .map((member) => normalizeRequestMember(member, context))
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
      .map((member) => normalizeMethodResponsesMember(member, context), context)
      .filter(isDefined);

    return ts.factory.updatePropertySignature(
      responses,
      responses.modifiers,
      newIdentifier,
      undefined,
      renameComponentReferences(
        ts.factory.updateTypeLiteralNode(responses.type, ts.factory.createNodeArray(newMembers)),
        context,
      ),
    );
  }

  return ts.factory.updatePropertySignature(responses, responses.modifiers, newIdentifier, undefined, responses.type);
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

export function transformNumberTypeToNumberTemplateLiteral(member: ts.PropertySignature) {
  const newType = ts.factory.createTemplateLiteralType(ts.factory.createTemplateHead(''), [
    ts.factory.createTemplateLiteralTypeSpan(
      ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('number'), undefined),
      ts.factory.createTemplateTail(''),
    ),
  ]);

  return ts.factory.updatePropertySignature(member, member.modifiers, member.name, member.questionToken, newType);
}

function normalizeNumericMembersToTemplateLiterals(methodRequestType: ts.TypeNode | undefined) {
  if (methodRequestType && ts.isTypeLiteralNode(methodRequestType)) {
    const newMembers = methodRequestType.members.map((member) => {
      if (ts.isPropertySignature(member) && member.type && isNumericType(member.type)) {
        return transformNumberTypeToNumberTemplateLiteral(member);
      }
      return member;
    });

    return ts.factory.updateTypeLiteralNode(methodRequestType, ts.factory.createNodeArray(newMembers));
  }

  return undefined;
}

export function transformBooleanTypeToBooleanTemplateLiteral(member: ts.PropertySignature) {
  const newType = ts.factory.createTemplateLiteralType(ts.factory.createTemplateHead(''), [
    ts.factory.createTemplateLiteralTypeSpan(
      ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('boolean'), undefined),
      ts.factory.createTemplateTail(''),
    ),
  ]);

  return ts.factory.updatePropertySignature(member, member.modifiers, member.name, member.questionToken, newType);
}

function normalizeBooleanMembersToTemplateLiterals(methodRequestType: ts.TypeNode | undefined) {
  if (methodRequestType && ts.isTypeLiteralNode(methodRequestType)) {
    const newMembers = methodRequestType.members.map((member) => {
      if (ts.isPropertySignature(member) && member.type && isBooleanType(member.type)) {
        return transformBooleanTypeToBooleanTemplateLiteral(member);
      }
      return member;
    });

    return ts.factory.updateTypeLiteralNode(methodRequestType, ts.factory.createNodeArray(newMembers));
  }

  return undefined;
}

function normalizeMethodRequestMemberWithParameters(
  methodRequestMember: ts.TypeElement,
  context: NodeTransformationContext,
) {
  if (ts.isPropertySignature(methodRequestMember) && ts.isIdentifier(methodRequestMember.name)) {
    if (methodRequestMember.name.text === 'path') {
      return undefined;
    }

    const newQuestionToken = undefined;

    if (methodRequestMember.name.text === 'query' && methodRequestMember.type) {
      const newIdentifier = ts.factory.createIdentifier('searchParams');

      const newType = normalizeBooleanMembersToTemplateLiterals(
        normalizeNumericMembersToTemplateLiterals(renameComponentReferences(methodRequestMember.type, context)),
      );

      if (!newType) {
        return undefined;
      }

      return ts.factory.updatePropertySignature(
        methodRequestMember,
        methodRequestMember.modifiers,
        newIdentifier,
        newQuestionToken,
        newType,
      );
    } else if (methodRequestMember.name.text === 'header' && methodRequestMember.type) {
      const newIdentifier = ts.factory.createIdentifier('headers');
      const newType = normalizeNumericMembersToTemplateLiterals(
        renameComponentReferences(methodRequestMember.type, context),
      );

      if (!newType) {
        return undefined;
      }

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
) {
  const requestParameterTypeMembers = ts.isTypeLiteralNode(methodMemberType) ? methodMemberType.members : [];

  const parametersMember = methodMembers.find((member): member is ts.PropertySignature => {
    return ts.isPropertySignature(member) && ts.isIdentifier(member.name) && member.name.text === 'parameters';
  });
  const parametersTypeMembers =
    parametersMember?.type && ts.isTypeLiteralNode(parametersMember.type) ? parametersMember.type.members : [];

  const newTypeMembers = [...requestParameterTypeMembers, ...parametersTypeMembers]
    .map((member) => normalizeMethodRequestMemberWithParameters(member, context))
    .filter((member): member is ts.PropertySignature => isDefined(member) && !isNeverTypeMember(member));

  if (newTypeMembers.length === 0) {
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

export function normalizeMethod(method: ts.TypeElement, context: NodeTransformationContext) {
  if (!ts.isPropertySignature(method) || !ts.isIdentifier(method.name) || isNeverType(method.type)) {
    return undefined;
  }

  const methodName = method.name.text.toUpperCase<HttpMethod>();
  if (!SUPPORTED_HTTP_METHODS.has(methodName)) {
    return undefined;
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
