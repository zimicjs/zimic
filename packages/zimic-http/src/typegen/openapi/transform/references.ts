import { parseReferencePointer, resolveReference } from '../document/references';
import { OpenAPISchema } from '../document/types';
import { indexedAccessType, NEVER_TYPE, referenceType } from '../utils/types';
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
 * Object schemas are generated without their `properties` level, so references into them skip it. The segment after a
 * `properties` keyword is a property name, even if the property is also named `properties`.
 */
function removePropertiesKeywords(componentSegments: string[]) {
  const componentIndexes: string[] = [];

  for (let index = 0; index < componentSegments.length; index++) {
    const isPropertiesKeyword = componentSegments[index] === 'properties' && index < componentSegments.length - 1;

    if (isPropertiesKeyword) {
      index++;
    }

    componentIndexes.push(componentSegments[index]);
  }

  return componentIndexes;
}

/**
 * Creates the type of a reference to a component, such as `#/components/schemas/User`, as an indexed access to the
 * generated components. The component is recorded as a dependency of the type being generated.
 */
export function createReferenceType(reference: string, context: TypeTransformContext) {
  const segments = parseReferencePointer(reference);
  const [rootName, rawComponentGroupName, componentName, ...componentSegments] = segments;
  const componentGroupName = normalizeComponentGroupName(rawComponentGroupName);

  // Other locations have no generated type to reference.
  const isComponentReference =
    segments.length >= 3 && rootName === 'components' && isComponentGroupName(componentGroupName);

  if (!isComponentReference) {
    throw new Error(`Unsupported $ref: ${reference}. Only references to #/components are supported.`);
  }

  // A `false` schema generates no component to reference.
  if (resolveReference<OpenAPISchema>(context.document, reference) === false) {
    return NEVER_TYPE;
  }

  context.dependencies.components.add(`${componentGroupName}.${componentName}`);

  const componentIndexes = removePropertiesKeywords(componentSegments);

  const componentsType = referenceType(createComponentsIdentifier(context.serviceName));
  return indexedAccessType(componentsType, [componentGroupName, componentName, ...componentIndexes]);
}
