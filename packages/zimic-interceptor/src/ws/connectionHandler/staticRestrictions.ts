import { jsonContains, jsonEquals } from '@zimic/utils/data';
import { HttpSearchParams } from '@zimic/utils/http';
import { JSONValue } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

import {
  BaseWebSocketConnectionHandlerStaticRestriction,
  WebSocketConnectionHandlerRestrictionDiff,
  WebSocketConnectionStaticRestrictionDiffs,
} from './types/restrictions';

/** The handshake of a connection, as compared by static connection restrictions. */
export interface WebSocketConnectionHandshake {
  searchParams: HttpSearchParams;
  protocols: readonly string[];
  auth?: JSONValue.Loose;
}

/** A static connection restriction of any schema, as compared at runtime. */
export type LooseWebSocketConnectionStaticRestriction = BaseWebSocketConnectionHandlerStaticRestriction<
  WebSocketSchema,
  string
> & { auth?: JSONValue.Loose };

export type WebSocketConnectionStaticRestrictionMatch =
  { success: true } | { success: false; diff: WebSocketConnectionStaticRestrictionDiffs };

type StaticRestrictionFieldMatch<Value> =
  { success: true } | { success: false; diff: WebSocketConnectionHandlerRestrictionDiff<Value> };

function matchSearchParamsRestriction(
  handshake: WebSocketConnectionHandshake,
  restriction: LooseWebSocketConnectionStaticRestriction,
): StaticRestrictionFieldMatch<HttpSearchParams> {
  if (restriction.searchParams === undefined) {
    return { success: true };
  }

  const restrictedSearchParams = new HttpSearchParams(restriction.searchParams);

  const matchesRestriction = restriction.exact
    ? handshake.searchParams.equals(restrictedSearchParams)
    : handshake.searchParams.contains(restrictedSearchParams);

  return matchesRestriction
    ? { success: true }
    : { success: false, diff: { expected: restrictedSearchParams, received: handshake.searchParams } };
}

function matchProtocolsRestriction(
  handshake: WebSocketConnectionHandshake,
  restriction: LooseWebSocketConnectionStaticRestriction,
): StaticRestrictionFieldMatch<readonly string[]> {
  if (restriction.protocols === undefined) {
    return { success: true };
  }

  const restrictedProtocols = restriction.protocols;

  // Requested subprotocols are listed in the client's order of preference, so their order is part of an exact match.
  const matchesRestriction = restriction.exact
    ? restrictedProtocols.length === handshake.protocols.length &&
      restrictedProtocols.every((protocol, index) => handshake.protocols[index] === protocol)
    : restrictedProtocols.every((protocol) => handshake.protocols.includes(protocol));

  return matchesRestriction
    ? { success: true }
    : { success: false, diff: { expected: restrictedProtocols, received: handshake.protocols } };
}

function matchAuthRestriction(
  handshake: WebSocketConnectionHandshake,
  restriction: LooseWebSocketConnectionStaticRestriction,
): StaticRestrictionFieldMatch<unknown> {
  if (restriction.auth === undefined) {
    return { success: true };
  }

  const matchesRestriction = restriction.exact
    ? jsonEquals(handshake.auth, restriction.auth)
    : jsonContains(handshake.auth, restriction.auth);

  return matchesRestriction
    ? { success: true }
    : { success: false, diff: { expected: restriction.auth, received: handshake.auth } };
}

/**
 * Matches the handshake of a connection against a static connection restriction. Each declared field must be met, and
 * `exact` applies to all of them.
 */
export function matchWebSocketConnectionStaticRestriction(
  handshake: WebSocketConnectionHandshake,
  restriction: LooseWebSocketConnectionStaticRestriction,
): WebSocketConnectionStaticRestrictionMatch {
  const searchParamsMatch = matchSearchParamsRestriction(handshake, restriction);
  const protocolsMatch = matchProtocolsRestriction(handshake, restriction);
  const authMatch = matchAuthRestriction(handshake, restriction);

  if (searchParamsMatch.success && protocolsMatch.success && authMatch.success) {
    return { success: true };
  }

  return {
    success: false,
    diff: {
      searchParams: searchParamsMatch.success ? undefined : searchParamsMatch.diff,
      protocols: protocolsMatch.success ? undefined : protocolsMatch.diff,
      auth: authMatch.success ? undefined : authMatch.diff,
    },
  };
}
