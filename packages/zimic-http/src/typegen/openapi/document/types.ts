import { JSDocAnnotations } from '../utils/comments';

/** A reference, with the sibling keywords that OpenAPI 3.1 allows next to it. */
export interface OpenAPIReference {
  $ref: string;
  summary?: string;
  description?: string;
  default?: unknown;
  readOnly?: boolean;
}

export type OpenAPIReferenceable<Value> = OpenAPIReference | Value;

export interface OpenAPIDiscriminator {
  propertyName: string;
  mapping?: Record<string, string>;
}

export interface OpenAPISchemaObject extends JSDocAnnotations {
  type?: string | string[];
  nullable?: boolean;
  const?: unknown;
  enum?: unknown[];
  properties?: Record<string, OpenAPISchema>;
  additionalProperties?: OpenAPISchema;
  patternProperties?: Record<string, OpenAPISchema>;
  $defs?: Record<string, OpenAPISchema>;
  required?: string[];
  allOf?: OpenAPISchema[];
  anyOf?: OpenAPISchema[];
  oneOf?: OpenAPISchema[];
  items?: OpenAPISchema | OpenAPISchema[];
  prefixItems?: OpenAPISchema[];
  discriminator?: OpenAPIDiscriminator;
  readOnly?: boolean;
}

export type OpenAPISchema = boolean | OpenAPIReferenceable<OpenAPISchemaObject>;

export interface OpenAPIMediaType extends JSDocAnnotations {
  schema?: OpenAPISchema;
}

export interface OpenAPIParameter extends JSDocAnnotations {
  name: string;
  in: string;
  required?: boolean;
  schema?: OpenAPISchema;
}

export interface OpenAPIHeader extends JSDocAnnotations {
  required?: boolean;
  schema?: OpenAPISchema;
  content?: Record<string, OpenAPIReferenceable<OpenAPIMediaType>>;
}

export interface OpenAPIRequestBody extends JSDocAnnotations {
  required?: boolean;
  content?: Record<string, OpenAPIReferenceable<OpenAPIMediaType>>;
}

export interface OpenAPIResponse extends JSDocAnnotations {
  headers?: Record<string, OpenAPIReferenceable<OpenAPIHeader>>;
  content?: Record<string, OpenAPIMediaType>;
}

export interface OpenAPIOperation extends JSDocAnnotations {
  operationId?: string;
  parameters?: OpenAPIReferenceable<OpenAPIParameter>[];
  requestBody?: OpenAPIReferenceable<OpenAPIRequestBody>;
  responses?: Record<string, OpenAPIReferenceable<OpenAPIResponse>>;
}

export const OPENAPI_PATH_ITEM_METHODS = Object.freeze([
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const);

export type OpenAPIPathItemMethod = (typeof OPENAPI_PATH_ITEM_METHODS)[number];

export type OpenAPIPathItem = JSDocAnnotations & {
  parameters?: OpenAPIReferenceable<OpenAPIParameter>[];
} & {
  [Method in OpenAPIPathItemMethod]?: OpenAPIOperation;
};

export interface OpenAPIComponents {
  schemas?: Record<string, OpenAPISchema>;
  responses?: Record<string, OpenAPIResponse>;
  parameters?: Record<string, OpenAPIParameter>;
  requestBodies?: Record<string, OpenAPIRequestBody>;
  headers?: Record<string, OpenAPIHeader>;
  pathItems?: Record<string, OpenAPIReferenceable<OpenAPIPathItem>>;
}

export interface OpenAPIDocument {
  paths?: Record<string, OpenAPIReferenceable<OpenAPIPathItem>>;
  webhooks?: Record<string, OpenAPIPathItem>;
  components: OpenAPIComponents;
}

export function isReference(value: unknown): value is OpenAPIReference {
  return typeof value === 'object' && value !== null && '$ref' in value;
}
