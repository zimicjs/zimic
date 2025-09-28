import { convertToPascalCase } from '@/utils/strings';

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
  | 'HttpSchema'
  | 'HttpFormData'
  | 'HttpSearchParams'
  | 'HttpStatusCode'
  | 'MergeHttpResponsesByStatusCode';

type OperationName = string;
export type OperationPath = OperationName;

export type ComponentGroupName = string;
export type ComponentName = string;
export type ComponentPath = `${ComponentGroupName}.${ComponentName}`;

export interface TypeTransformContext {
  serviceName: string;
  filters: {
    paths: TypePathFilters;
  };
  typeImports: {
    http: Set<HttpTypeImportName>;
  };
  referencedTypes: {
    operations: Set<OperationPath>;
    components: Set<ComponentPath>;
  };
  pendingActions: {
    components: {
      requests: { toMarkBodyAsOptional: Set<ComponentName> };
    };
  };
}

export function createTypeTransformationContext(serviceName: string, rawFilters: string[]): TypeTransformContext {
  const parsedFilters = rawFilters.map(parseRawFilter);

  return {
    serviceName: convertToPascalCase(serviceName),
    filters: {
      paths: groupParsedFiltersByMatch(parsedFilters),
    },
    typeImports: {
      http: new Set(),
    },
    referencedTypes: {
      operations: new Set(),
      components: new Set(),
    },
    pendingActions: {
      components: {
        requests: { toMarkBodyAsOptional: new Set() },
      },
    },
  };
}
