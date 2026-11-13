import { IfNever, Prettify, UnionHasMoreThanOneType } from '../../types';

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

type ConvertPathParamToRecord<PathParam extends string> =
  PathParam extends `${infer PathParamWithoutModifier}${OptionalPathParamModifier}`
    ? { [Name in PathParamWithoutModifier]?: string }
    : PathParam extends `${infer PathParamWithoutModifier}${RepeatingPathParamModifier}`
      ? { [Name in PathParamWithoutModifier]: string }
      : { [Name in PathParam]: string };

type SplitPathParamFromSegment<
  Segment extends string,
  PathAfterSegment extends string,
> = Segment extends `${infer PathParam}:${infer RemainingSegment}`
  ? PathParam extends `${infer PathParamWithoutBackslash}\\`
    ? [PathParamWithoutBackslash, `\\:${RemainingSegment}${PathAfterSegment}`]
    : [PathParam, `:${RemainingSegment}${PathAfterSegment}`]
  : [Segment, PathAfterSegment];

/** Splits a path starting at a path param into the param and the remaining path, which keeps its leading delimiter. */
type SplitPathParam<PathParamWithRemainingPath extends string> =
  PathParamWithRemainingPath extends `${infer Segment}/${infer PathAfterSegment}`
    ? SplitPathParamFromSegment<Segment, `/${PathAfterSegment}`>
    : SplitPathParamFromSegment<PathParamWithRemainingPath, ''>;

type RecursiveInferPathParams<Path extends string> = Path extends `${infer Prefix}:${infer PathParamWithRemainingPath}`
  ? SplitPathParam<PathParamWithRemainingPath> extends [
      infer PathParam extends string,
      infer RemainingPath extends string,
    ]
    ? (Prefix extends `${string}\\` ? {} : ConvertPathParamToRecord<PathParam>) &
        RecursiveInferPathParams<RemainingPath>
    : never
  : {};

/** @see {@link https://zimic.dev/docs/http/api/http-schema#inferpathparams `InferPathParams` API reference} */
export type InferPathParams<Path extends string> = Prettify<RecursiveInferPathParams<Path>>;

type LargestPathPrefix<Path extends string> = Path extends `${infer Prefix}/${infer Suffix}`
  ? `${Prefix}/${Suffix extends `${string}/${string}` ? LargestPathPrefix<Suffix> : ''}`
  : Path;

type ExcludeNonLiteralPathsSupersededByLiteralPath<Path extends string> =
  Path extends `${LargestPathPrefix<Path>}:${string}` ? never : Path;

export type PreferMostStaticLiteralPath<Path extends string> =
  UnionHasMoreThanOneType<Path> extends true ? ExcludeNonLiteralPathsSupersededByLiteralPath<Path> : Path;

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
