import {
  isReference,
  OpenAPIDocument,
  OpenAPIHeader,
  OpenAPIParameter,
  OpenAPIPathItem,
  OpenAPIReferenceable,
  OpenAPIRequestBody,
  OpenAPIResponse,
  OpenAPISchema,
} from '../document/types';
import { createJSDocComment } from '../utils/comments';
import { NEVER_TYPE, propertyKey, STRING_TYPE, TypeExpression, typeMember } from '../utils/types';
import { ComponentGroupName, ComponentName, ComponentPath, TypeTransformContext } from './context';
import { transformHeader, transformRequestBodyComponent, transformResponse } from './methods';
import { transformPathItem } from './paths';
import { createReferenceType } from './references';
import { createBinaryType, isBinarySchema, transformSchema } from './schemas';

interface ComponentValueByGroupName {
  schemas: OpenAPISchema;
  responses: OpenAPIResponse;
  parameters: OpenAPIParameter;
  requests: OpenAPIRequestBody;
  headers: OpenAPIHeader;
  pathItems: OpenAPIReferenceable<OpenAPIPathItem>;
}

export type DocumentComponent = {
  [GroupName in ComponentGroupName]: {
    groupName: GroupName;
    name: ComponentName;
    path: ComponentPath;
    value: ComponentValueByGroupName[GroupName];
  };
}[ComponentGroupName];

export interface DocumentComponentGroup {
  name: ComponentGroupName;
  components: DocumentComponent[];
}

function collectGroupComponents<GroupName extends ComponentGroupName>(
  groupName: GroupName,
  values: Record<string, ComponentValueByGroupName[GroupName]> | undefined,
) {
  return Object.entries(values ?? {}).map(([name, value]) => ({
    groupName,
    name,
    path: `${groupName}.${name}` as const,
    value,
  }));
}

/** Lists the component groups with at least one component, in the order they are generated. */
export function collectComponentGroups(document: OpenAPIDocument): DocumentComponentGroup[] {
  const { components = {} } = document;

  const groups: DocumentComponentGroup[] = [
    { name: 'schemas', components: collectGroupComponents('schemas', components.schemas) },
    { name: 'responses', components: collectGroupComponents('responses', components.responses) },
    { name: 'parameters', components: collectGroupComponents('parameters', components.parameters) },
    { name: 'requests', components: collectGroupComponents('requests', components.requestBodies) },
    { name: 'headers', components: collectGroupComponents('headers', components.headers) },
    { name: 'pathItems', components: collectGroupComponents('pathItems', components.pathItems) },
  ];

  return groups.filter((group) => group.components.length > 0);
}

function transformSchemaComponent(schema: OpenAPISchema, segments: string[], context: TypeTransformContext) {
  return isBinarySchema(schema) ? createBinaryType(schema) : transformSchema(schema, segments, context);
}

function transformComponentType(
  component: DocumentComponent,
  context: TypeTransformContext,
  options: { isBodyOptional: boolean },
): TypeExpression | undefined {
  const rawGroupName = component.groupName === 'requests' ? 'requestBodies' : component.groupName;
  const segments = ['components', rawGroupName, component.name];

  if (component.groupName === 'schemas') {
    return transformSchemaComponent(component.value, segments, context);
  }
  if (component.groupName === 'responses') {
    return transformResponse(component.value, segments, context);
  }
  if (component.groupName === 'parameters') {
    const { schema } = component.value;
    return schema === undefined ? STRING_TYPE : transformSchema(schema, segments, context);
  }
  if (component.groupName === 'requests') {
    return transformRequestBodyComponent(component.value, segments, context, options);
  }
  if (component.groupName === 'headers') {
    return transformHeader(component.value, segments, context);
  }

  return isReference(component.value)
    ? createReferenceType(component.value.$ref, context)
    : transformPathItem(component.value, component.name, segments, context);
}

/**
 * Generates a component, or `undefined` if it has nothing to generate, such as a `false` schema or a path item without
 * methods matching the path filters.
 */
export function transformComponent(
  component: DocumentComponent,
  context: TypeTransformContext,
  options: { isBodyOptional: boolean },
) {
  const type = transformComponentType(component, context, options);

  if (type === undefined || type === NEVER_TYPE) {
    return undefined;
  }

  return typeMember({
    key: propertyKey(component.name),
    type,
    comment: createJSDocComment(component.value, context),
  });
}
