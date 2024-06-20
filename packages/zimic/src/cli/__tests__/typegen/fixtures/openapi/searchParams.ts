import type { HttpSchema, HttpSearchParamSerialized } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/users-with-literal-component-search-params': {
    GET: {
      request: {
        searchParams: {
          search?: MyServiceComponents['parameters']['literalSearch'];
          order?: MyServiceComponents['parameters']['literalOrder'];
          limit: MyServiceComponents['parameters']['literalLimit'];
          archived?: MyServiceComponents['parameters']['literalArchived'];
        };
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
        searchParams: {
          search?: MyServiceComponents['parameters']['referenceSearch'];
          order?: MyServiceComponents['parameters']['referenceOrder'];
          limit: MyServiceComponents['parameters']['referenceLimit'];
          archived?: MyServiceComponents['parameters']['referenceArchived'];
        };
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
        searchParams: {
          search?: HttpSearchParamSerialized<MyServiceComponents['schemas']['search']>;
          order?: HttpSearchParamSerialized<MyServiceComponents['schemas']['order']>;
          limit: HttpSearchParamSerialized<MyServiceComponents['schemas']['limit']>;
          archived?: HttpSearchParamSerialized<MyServiceComponents['schemas']['archived']>;
        };
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
        searchParams: {
          search?: string | undefined;
          order?: 'asc' | 'desc';
          limit: `${number}`;
          archived?: `${boolean}`;
        };
      };
      response: {
        200: {
          body: MyServiceComponents['schemas']['User'][];
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
    search: string | null;
    order: 'asc' | 'desc';
    limit: number;
    archived: boolean;
  };
  parameters: {
    literalSearch: string | undefined;
    literalOrder: HttpSearchParamSerialized<MyServiceComponents['schemas']['order']>;
    literalLimit: `${number}`;
    literalArchived: `${boolean}`;
    referenceSearch: HttpSearchParamSerialized<MyServiceComponents['schemas']['search']>;
    referenceOrder: HttpSearchParamSerialized<MyServiceComponents['schemas']['order']>;
    referenceLimit: HttpSearchParamSerialized<MyServiceComponents['schemas']['limit']>;
    referenceArchived: HttpSearchParamSerialized<MyServiceComponents['schemas']['archived']>;
  };
}
