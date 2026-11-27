import { waitForDelay } from '@zimic/utils/time';
import { Range } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

import { random } from '@/utils/numbers';

import WebSocketTimesCheckError from '../errors/WebSocketTimesCheckError';
import WebSocketTimesDeclarationPointer from '../errors/WebSocketTimesDeclarationPointer';
import { WebSocketInterceptorClient, WebSocketInterceptorConnectionRequest } from '../interceptor/types/messages';
import { AnyWebSocketInterceptorImplementation } from '../interceptor/WebSocketInterceptorImplementation';
import DisabledConnectionSavingError from './errors/DisabledConnectionSavingError';
import {
  LooseWebSocketConnectionStaticRestriction,
  matchWebSocketConnectionStaticRestriction,
  WebSocketConnectionHandshake,
} from './staticRestrictions';
import { WebSocketConnectionHandlerDelayFactory } from './types/connections';
import {
  InternalWebSocketConnectionHandler,
  WebSocketConnectionHandlerConnectionCallback,
  WebSocketConnectionHandlerResponseComputedDeclaration,
  WebSocketConnectionHandlerResponseDeclaration,
} from './types/public';
import {
  UnmatchedWebSocketInterceptorConnectionGroup,
  WebSocketConnectionHandlerRestriction,
  WebSocketConnectionHandlerRestrictionDiffs,
  WebSocketConnectionHandlerRestrictionMatch,
} from './types/restrictions';

const DEFAULT_NUMBER_OF_CONNECTION_LIMITS: Range<number> = Object.freeze({
  min: 0,
  max: Infinity,
});

export type WebSocketConnectionHandlerConnectionMatch =
  | { success: true }
  | { success: false; cause: 'clearedHandler' | 'exceededNumberOfConnections' }
  | { success: false; cause: 'unmatchedRestrictions'; diff: WebSocketConnectionHandlerRestrictionDiffs };

// The error of a rejection comes from user code that may bypass the schema types, so protocols validate it.
export type WebSocketConnectionHandlerDecision = { action: 'accept' } | { action: 'reject'; error?: unknown };

class WebSocketConnectionHandlerImplementation<Schema extends WebSocketSchema, Path extends string = string> {
  private restrictions: WebSocketConnectionHandlerRestriction<Schema, Path>[] = [];

  private limits = {
    numberOfConnections: DEFAULT_NUMBER_OF_CONNECTION_LIMITS,
  };

  private timesPointer?: WebSocketTimesDeclarationPointer;

  private numberOfMatchedConnections = 0;
  private unmatchedConnectionGroups: UnmatchedWebSocketInterceptorConnectionGroup[] = [];
  private savedConnections: WebSocketInterceptorConnectionRequest<Schema, Path>[] = [];

  private createResponseDeclaration?: WebSocketConnectionHandlerResponseComputedDeclaration<Schema, Path>;

  private createResponseDelay?: WebSocketConnectionHandlerDelayFactory<Schema, Path>;

  private applyEffect?: WebSocketConnectionHandlerConnectionCallback<Schema, Path>;

  #clearGeneration = {};

  // Handlers match connections without a declared response, so a cleared handler would keep shadowing older handlers.
  // As with a cleared HTTP handler, it stops matching until it is declared again.
  private isCleared = false;

  constructor(
    private interceptor: AnyWebSocketInterceptorImplementation,
    readonly path: Path | undefined,
    private handler: InternalWebSocketConnectionHandler<Schema, Path>,
  ) {}

  with(restriction: WebSocketConnectionHandlerRestriction<Schema, Path>) {
    this.restrictions.push(restriction);
    this.isCleared = false;
    return this;
  }

