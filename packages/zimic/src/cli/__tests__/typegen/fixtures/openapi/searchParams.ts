import type { HttpSchema, HttpSearchParams, HttpSearchParamsSerialized } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/users-with-literal-component-search-params-in-path': {
    GET: {
      request: {
        searchParams: HttpSearchParamsSerialized<{
          search?: MyServiceComponents['parameters']['literalSearch'];
          order?: MyServiceComponents['parameters']['literalOrder'];
          limit: MyServiceComponents['parameters']['literalLimit'];
          archived?: MyServiceComponents['parameters']['literalArchived'];
        }>;
      };
      response: {
        200: {
          body: MyServiceComponents['schemas']['User'][];
        };
      };
    };
  };
  '/users-with-literal-component-search-params': {
    GET: {
      request: {
        searchParams: HttpSearchParamsSerialized<{
          search?: MyServiceComponents['parameters']['literalSearch'];
          order?: MyServiceComponents['parameters']['literalOrder'];
          limit: MyServiceComponents['parameters']['literalLimit'];
          archived?: MyServiceComponents['parameters']['literalArchived'];
        }>;
      };
      response: {
        200: {
          body: MyServiceComponents['schemas']['User'][];
        };
      };
    };
  };
  '/users-with-reference-component-search-params': {
    GET: {
      request: {
        searchParams: HttpSearchParamsSerialized<{
          search?: MyServiceComponents['parameters']['referenceSearch'];
          order?: MyServiceComponents['parameters']['referenceOrder'];
          limit: MyServiceComponents['parameters']['referenceLimit'];
          archived?: MyServiceComponents['parameters']['referenceArchived'];
        }>;
      };
      response: {
        200: {
          body: MyServiceComponents['schemas']['User'][];
        };
      };
    };
  };
  '/users-with-reference-search-params': {
    GET: {
      request: {
        searchParams: HttpSearchParamsSerialized<{
          search?: MyServiceComponents['schemas']['search'];
          order?: MyServiceComponents['schemas']['order'];
          limit: MyServiceComponents['schemas']['limit'];
          archived?: MyServiceComponents['schemas']['archived'];
        }>;
      };
      response: {
        200: {
          body: MyServiceComponents['schemas']['User'][];
        };
      };
    };
  };
  '/users-with-literal-search-params': {
    GET: {
      request: {
        searchParams: HttpSearchParamsSerialized<{
          search?: (string | null) | string[];
          order?: 'asc' | 'desc';
          limit: number;
          archived?: boolean;
        }>;
      };
      response: {
        200: {
          body: MyServiceComponents['schemas']['User'][];
        };
      };
    };
  };
  '/users-with-reference-search-params-in-body': {
    GET: {
      response: {
        200: {
          body: HttpSearchParams<
            HttpSearchParamsSerialized<{
              search: MyServiceComponents['schemas']['search'];
              order: MyServiceComponents['schemas']['order'];
              limit: MyServiceComponents['schemas']['limit'];
              archived: MyServiceComponents['schemas']['archived'];
            }>
          >;
        };
      };
    };
  };
  '/users-with-literal-search-params-in-body': {
    GET: {
      response: {
        200: {
          body: HttpSearchParams<
            HttpSearchParamsSerialized<{
              search?: (string | null) | string[];
              order?: 'asc' | 'desc';
              limit?: number | null;
              archived: boolean;
            }>
          >;
        };
      };
    };
  };
}>;
export interface MyServiceComponents {
  schemas: {
    User: {
      id: number;
      name: string;
    };
    search: (string | null) | string[];
    order: 'asc' | 'desc';
    limit: number | null;
    archived: boolean;
  };
  parameters: {
    literalSearch: (string | null) | string[];
    literalOrder: MyServiceComponents['schemas']['order'];
    literalLimit: number | null;
    literalArchived: boolean;
    referenceSearch: MyServiceComponents['schemas']['search'];
    referenceOrder: MyServiceComponents['schemas']['order'];
    referenceLimit: MyServiceComponents['schemas']['limit'];
    referenceArchived: MyServiceComponents['schemas']['archived'];
  };
}
