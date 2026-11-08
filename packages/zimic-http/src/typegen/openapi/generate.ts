import { isDefined } from '@zimic/utils/data';
import path from 'path';

import { logger } from '@/utils/logging';

import { loadOpenAPIDocument } from './document/load';
import {
  collectComponentGroups,
  DocumentComponent,
  DocumentComponentGroup,
  transformComponent,
} from './transform/components';
import {
  ComponentPath,
  createTypeTransformationContext,
  generateWithDependencies,
  OperationName,
  TypeDependencies,
  TypeTransformContext,
} from './transform/context';
import { readPathFiltersFromFile, ignoreEmptyFilters } from './transform/filters';
import { createImportDeclaration } from './transform/imports';
import {
  formatTypegenResultToOutput,
  writeTypegenResultToStandardOutput,
  writeTypegenResultToFile,
} from './transform/io';
import { collectOperations, DocumentOperation, transformDocumentOperation } from './transform/operations';
import { createSchemaIdentifier, transformPaths } from './transform/paths';
import { createComponentsIdentifier, createOperationsIdentifier } from './transform/references';
import {
  interfaceDeclaration,
  objectType,
  propertyKey,
  typeAliasDeclaration,
  TypeExpression,
  TypeMember,
  typeMember,
} from './utils/types';

const WITH_REQUIRED_HELPER_DECLARATION = [
  'type WithRequired<T, K extends keyof T> = T & {',
  '  [P in K]-?: T[P];',
  '};',
].join('\n');

interface GeneratedType<Type> {
  type: Type;
  dependencies: TypeDependencies;
}

/**
 * Generates the operations and components of a document. When pruning, only the ones the paths use, directly or through
 * other operations and components, are generated.
 */
class DocumentTypeGenerator {
  private operationsByName: Map<OperationName, DocumentOperation>;
  private componentsByPath: Map<ComponentPath, DocumentComponent>;

  readonly generatedOperations = new Map<OperationName, GeneratedType<TypeExpression>>();
  readonly generatedComponents = new Map<ComponentPath, GeneratedType<TypeMember | undefined>>();

  constructor(
    readonly operations: DocumentOperation[],
    readonly componentGroups: DocumentComponentGroup[],
    private context: TypeTransformContext,
  ) {
    this.operationsByName = new Map(operations.map((operation) => [operation.name, operation]));

    this.componentsByPath = new Map(
      componentGroups.flatMap((group) => group.components).map((component) => [component.path, component]),
    );
  }

  generateAll() {
    for (const operation of this.operations) {
      this.generateOperation(operation);
    }

    for (const component of this.componentsByPath.values()) {
      this.generateComponent(component, { isBodyOptional: false });
    }
  }

  generateUsedBy(rootDependencies: TypeDependencies) {
    const pendingDependencies = [rootDependencies];

    for (let dependencies = pendingDependencies.pop(); dependencies; dependencies = pendingDependencies.pop()) {
      for (const operationName of dependencies.operations) {
        const operation = this.operationsByName.get(operationName);

        if (operation && !this.generatedOperations.has(operationName)) {
          pendingDependencies.push(this.generateOperation(operation).dependencies);
        }
      }

      for (const componentPath of dependencies.components) {
        const component = this.componentsByPath.get(componentPath);

        if (component && !this.generatedComponents.has(componentPath)) {
          pendingDependencies.push(this.generateComponent(component, { isBodyOptional: false }).dependencies);
        }
      }
    }
  }

  /** Makes the body of request components optional if a generated operation does not require it. */
  applyOptionalRequestBodies(dependencies: TypeDependencies[]) {
    const optionalRequestComponentPaths = new Set<ComponentPath>(
      dependencies.flatMap((typeDependencies) =>
        Array.from(typeDependencies.optionalRequestComponents, (componentName) => `requests.${componentName}` as const),
      ),
    );

    for (const component of this.componentsByPath.values()) {
      if (optionalRequestComponentPaths.has(component.path)) {
        this.generateComponent(component, { isBodyOptional: true });
      }
    }
  }

  private generateOperation(operation: DocumentOperation) {
    const generatedOperation = generateWithDependencies(this.context, (context) =>
      transformDocumentOperation(operation, context),
    );

    this.generatedOperations.set(operation.name, generatedOperation);
    return generatedOperation;
  }

  private generateComponent(component: DocumentComponent, options: { isBodyOptional: boolean }) {
    const generatedComponent = generateWithDependencies(this.context, (context) =>
      transformComponent(component, context, options),
    );

    this.generatedComponents.set(component.path, generatedComponent);
    return generatedComponent;
  }
}

function createComponentsDeclaration(
  generator: DocumentTypeGenerator,
  context: TypeTransformContext,
  options: { prune: boolean },
) {
  const groupMembers = generator.componentGroups.flatMap((group) => {
    const generatedComponents = group.components
      .map((component) => generator.generatedComponents.get(component.path))
      .filter(isDefined);

    if (generatedComponents.length === 0) {
      return [];
    }

    const componentMembers = generatedComponents.map((component) => component.type).filter(isDefined);
    return [typeMember({ key: group.name, type: objectType(componentMembers) })];
  });

  if (options.prune && groupMembers.length === 0) {
    return undefined;
  }

  return interfaceDeclaration(createComponentsIdentifier(context.serviceName), groupMembers);
}

