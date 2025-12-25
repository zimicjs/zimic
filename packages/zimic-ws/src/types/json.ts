import { JSONStringified as InternalJSONStringified } from '@zimic/utils/types/json';

/**
 * Represents a value stringified by `JSON.stringify`, maintaining a type reference to the original type.
 *
 * This type is used to validate that the expected stringified body is passed in WebSocket messages.
 */
export type JSONStringified<Value> = InternalJSONStringified<Value>;
