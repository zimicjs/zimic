import { HttpSearchParams } from '@zimic/utils/http';
import { waitForDelay } from '@zimic/utils/time';
import { Range } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

import { random } from '@/utils/numbers';

import WebSocketTimesCheckError from '../errors/WebSocketTimesCheckError';
import WebSocketTimesDeclarationPointer from '../errors/WebSocketTimesDeclarationPointer';
import { InterceptedWebSocketInterceptorConnection, WebSocketInterceptorClient } from '../interceptor/types/messages';
import WebSocketInterceptorImplementation from '../interceptor/WebSocketInterceptorImplementation';
import type { WebSocketInterceptorConnectionHandlerIndex } from '../interceptor/WebSocketInterceptorMessageStore';
import DisabledMessageSavingError from '../messageHandler/errors/DisabledMessageSavingError';
import { WebSocketConnectionHandlerDelayFactory } from './types/connections';
import {
  InternalWebSocketConnectionHandler,
  WebSocketConnectionHandlerConnectionCallback,
  WebSocketConnectionHandlerResponseDeclaration,
} from './types/public';
import {
  UnmatchedWebSocketInterceptorConnectionGroup,
  WebSocketConnectionHandlerRestriction,
  WebSocketConnectionHandlerRestrictionDiff,
  WebSocketConnectionHandlerRestrictionDiffs,
  WebSocketConnectionHandlerRestrictionMatch,
  WebSocketConnectionHandlerStaticRestriction,
} from './types/restrictions';

const DEFAULT_NUMBER_OF_CONNECTION_LIMITS: Range<number> = Object.freeze({
  min: 0,
  max: Infinity,
});

export type WebSocketConnectionHandlerConnectionMatch =
  | { success: true }
  | { success: false; cause: 'clearedHandler' | 'exceededNumberOfConnections' }
  | { success: false; cause: 'unmatchedRestrictions'; diff: WebSocketConnectionHandlerRestrictionDiffs };

export type WebSocketConnectionHandlerAction = 'accept' | 'reject';

type StaticRestrictionFieldMatch<Value> =
  { success: true } | { success: false; diff: WebSocketConnectionHandlerRestrictionDiff<Value> };

class WebSocketConnectionHandlerImplementation<Schema extends WebSocketSchema> {
  private restrictions: WebSocketConnectionHandlerRestriction[] = [];

  private limits = {
    numberOfConnections: DEFAULT_NUMBER_OF_CONNECTION_LIMITS,
  };

  private timesPointer?: WebSocketTimesDeclarationPointer;

  private numberOfMatchedConnections = 0;
  private unmatchedConnectionGroups: UnmatchedWebSocketInterceptorConnectionGroup[] = [];
  private savedConnectionIndex: WebSocketInterceptorConnectionHandlerIndex;

  private responseDeclaration?: WebSocketConnectionHandlerResponseDeclaration;

  private createResponseDelay?: WebSocketConnectionHandlerDelayFactory;

  private applyEffect?: WebSocketConnectionHandlerConnectionCallback<Schema>;

  private clearGeneration = {};

  // Handlers match connections without a declared response, so a cleared handler would keep shadowing older handlers.
  // As with a cleared HTTP handler, it stops matching until it is declared again.
  private isCleared = false;

  constructor(
    private interceptor: WebSocketInterceptorImplementation<Schema>,
    readonly path: string | undefined,
    private handler: InternalWebSocketConnectionHandler<Schema>,
  ) {
    this.savedConnectionIndex = this.interceptor.messageStore.createConnectionHandlerIndex();
  }

  with(restriction: WebSocketConnectionHandlerRestriction) {
    this.restrictions.push(restriction);
    this.isCleared = false;
    return this;
  }

  delay(minMilliseconds: number | WebSocketConnectionHandlerDelayFactory, maxMilliseconds?: number): this {
    this.isCleared = false;

    if (minMilliseconds === maxMilliseconds) {
      return this.delay(minMilliseconds);
    }

    if (typeof minMilliseconds === 'number' && typeof maxMilliseconds === 'number') {
      this.createResponseDelay = () => random(minMilliseconds, maxMilliseconds);
      return this;
    }

    if (typeof minMilliseconds === 'number') {
      this.createResponseDelay = () => minMilliseconds;
      return this;
    }

    this.createResponseDelay = minMilliseconds;
    return this;
  }

