import { parseReferencePointer } from '../document/references';
import { indexedAccessType, referenceType } from '../utils/types';
import { ComponentGroupName, TypeTransformContext } from './context';

const COMPONENT_GROUP_NAMES = new Set<string>([
  'schemas',
  'responses',
  'parameters',
  'requests',
  'headers',
  'pathItems',
]);

function isComponentGroupName(name: string): name is ComponentGroupName {
  return COMPONENT_GROUP_NAMES.has(name);
}

export function normalizeComponentGroupName(rawComponentGroupName: string) {
  return rawComponentGroupName === 'requestBodies' ? 'requests' : rawComponentGroupName;
}

export function createComponentsIdentifier(serviceName: string) {
  return `${serviceName}Components`;
}

export function createOperationsIdentifier(serviceName: string) {
  return `${serviceName}Operations`;
}

/**
 * Creates the type of a local reference, such as `#/components/schemas/User`, as an indexed access to the generated
 * types. References to components are recorded as dependencies of the type being generated.
 */
export function createReferenceType(reference: string, context: TypeTransformContext) {
  const segments = parseReferencePointer(reference);

  if (segments.length === 0) {
    throw new Error(`Error parsing $ref: ${reference}. Is this a valid $ref?`);
  }

  const [rootName, ...indexSegments] = segments;

  // Object schemas are generated without their `properties` level, so references into them skip it.
  const indexes = [
    ...indexSegments.slice(0, 2),
    ...indexSegments.slice(2).filter((segment) => segment !== 'properties'),
  ];

  if (rootName !== 'components' || indexes.length === 0) {
    return indexedAccessType(referenceType(rootName), indexes);
  }

  const componentGroupName = normalizeComponentGroupName(indexes[0]);

  if (indexes.length > 1 && isComponentGroupName(componentGroupName)) {
    context.dependencies.components.add(`${componentGroupName}.${indexes[1]}`);
  }

  const componentsType = referenceType(createComponentsIdentifier(context.serviceName));
  return indexedAccessType(componentsType, [componentGroupName, ...indexes.slice(1)]);
}