function createOperationsDeclaration(generator: DocumentTypeGenerator, context: TypeTransformContext) {
  const operationMembers = generator.operations.flatMap((operation) => {
    const generatedOperation = generator.generatedOperations.get(operation.name);
    return generatedOperation ? [typeMember({ key: propertyKey(operation.name), type: generatedOperation.type })] : [];
  });

  if (operationMembers.length === 0) {
    return undefined;
  }

  return interfaceDeclaration(createOperationsIdentifier(context.serviceName), operationMembers);
}

function mergeHttpImports(dependencies: TypeDependencies[]) {
  return new Set(dependencies.flatMap((typeDependencies) => Array.from(typeDependencies.httpImports)));
}

/** @see {@link https://zimic.dev/docs/http/api/typegen#generatetypesfromopenapi `generateTypesFromOpenAPI()` API reference} */
export interface OpenAPITypegenOptions {
  /** @see {@link https://zimic.dev/docs/http/api/typegen#generatetypesfromopenapi `generateTypesFromOpenAPI()` API reference} */
  input: string;
  /** @see {@link https://zimic.dev/docs/http/api/typegen#generatetypesfromopenapi `generateTypesFromOpenAPI()` API reference} */
  output?: string;
  /** @see {@link https://zimic.dev/docs/http/api/typegen#generatetypesfromopenapi `generateTypesFromOpenAPI()` API reference} */
  serviceName: string;
  /** @see {@link https://zimic.dev/docs/http/api/typegen#generatetypesfromopenapi `generateTypesFromOpenAPI()` API reference} */
  includeComments: boolean;
  /** @see {@link https://zimic.dev/docs/http/api/typegen#generatetypesfromopenapi `generateTypesFromOpenAPI()` API reference} */
  prune: boolean;
  /** @see {@link https://zimic.dev/docs/http/api/typegen#generatetypesfromopenapi `generateTypesFromOpenAPI()` API reference} */
  filters?: string[];
  /** @see {@link https://zimic.dev/docs/http/api/typegen#generatetypesfromopenapi `generateTypesFromOpenAPI()` API reference} */
  filterFile?: string;
}

/** @see {@link https://zimic.dev/docs/http/api/typegen#generatetypesfromopenapi  `generateTypesFromOpenAPI()` API reference} */
async function generateTypesFromOpenAPI({
  input: inputFilePathOrURL,
  output: outputFilePath,
  serviceName,
  includeComments,
  prune,
  filters: filtersFromArguments = [],
  filterFile,
}: OpenAPITypegenOptions) {
  const filtersFromFile = filterFile ? await readPathFiltersFromFile(path.resolve(filterFile)) : [];
  const filters = ignoreEmptyFilters([...filtersFromFile, ...filtersFromArguments]);

  const document = await loadOpenAPIDocument(inputFilePathOrURL);
  const context = createTypeTransformationContext({ serviceName, includeComments, document, rawFilters: filters });

  const paths = generateWithDependencies(context, (pathsContext) => transformPaths(document, pathsContext));

  const generator = new DocumentTypeGenerator(collectOperations(document), collectComponentGroups(document), context);

  if (prune) {
    generator.generateUsedBy(paths.dependencies);
  } else {
    generator.generateAll();
  }

  const operationsAndComponentsDependencies = [
    ...Array.from(generator.generatedOperations.values()),
    ...Array.from(generator.generatedComponents.values()),
  ].map((generatedType) => generatedType.dependencies);

  generator.applyOptionalRequestBodies([paths.dependencies, ...operationsAndComponentsDependencies]);

  const allDependencies = [
    paths.dependencies,
    ...generator.operations.map((operation) => generator.generatedOperations.get(operation.name)?.dependencies),
    ...generator.componentGroups
      .flatMap((group) => group.components)
      .map((component) => generator.generatedComponents.get(component.path)?.dependencies),
  ].filter(isDefined);

  for (const warning of allDependencies.flatMap((dependencies) => dependencies.warnings)) {
    logger.warn(warning);
  }

  const declarations = [
    createImportDeclaration(mergeHttpImports(allDependencies)),
    typeAliasDeclaration(createSchemaIdentifier(context.serviceName), paths.type),
    createComponentsDeclaration(generator, context, { prune }),
    createOperationsDeclaration(generator, context),
    allDependencies.some((dependencies) => dependencies.usesWithRequiredHelper)
      ? WITH_REQUIRED_HELPER_DECLARATION
      : undefined,
  ].filter(isDefined);

  const typegenResult = formatTypegenResultToOutput(declarations);

  const shouldWriteToStandardOutput = outputFilePath === undefined;

  if (shouldWriteToStandardOutput) {
    await writeTypegenResultToStandardOutput(typegenResult);
  } else {
    await writeTypegenResultToFile(path.resolve(outputFilePath), typegenResult);
  }
}

export default generateTypesFromOpenAPI;
