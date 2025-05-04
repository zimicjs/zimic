import { ArrayKey, IfNever, NonArrayKey } from '@zimic/utils/types';

/** A schema for strict HTTP form data. */
export interface HttpFormDataSchema {
  [fieldName: string]: string | string[] | Blob | Blob[] | null | undefined;
}

export namespace HttpFormDataSchema {
  /** A schema for loose HTTP form data. Field values are not strictly typed. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type Loose = Record<string, any>;
}

export namespace HttpFormDataSchemaName {
  /** Extracts the names of the form data fields defined in a {@link HttpFormDataSchema} that are arrays. */
  export type Array<Schema extends HttpFormDataSchema> = IfNever<Schema, never, ArrayKey<Schema> & string>;

  /** Extracts the names of the form data fields defined in a {@link HttpFormDataSchema} that are not arrays. */
  export type NonArray<Schema extends HttpFormDataSchema> = IfNever<Schema, never, NonArrayKey<Schema> & string>;
}

/**
 * Extracts the names of the form data fields defined in a {@link HttpFormDataSchema}. Each key is considered a field
 * name. `HttpFormDataSchemaName.Array` can be used to extract the names of array form data fields, whereas
 * `HttpFormDataSchemaName.NonArray` extracts the names of non-array form data fields.
 *
 * @example
 *   import { type HttpFormDataSchemaName } from '@zimic/http';
 *
 *   type FormDataName = HttpFormDataSchemaName<{
 *     title: string;
 *     descriptions: string[];
 *     content: Blob;
 *   }>;
 *   // "title" | "descriptions" | "content"
 *
 *   type ArrayFormDataName = HttpFormDataSchemaName.Array<{
 *     title: string;
 *     descriptions: string[];
 *     content: Blob;
 *   }>;
 *   // "descriptions"
 *
 *   type NonArrayFormDataName = HttpFormDataSchemaName.NonArray<{
 *     title: string;
 *     descriptions: string[];
 *     content: Blob;
 *   }>;
 *   // "title" | "content"
 */
export type HttpFormDataSchemaName<Schema extends HttpFormDataSchema> = IfNever<Schema, never, keyof Schema & string>;

type PrimitiveHttpFormDataSerialized<Type> = [Type] extends [never]
  ? never
  : Type extends number
    ? `${number}`
    : Type extends boolean
      ? `${boolean}`
      : Type extends null
        ? 'null'
        : Type extends symbol
          ? never
          : Type extends HttpFormDataSchema[string]
            ? Type
            : Type extends (infer ArrayItem)[]
              ? ArrayItem extends (infer _InternalArrayItem)[]
                ? never
                : PrimitiveHttpFormDataSerialized<ArrayItem>[]
              : string;

/**
 * Recursively converts a schema to its {@link https://developer.mozilla.org/docs/Web/API/FormData FormData}-serialized
 * version. Numbers, booleans, and null are converted to `${number}`, `${boolean}`, and 'null' respectively, and other
 * values become strings.
 *
 * @example
 *   import { type HttpFormDataSerialized } from '@zimic/http';
 *
 *   type Schema = HttpFormDataSerialized<{
 *     contentTitle: string;
 *     contentSize: number | null;
 *     content: Blob;
 *     full?: boolean;
 *   }>;
 *   // {
 *   //   contentTitle: string;
 *   //   contentSize? `${number}` | 'null';
 *   //   content: Blob;
 *   //   full?: "false" | "true";
 *   // }
 */
export type HttpFormDataSerialized<Type> = [Type] extends [never]
  ? never
  : Type extends HttpFormDataSchema
    ? Type
    : Type extends object
      ? {
          [Key in keyof Type as IfNever<
            PrimitiveHttpFormDataSerialized<Type[Key]>,
            never,
            Key
          >]: PrimitiveHttpFormDataSerialized<Type[Key]>;
        }
      : never;
