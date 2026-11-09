import { IfNever, Prettify } from '../../types';

export interface HttpPathParamsSchema {
  [paramName: string]: string | undefined;
}

export namespace HttpPathParamsSchema {
  /** A schema for loose HTTP path parameters. Parameter values are not strictly typed. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type Loose = Record<string, any>;
}

type PrimitiveHttpPathParamsSerialized<Type> = [Type] extends [never]
  ? never
  : Type extends number
    ? `${number}`
    : Type extends boolean
      ? `${boolean}`
      : Type extends null
        ? 'null'
        : Type extends symbol
          ? never
          : Type extends HttpPathParamsSchema[string]
            ? Type
            : string;
/**
 * Recursively converts a schema to its path parameters-serialized version. Numbers, booleans, and null are converted to
 * `${number}`, `${boolean}`, and 'null' respectively, and other values become strings.
 *
 * @example
 *   import { type HttpPathParamsSerialized } from '@zimic/http';
 *
 *   type Params = HttpPathParamsSerialized<{
 *     userId: string;
 *     notificationId: number | null;
 *     full?: boolean;
 *   }>;
 *   // {
 *   //   userId: string;
 *   //   notificationId: `${number}` | 'null';
 *   //   full?: "false" | "true";
 *   // }
 */
export type HttpPathParamsSerialized<Type> = [Type] extends [never]
  ? never
  : Type extends HttpPathParamsSchema
    ? Type
    : Type extends object
      ? {
          [
            Key in keyof Type as IfNever<PrimitiveHttpPathParamsSerialized<Type[Key]>, never, Key>
          ]: PrimitiveHttpPathParamsSerialized<Type[Key]>;
        }
      : never;

type RepeatingPathParamModifier = '+';
type OptionalPathParamModifier = '?' | '*';

type ConvertPathParamToRecord<PathParam extends string> = PathParam extends `${infer PathParamWithoutSlash}/`
  ? ConvertPathParamToRecord<PathParamWithoutSlash>
  : PathParam extends `${infer PathParamWithoutSlash}\\:`
    ? ConvertPathParamToRecord<PathParamWithoutSlash>
    : PathParam extends `${infer PathParamWithoutModifier}${OptionalPathParamModifier}`
      ? { [Name in PathParamWithoutModifier]?: string }
      : PathParam extends `${infer PathParamWithoutModifier}${RepeatingPathParamModifier}`
        ? { [Name in PathParamWithoutModifier]: string }
        : { [Name in PathParam]: string };

type RecursiveInferPathParams<Path extends string> = Path extends `${infer Prefix}:${infer PathParamWithRemainingPath}`
  ? PathParamWithRemainingPath extends `${infer PathParam}/${infer RemainingPath}`
    ? Prefix extends `${string}\\`
      ? RecursiveInferPathParams<RemainingPath>
      : ConvertPathParamToRecord<PathParam> & RecursiveInferPathParams<RemainingPath>
    : PathParamWithRemainingPath extends `${infer PathParam}\\:${infer RemainingPath}`
      ? Prefix extends `${string}\\`
        ? RecursiveInferPathParams<`\\:${RemainingPath}`>
        : ConvertPathParamToRecord<PathParam> & RecursiveInferPathParams<`\\:${RemainingPath}`>
      : PathParamWithRemainingPath extends `${infer PathParam}:${infer RemainingPath}`
        ? Prefix extends `${string}\\`
          ? RecursiveInferPathParams<RemainingPath>
          : ConvertPathParamToRecord<PathParam> & RecursiveInferPathParams<`:${RemainingPath}`>
        : Prefix extends `${string}\\`
          ? {}
          : ConvertPathParamToRecord<PathParamWithRemainingPath>
  : {};

/** @see {@link https://zimic.dev/docs/http/api/http-schema#inferpathparams `InferPathParams` API reference} */
export type InferPathParams<Path extends string> = Prettify<RecursiveInferPathParams<Path>>;

export type WithoutEscapedColons<Path extends string> = Path extends `${infer Prefix}\\:${infer Suffix}`
  ? WithoutEscapedColons<`${Prefix}:${Suffix}`>
  : Path;

type ConvertPathParamToString<PathParam extends string> = PathParam extends `${infer PathParamWithoutSlash}/`
  ? `${ConvertPathParamToString<PathParamWithoutSlash>}/`
  : PathParam extends `${infer PathParamWithoutSlash}\\:`
    ? `${ConvertPathParamToString<PathParamWithoutSlash>}:`
    : string;

export type AllowAnyStringInPathParams<Path extends string> =
  Path extends `${infer Prefix}:${infer PathParamWithRemainingPath}`
    ? PathParamWithRemainingPath extends `${infer PathParam}/${infer RemainingPath}`
      ? Prefix extends `${infer PrefixPrefix}\\`
        ? `${PrefixPrefix}:${AllowAnyStringInPathParams<PathParamWithRemainingPath>}`
        : `${Prefix}${ConvertPathParamToString<PathParam>}/${AllowAnyStringInPathParams<RemainingPath>}`
      : PathParamWithRemainingPath extends `${infer PathParam}\\:${infer RemainingPath}`
        ? Prefix extends `${infer PrefixPrefix}\\`
          ? `${PrefixPrefix}:${AllowAnyStringInPathParams<PathParamWithRemainingPath>}`
          : `${Prefix}${ConvertPathParamToString<PathParam>}:${AllowAnyStringInPathParams<RemainingPath>}`
        : PathParamWithRemainingPath extends `${infer PathParam}:${infer RemainingPath}`
          ? Prefix extends `${infer PrefixPrefix}\\`
            ? `${PrefixPrefix}:${AllowAnyStringInPathParams<PathParamWithRemainingPath>}`
            : `${Prefix}${ConvertPathParamToString<PathParam>}${AllowAnyStringInPathParams<`:${RemainingPath}`>}`
          : Prefix extends `${infer PrefixPrefix}\\`
            ? `${PrefixPrefix}:${PathParamWithRemainingPath}`
            : `${Prefix}${ConvertPathParamToString<PathParamWithRemainingPath>}`
    : Path;