  effect(callback: WebSocketConnectionHandlerConnectionCallback<Schema>) {
    this.applyEffect = callback;
    this.isCleared = false;
    this.resetMatchedConnections();
    this.interceptor.registerConnectionHandler(this.handler);
    return this;
  }

  respond(declaration: WebSocketConnectionHandlerResponseDeclaration) {
    this.responseDeclaration = declaration;
    this.isCleared = false;
    this.resetMatchedConnections();
    this.interceptor.registerConnectionHandler(this.handler);
    return this;
  }

  times(minNumberOfConnections: number, maxNumberOfConnections?: number) {
    this.limits.numberOfConnections = {
      min: minNumberOfConnections,
      max: maxNumberOfConnections ?? minNumberOfConnections,
    };

    this.timesPointer = new WebSocketTimesDeclarationPointer(minNumberOfConnections, maxNumberOfConnections);
    this.isCleared = false;

    return this;
  }

  checkTimes() {
    const isWithinLimits =
      this.numberOfMatchedConnections >= this.limits.numberOfConnections.min &&
      this.numberOfMatchedConnections <= this.limits.numberOfConnections.max;

    if (!isWithinLimits) {
      throw new WebSocketTimesCheckError({
        subject: 'connection',
        limits: this.limits.numberOfConnections,
        numberOfMatches: this.numberOfMatchedConnections,
        declarationPointer: this.timesPointer,
        unmatchedGroups: this.unmatchedConnectionGroups,
        hasRestrictions: this.restrictions.length > 0,
        messageSaving: this.interceptor.messageSaving,
      });
    }
  }

  clear() {
    this.clearGeneration = {};
    this.isCleared = true;

    this.restrictions.length = 0;

    this.limits = {
      numberOfConnections: DEFAULT_NUMBER_OF_CONNECTION_LIMITS,
    };

    this.timesPointer = undefined;

    this.resetMatchedConnections();

    this.responseDeclaration = undefined;
    this.createResponseDelay = undefined;
    this.applyEffect = undefined;

    return this;
  }

  private resetMatchedConnections() {
    this.numberOfMatchedConnections = 0;
    this.unmatchedConnectionGroups.length = 0;
    this.interceptor.messageStore.clearConnectionHandler(this.savedConnectionIndex);
  }

  async matchesConnection(
    connection: InterceptedWebSocketInterceptorConnection,
  ): Promise<WebSocketConnectionHandlerConnectionMatch> {
    const restrictionsMatch = await this.matchesRestrictions(connection);

    // Checked after the restrictions because the handler may be cleared while they are matched asynchronously.
    if (this.isCleared) {
      return { success: false, cause: 'clearedHandler' };
    }

    if (!restrictionsMatch.success) {
      return { success: false, cause: 'unmatchedRestrictions', diff: restrictionsMatch.diff };
    }

    if (!this.canAcceptMoreConnections()) {
      return { success: false, cause: 'exceededNumberOfConnections' };
    }

    return { success: true };
  }

  // Concurrent connections can reach the limit while this one is matched asynchronously, so the limit is checked again
  // in the same synchronous step that counts the connection.
  reserveConnection(): WebSocketConnectionHandlerConnectionMatch {
    if (!this.canAcceptMoreConnections()) {
      return { success: false, cause: 'exceededNumberOfConnections' };
    }

    this.numberOfMatchedConnections++;
    return { success: true };
  }

  private canAcceptMoreConnections() {
    return this.numberOfMatchedConnections < this.limits.numberOfConnections.max;
  }

  private async matchesRestrictions(
    connection: InterceptedWebSocketInterceptorConnection,
  ): Promise<WebSocketConnectionHandlerRestrictionMatch> {
    for (const restriction of this.restrictions) {
      if (this.isComputedConnectionRestriction(restriction)) {
        const matchesComputedRestriction = await restriction(connection);

        if (!matchesComputedRestriction) {
          return {
            success: false,
            diff: { computed: { expected: true, received: false } },
          };
        }

        continue;
      }

      const matchesSearchParamsRestriction = this.matchesSearchParamsRestriction(connection, restriction);
      const matchesProtocolsRestriction = this.matchesProtocolsRestriction(connection, restriction);

      if (!matchesSearchParamsRestriction.success || !matchesProtocolsRestriction.success) {
        return {
          success: false,
          diff: {
            searchParams: matchesSearchParamsRestriction.success ? undefined : matchesSearchParamsRestriction.diff,
            protocols: matchesProtocolsRestriction.success ? undefined : matchesProtocolsRestriction.diff,
          },
        };
      }
    }

    return { success: true };
  }

