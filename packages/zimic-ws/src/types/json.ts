import { JSONStringified as InternalJSONStringified } from '@zimic/utils/types';

/**
 * Represents a value stringified by `JSON.stringify`, maintaining a type reference to the original type.
 *
 * Use it in a WebSocket schema to require messages, or parts of string messages, to be created with `JSON.stringify`
 * from a value of the expected structure.
 */
export type JSONStringified<Value> = InternalJSONStringified<Value>;
