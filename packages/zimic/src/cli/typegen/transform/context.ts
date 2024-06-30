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

interface ComponentChangeAction {
  type: 'markAsOptional' | 'unknown';
}

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
    shouldPopulateComponentPaths: boolean;
  };
  pendingActions: {
    components: {
      requests: Map<ComponentName, ComponentChangeAction[]>;
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
      shouldPopulateComponentPaths: true,
    },
    pendingActions: {
      components: {
        requests: new Map(),
      },
    },
  };
}
