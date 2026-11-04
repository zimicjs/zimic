import type { NormalizedProblem } from '@redocly/openapi-core';
import { createCachedDynamicImport } from '@zimic/utils/import';
import path from 'path';
import { fileURLToPath } from 'url';

import { OpenAPIDocument } from './types';

const importRedocly = createCachedDynamicImport(() => import('@redocly/openapi-core'));

function resolveDocumentLocation(filePathOrURL: string) {
  try {
    const url = new URL(filePathOrURL);
    return url.protocol === 'file:' ? fileURLToPath(url) : url.href;
  } catch {
    return path.resolve(filePathOrURL);
  }
}

function validateDocumentVersion(parsedDocument: unknown) {
  const isObject = typeof parsedDocument === 'object' && parsedDocument !== null;
  const openapi: unknown = isObject ? Reflect.get(parsedDocument, 'openapi') : undefined;
  const swagger: unknown = isObject ? Reflect.get(parsedDocument, 'swagger') : undefined;

  const hasSwaggerVersion = Boolean(swagger);
  const hasOpenAPIVersion = Boolean(openapi);
  const openapiVersion = Number.parseFloat(String(openapi));
  const isSupportedVersion = hasOpenAPIVersion && openapiVersion >= 3 && openapiVersion < 4;

  if (hasSwaggerVersion) {
    throw new Error('Unsupported Swagger version: 2.x. Use OpenAPI 3.x instead.');
  }

  if (isSupportedVersion) {
    return;
  }

  if (hasOpenAPIVersion || openapiVersion < 3 || openapiVersion >= 4) {
    throw new Error(`Unsupported OpenAPI version: ${String(openapi)}`);
  }

  throw new Error('Unsupported schema format, expected `openapi: 3.x`');
}

function throwIfHasErrors(problems: NormalizedProblem[]) {
  const lastError = problems.findLast((problem) => problem.severity === 'error');

  if (!lastError) {
    return;
  }

  const errorPointer = lastError.location.at(0)?.pointer;
  throw new Error(errorPointer ? `${lastError.message} at ${errorPointer}` : lastError.message);
}

/** Loads an OpenAPI document from a file or URL, validates it, and bundles its external references. */
export async function loadOpenAPIDocument(filePathOrURL: string) {
  const { BaseResolver, bundle, createConfig, lintDocument } = await importRedocly();

  // Other rules, such as `struct`, would reject documents that generate valid types, like OpenAPI 3.1 documents using
  // `nullable` or responses with non-standard status codes.
  const config = await createConfig(
    { rules: { 'operation-operationId-unique': 'error' } },
    // Redocly imports default plugins from the directory of the config, which is the working directory if no path is
    // provided. Using a path in this package prevents running plugins of the project. The file does not need to exist.
    { configPath: path.join(__dirname, 'redocly.yaml') },
  );

  const resolver = new BaseResolver(config.resolve);
  const document = await resolver.resolveDocument(null, resolveDocumentLocation(filePathOrURL), true);

  if (!('parsed' in document)) {
    throw document.originalError;
  }

  validateDocumentVersion(document.parsed);

  const lintProblems = await lintDocument({ document, config, externalRefResolver: resolver });
  throwIfHasErrors(lintProblems);

  const bundleResult = await bundle({ config, doc: document, dereference: false, externalRefResolver: resolver });
  throwIfHasErrors(bundleResult.problems);

  // The structure is not validated, so the document is trusted to follow the OpenAPI specification.
  return bundleResult.bundle.parsed as OpenAPIDocument;
}
