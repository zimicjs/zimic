import { convertToPascalCase } from '@/utils/strings';

import { DocumentDiscriminators, scanDiscriminators } from '../document/discriminators';
import { OpenAPIDocument } from '../document/types';
import { parseRawFilter, groupParsedFiltersByMatch } from './filters';

export interface TypePathFilter {
  methodRegex: RegExp;
  pathRegex: RegExp;
  isNegativeMatch: boolean;
}

export interface TypePathFilters {
  positive: TypePathFilter[];
  negative: TypePathFilter[];
}

type HttpTypeImportName =
  'HttpSchema' | 'HttpFormData' | 'HttpSearchParams' | 'HttpStatusCode' | 'MergeHttpResponsesByStatusCode';

export type OperationName = string;

export type ComponentGroupName = 'schemas' | 'responses' | 'parameters' | 'requests' | 'headers' | 'pathItems';
export type ComponentName = string;
export type ComponentPath = `${ComponentGroupName}.${ComponentName}`;

/** What a generated type uses, so it can be kept along with everything it depends on. */
export interface TypeDependencies {
  httpImports: Set<HttpTypeImportName>;
  operations: Set<OperationName>;
  components: Set<ComponentPath>;
  /** Request components referenced by operations whose request body is optional. */
  optionalRequestComponents: Set<ComponentName>;
  usesWithRequiredHelper: boolean;
  warnings: string[];
}

export function createTypeDependencies(): TypeDependencies {
  return {
    httpImports: new Set(),
    operations: new Set(),
    components: new Set(),
    optionalRequestComponents: new Set(),
    usesWithRequiredHelper: false,
    warnings: [],
  };
}

export interface TypeTransformContext {
  serviceName: string;
  includeComments: boolean;
  document: OpenAPIDocument;
  discriminators: DocumentDiscriminators;
  filters: {
    paths: TypePathFilters;
  };
  /** The dependencies of the type being generated. */
  dependencies: TypeDependencies;
}

interface TypeTransformContextOptions {
  serviceName: string;
  includeComments: boolean;
  document: OpenAPIDocument;
  rawFilters: string[];
}

export function createTypeTransformationContext({
  serviceName,
  includeComments,
  document,
  rawFilters,
}: TypeTransformContextOptions): TypeTransformContext {
  const parsedFilters = rawFilters.map(parseRawFilter);

  return {
    serviceName: convertToPascalCase(serviceName),
    includeComments,
    document,
    discriminators: scanDiscriminators(document),
    filters: {
      paths: groupParsedFiltersByMatch(parsedFilters),
    },
    dependencies: createTypeDependencies(),
  };
}

/** Generates a type, collecting its dependencies separately from the dependencies of other types. */
export function generateWithDependencies<Type>(
  context: TypeTransformContext,
  generate: (context: TypeTransformContext) => Type,
) {
  const dependencies = createTypeDependencies();
  const type = generate({ ...context, dependencies });
  return { type, dependencies };
}
