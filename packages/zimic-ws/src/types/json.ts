import { JSONStringified as InternalJSONStringified } from '@zimic/utils/types';

/**
 * Represents a value stringified by `JSON.stringify`, keeping a reference to the type of the original value.
 *
 * @see {@link https://zimic.dev/docs/ws/api/websocket-schema#jsonstringified `JSONStringified` API reference}
 */
export type JSONStringified<Value> = InternalJSONStringified<Value>;
