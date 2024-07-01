import { convertToPascalCase } from '@/utils/strings';

import { parseRawFilter, groupParsedFiltersByMatch } from './filters';

export interface TypePathFilters {
  positive: RegExp[];
  negative: RegExp[];
}

type RootTypeImportName =
  | 'HttpSchema'
  | 'HttpFormData'
  | 'HttpSearchParams'
  | 'HttpSearchParamsSerialized'
  | 'HttpHeadersSerialized';

export type ReferencedOperationTypePath = string;
export type ReferencedComponentTypePath = string;
export type ComponentName = string;

export interface TypeTransformContext {
  serviceName: string;
  filters: {
    paths: TypePathFilters;
  };
  typeImports: {
    root: Set<RootTypeImportName>;
  };
  referencedTypes: {
    operations: Set<ReferencedOperationTypePath>;
    components: Set<ReferencedComponentTypePath>;
    shouldTrackReferences: boolean;
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
      root: new Set(),
    },
    referencedTypes: {
      operations: new Set(),
      components: new Set(),
      shouldTrackReferences: true,
    },
    pendingActions: {
      components: {
        requests: { toMarkBodyAsOptional: new Set() },
      },
    },
  };
}
