import { Branded } from '@zimic/utils/types';

export type WebSocketSchema<Schema> = Branded<Schema, 'WebSocketSchema'>;