  private isComputedConnectionRestriction(restriction: WebSocketConnectionHandlerRestriction) {
    return typeof restriction === 'function';
  }

  private matchesSearchParamsRestriction(
    connection: InterceptedWebSocketInterceptorConnection,
    restriction: WebSocketConnectionHandlerStaticRestriction,
  ): StaticRestrictionFieldMatch<HttpSearchParams> {
    if (restriction.searchParams === undefined) {
      return { success: true };
    }

    const restrictedSearchParams: HttpSearchParams = new HttpSearchParams(restriction.searchParams);
    const searchParams: HttpSearchParams = new HttpSearchParams(new URL(connection.url).searchParams);

    const matchesRestriction = restriction.exact
      ? searchParams.equals(restrictedSearchParams)
      : searchParams.contains(restrictedSearchParams);

    return matchesRestriction
      ? { success: true }
      : { success: false, diff: { expected: restrictedSearchParams, received: searchParams } };
  }

  private matchesProtocolsRestriction(
    connection: InterceptedWebSocketInterceptorConnection,
    restriction: WebSocketConnectionHandlerStaticRestriction,
  ): StaticRestrictionFieldMatch<readonly string[]> {
    if (restriction.protocols === undefined) {
      return { success: true };
    }

    const restrictedProtocols = restriction.protocols;

    // Requested subprotocols are listed in the client's order of preference, so their order is part of an exact match.
    const matchesRestriction = restriction.exact
      ? restrictedProtocols.length === connection.protocols.length &&
        restrictedProtocols.every((protocol, index) => connection.protocols[index] === protocol)
      : restrictedProtocols.every((protocol) => connection.protocols.includes(protocol));

    return matchesRestriction
      ? { success: true }
      : { success: false, diff: { expected: restrictedProtocols, received: connection.protocols } };
  }

  markConnectionAsMatched(_connection: InterceptedWebSocketInterceptorConnection) {
    this.numberOfMatchedConnections++;
  }

  markConnectionAsUnmatched(
    connection: InterceptedWebSocketInterceptorConnection,
    options: { diff: WebSocketConnectionHandlerRestrictionDiffs },
  ) {
    const shouldSaveUnmatchedConnections =
      this.interceptor.messageSaving.enabled && this.restrictions.length > 0 && this.timesPointer !== undefined;

    if (shouldSaveUnmatchedConnections) {
      this.unmatchedConnectionGroups.push({ connection, diff: options.diff });
    }
  }

  // Called in the same synchronous step that reserves the connection, so the captured generation is the one the
  // connection was counted in. Returns the action to apply to the connection, or `null` if it was not handled.
  async applyDeclarations(
    connection: InterceptedWebSocketInterceptorConnection,
  ): Promise<WebSocketConnectionHandlerAction | null> {
    const clearGeneration = this.clearGeneration;

    if (this.createResponseDelay) {
      const delay = await this.createResponseDelay(connection);

      if (delay > 0) {
        await waitForDelay(delay);
      }
    }

    // A connection whose handler was cleared during its delay is not handled, even if the handler was redeclared.
    if (clearGeneration !== this.clearGeneration) {
      return null;
    }

    return this.responseDeclaration?.action ?? 'accept';
  }

  async applyConnectionEffect(client: WebSocketInterceptorClient<Schema>) {
    await this.applyEffect?.(client);
  }

  saveInterceptedConnection(connection: InterceptedWebSocketInterceptorConnection) {
    this.interceptor.messageStore.saveConnection(this.savedConnectionIndex, connection);
  }

  get connections() {
    if (!this.interceptor.messageSaving.enabled) {
      throw new DisabledMessageSavingError();
    }
    return this.savedConnectionIndex.connections;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyWebSocketConnectionHandlerImplementation = WebSocketConnectionHandlerImplementation<any>;

export default WebSocketConnectionHandlerImplementation;