  delay(
    minMilliseconds: number | WebSocketConnectionHandlerDelayFactory<Schema, Path>,
    maxMilliseconds?: number,
  ): this {
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

  effect(callback: WebSocketConnectionHandlerConnectionCallback<Schema, Path>) {
    this.applyEffect = callback;
    this.isCleared = false;
    this.resetMatchedConnections();
    this.interceptor.registerConnectionHandler(this.handler);
    return this;
  }

  respond(declaration: WebSocketConnectionHandlerResponseDeclaration<Schema, Path>) {
    this.createResponseDeclaration = this.isResponseDeclarationFactory(declaration) ? declaration : () => declaration;
    this.isCleared = false;
    this.resetMatchedConnections();
    this.interceptor.registerConnectionHandler(this.handler);
    return this;
  }

  private isResponseDeclarationFactory(declaration: WebSocketConnectionHandlerResponseDeclaration<Schema, Path>) {
    return typeof declaration === 'function';
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
        connectionSaving: this.interceptor.connectionSaving,
      });
    }
  }

  get clearGeneration() {
    return this.#clearGeneration;
  }

  clear() {
    this.#clearGeneration = {};
    this.isCleared = true;

    this.restrictions.length = 0;

    this.limits = {
      numberOfConnections: DEFAULT_NUMBER_OF_CONNECTION_LIMITS,
    };

    this.timesPointer = undefined;

    this.resetMatchedConnections();

    this.createResponseDeclaration = undefined;
    this.createResponseDelay = undefined;
    this.applyEffect = undefined;

    return this;
  }

  private resetMatchedConnections() {
    this.numberOfMatchedConnections = 0;
    this.unmatchedConnectionGroups.length = 0;
    this.clearInterceptedConnections();
  }

  async matchesConnection(
    request: WebSocketInterceptorConnectionRequest<Schema, Path>,
  ): Promise<WebSocketConnectionHandlerConnectionMatch> {
    const clearGeneration = this.#clearGeneration;

    const restrictionsMatch = await this.matchesRestrictions(request);

    // Checked after the restrictions because the handler may be cleared while they are matched asynchronously, even if
    // it is redeclared afterward.
    if (this.isCleared || clearGeneration !== this.#clearGeneration) {
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
    request: WebSocketInterceptorConnectionRequest<Schema, Path>,
  ): Promise<WebSocketConnectionHandlerRestrictionMatch> {
    for (const restriction of this.restrictions) {
      if (this.isComputedConnectionRestriction(restriction)) {
        const matchesComputedRestriction = await restriction(request);

        if (!matchesComputedRestriction) {
          return {
            success: false,
            diff: { computed: { expected: true, received: false } },
          };
        }

        continue;
      }

      // Static restrictions compare runtime values, so the schema that typed them does not apply here.
      const staticRestrictionMatch = matchWebSocketConnectionStaticRestriction(
        request as WebSocketConnectionHandshake,
        restriction as LooseWebSocketConnectionStaticRestriction,
      );

      if (!staticRestrictionMatch.success) {
        return staticRestrictionMatch;
      }
    }

    return { success: true };
  }

  private isComputedConnectionRestriction(restriction: WebSocketConnectionHandlerRestriction<Schema, Path>) {
    return typeof restriction === 'function';
  }

  markConnectionAsMatched() {
    this.numberOfMatchedConnections++;
  }

  markConnectionAsUnmatched(
    request: WebSocketInterceptorConnectionRequest<Schema, Path>,
    options: { diff: WebSocketConnectionHandlerRestrictionDiffs },
  ) {
    const shouldSaveUnmatchedConnections =
      this.interceptor.connectionSaving.enabled && this.restrictions.length > 0 && this.timesPointer !== undefined;

    if (shouldSaveUnmatchedConnections) {
      this.unmatchedConnectionGroups.push({ request, diff: options.diff });
    }
  }

  // Called in the same synchronous step that reserves the connection, so the captured generation is the one the
  // connection was counted in. Returns the decision to apply to the connection, or `null` if it was not handled.
  async applyDeclarations(
    request: WebSocketInterceptorConnectionRequest<Schema, Path>,
  ): Promise<WebSocketConnectionHandlerDecision | null> {
    const clearGeneration = this.#clearGeneration;

    if (this.createResponseDelay) {
      const delay = await this.createResponseDelay(request);

      if (delay > 0) {
        await waitForDelay(delay);
      }
    }

    // A connection whose handler was cleared during its delay is not handled, even if the handler was redeclared.
    if (clearGeneration !== this.#clearGeneration) {
      return null;
    }

    // The interceptor checks the clear generation again after the response is computed.
    const responseDeclaration = await this.createResponseDeclaration?.(request);

    if (responseDeclaration?.action !== 'reject') {
      return { action: 'accept' };
    }

    return { action: 'reject', error: 'error' in responseDeclaration ? responseDeclaration.error : undefined };
  }

  async applyConnectionEffect(
    client: WebSocketInterceptorClient<Schema, Path>,
    request: WebSocketInterceptorConnectionRequest<Schema, Path>,
  ) {
    await this.applyEffect?.(client, request);
  }

  saveInterceptedConnection(request: WebSocketInterceptorConnectionRequest<Schema, Path>) {
    this.savedConnections.push(request);
    this.interceptor.incrementNumberOfSavedConnections(1);
  }

  private clearInterceptedConnections() {
    this.interceptor.incrementNumberOfSavedConnections(-this.savedConnections.length);
    this.savedConnections.length = 0;
  }

  get connections() {
    if (!this.interceptor.connectionSaving.enabled) {
      throw new DisabledConnectionSavingError();
    }
    return this.savedConnections;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyWebSocketConnectionHandlerImplementation = WebSocketConnectionHandlerImplementation<any>;

export default WebSocketConnectionHandlerImplementation;
