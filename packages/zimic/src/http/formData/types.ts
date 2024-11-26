import { IfNever } from '@/types/utils';

/** A schema for strict HTTP form data. */
export interface HttpFormDataSchema {
  [fieldName: string]: string | string[] | Blob | Blob[] | null | undefined;
}

export namespace HttpFormDataSchema {
  /** A schema for loose HTTP form data. Field values are not strictly typed. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type Loose = Record<string, any>;
}

type PrimitiveHttpFormDataSerialized<Type> = Type extends HttpFormDataSchema[string]
  ? Type
  : Type extends (infer ArrayItem)[]
    ? ArrayItem extends (infer _InternalArrayItem)[]
      ? never
      : PrimitiveHttpFormDataSerialized<ArrayItem>[]
    : Type extends number
      ? `${number}`
      : Type extends boolean
        ? `${boolean}`
        : never;

/**
 * Recursively converts a schema to its {@link https://developer.mozilla.org/docs/Web/API/FormData FormData}-serialized
 * version. Numbers and booleans are converted to `${number}` and `${boolean}` respectively, and not serializable values
 * are excluded, such as functions and dates.
 *
 * @example
 *   import { type HttpFormDataSerialized } from 'zimic/http';
 *
 *   type Schema = HttpFormDataSerialized<{
 *     contentTitle: string | null;
 *     contentSize: number;
 *     content: Blob;
 *     full?: boolean;
 *     date: Date;
 *     method: () => void;
 *   }>;
 *   // {
 *   //   contentTitle: string | null;
 *   //   contentSize? `${number}`;
 *   //   content: Blob;
 *   //   full?: "false" | "true";
 *   // }
 */
export type HttpFormDataSerialized<Type> = Type extends HttpFormDataSchema
  ? Type
  : Type extends (infer _ArrayItem)[]
    ? never
    : Type extends Date
      ? never
      : Type extends (...parameters: never[]) => unknown
        ? never
        : Type extends symbol
          ? never
          : Type extends Map<infer _Key, infer _Value>
            ? never
            : Type extends Set<infer _Value>
              ? never
              : Type extends object
                ? {
                    [Key in keyof Type as IfNever<
                      PrimitiveHttpFormDataSerialized<Type[Key]>,
                      never,
                      Key
                    >]: PrimitiveHttpFormDataSerialized<Type[Key]>;
                  }
                : never;
