import { ValidationError } from '@zimic/utils/validation';
import {
  decodePacket,
  decodePayload,
  type Packet as EngineIOPacket,
  protocol as engineIOProtocol,
} from 'engine.io-parser';
import * as defaultParser from 'socket.io-parser';
import type { Packet } from 'socket.io-parser';

import { isServerSide } from '@/utils/environment';
import { logger } from '@/utils/logging';
import { createPathMatchingURL, removeTrailingSlash } from '@/utils/urls';
import { isWebSocketBinaryMessageData, normalizeBufferSource } from '@/ws/utils/messageData';

import type {
  WebSocketInterceptorProtocolConnection,
  WebSocketInterceptorProtocolConnectionClaim,
  WebSocketInterceptorProtocolContext,
  WebSocketInterceptorProtocolFrame,
  WebSocketInterceptorProtocolOpenedClient,
} from '../interceptor/types/protocol';
import {
  CLOSE_PACKET,
  ENGINE_IO_MESSAGE_PACKET_PREFIX,
  NOOP_PACKET,
  OPEN_PACKET_PREFIX,
  PING_PACKET,
  SOCKET_IO_REJECTION_CLOSE_CODE,
  UNSUPPORTED_LOCAL_TRANSPORT_CLOSE_REASON,
  UPGRADE_PACKET,
  UPGRADE_PROBE_PACKET,
  UPGRADE_PROBE_REPLY_PACKET,
} from './constants';
import DuplicateSocketIONamespaceError from './errors/DuplicateSocketIONamespaceError';
import InvalidSocketIOPollingInterceptorError from './errors/InvalidSocketIOPollingInterceptorError';
import MismatchedSocketIOProtocolOptionsError from './errors/MismatchedSocketIOProtocolOptionsError';
import SocketIOPollingTransport from './SocketIOPollingTransport';
import type SocketIOProtocol from './SocketIOProtocol';
import type { SocketIOMessage } from './types/messages';
import type { SocketIOParser } from './types/options';
import type { SocketIOPollingInterceptor, SocketIOPollingRequest, SocketIOPollingResponse } from './types/polling';

const { PacketType } = defaultParser;

const SUPPORTED_ENGINE_IO_VERSION = String(engineIOProtocol);

const ENGINE_IO_ERRORS = {
  UNKNOWN_SESSION_ID: { code: 1, message: 'Session ID unknown' },
  BAD_HANDSHAKE_METHOD: { code: 2, message: 'Bad handshake method' },
  BAD_REQUEST: { code: 3, message: 'Bad request' },
  FORBIDDEN: { code: 4, message: 'Forbidden' },
  UNSUPPORTED_PROTOCOL_VERSION: { code: 5 },
} as const;

// Clients use this value only to split the polling batches they send. It matches the limit of Socket.IO servers.
const MAX_PAYLOAD_BYTES = 1000000;

// The defaults of Socket.IO servers. Clients adopt them from the open packet.
const PING_INTERVAL = 25000;
const PING_TIMEOUT = 20000;

function ignoreClosedConnectionEvent() {
  return undefined;
}

const CLOSED_CONNECTION_CLAIM: WebSocketInterceptorProtocolConnectionClaim = {
  onFrame: ignoreClosedConnectionEvent,
  onClose: ignoreClosedConnectionEvent,
};

type SocketIONamespaceConnection =
  | {
      state: 'pending';
      releaseController: AbortController;
    }
  | {
      state: 'open';
      releaseController: AbortController;
      client: WebSocketInterceptorProtocolOpenedClient<SocketIOMessage>;
    };

export type SocketIOTransport = Omit<WebSocketInterceptorProtocolConnection, 'url'>;

export type SocketIOEngineInterceptor = WebSocketInterceptorProtocolContext<SocketIOMessage>['interceptor'];

interface SocketIOEngineSession {
  id: string;
  url: string;
  transport: SocketIOTransport;
  upgradingConnection?: WebSocketInterceptorProtocolConnection;
  decoder: InstanceType<SocketIOParser['Decoder']>;
  connections: Map<string, SocketIONamespaceConnection>;
  pingTimer: ReturnType<typeof setInterval>;
}

export interface SocketIOEngineOptions {
  polling: SocketIOPollingInterceptor | undefined;
  parser: SocketIOParser;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- The engine serves namespaces of any schema, decoding events without checking them against it, as decoders of other protocols do.
type AnySocketIOProtocol = SocketIOProtocol<any>;

// Parsers come from user code, and some declare other return types, such as `socket.io-msgpack-parser`.
function encodeSocketIOPacket(
  encoder: InstanceType<SocketIOParser['Encoder']>,
  packet: Packet,
): WebSocketInterceptorProtocolFrame[] {
  const encodedChunks = encoder.encode(packet);

  if (!Array.isArray(encodedChunks)) {
    throw new ValidationError('Socket.IO parsers must encode packets into arrays of chunks.');
  }

  return encodedChunks.map((encodedChunk: unknown) => {
    if (typeof encodedChunk === 'string') {
      return `${ENGINE_IO_MESSAGE_PACKET_PREFIX}${encodedChunk}`;
    }

    if (!isWebSocketBinaryMessageData(encodedChunk) || encodedChunk instanceof Blob) {
      throw new ValidationError('Socket.IO binary attachments sent by interceptors must be ArrayBuffers or views.');
    }

    return normalizeBufferSource(encodedChunk);
  });
}

function reportUnsupportedEngineIOVersion(version: string | null) {
  if (version === SUPPORTED_ENGINE_IO_VERSION) {
    return undefined;
  }

  const message = `Engine.IO protocol version ${version ?? 'unknown'} is not supported. Use version ${SUPPORTED_ENGINE_IO_VERSION}.`;
  logger.warn(message);
  return message;
}

const engines = new Map<string, SocketIOEngine>();

function getSocketIOEngineKey(interceptor: SocketIOEngineInterceptor) {
  return `${interceptor.type}:${interceptor.baseURL}`;
}

class SocketIOEngine {
  private protocols = new Map<string, AnySocketIOProtocol>();
  private sessions = new Map<string, SocketIOEngineSession>();
  private encoder: InstanceType<SocketIOParser['Encoder']>;
  private pollingStart: Promise<void>;

  pendingStop?: Promise<void>;

  constructor(
    private interceptor: SocketIOEngineInterceptor,
    private options: SocketIOEngineOptions,
  ) {
    this.encoder = new options.parser.Encoder();
    this.pollingStart = options.polling ? this.startPolling(options.polling) : Promise.resolve();
  }

  private async startPolling(polling: SocketIOPollingInterceptor) {
    await polling.start();
    await polling.get('/').respond((request) => this.respondToPoll(request));
    await polling.post('/').respond((request) => this.receivePollingPayload(request));
  }

  private async respondToPoll(request: SocketIOPollingRequest): Promise<SocketIOPollingResponse<'GET'>> {
    const sessionId = request.searchParams.get('sid');
    const isHandshake = sessionId === null;

    if (isHandshake) {
      return this.openPollingSession(request);
    }

    const session = this.sessions.get(sessionId);

    // A client may send a poll before the server receives the close packet it sent earlier.
    if (!session) {
      return { status: 200, body: CLOSE_PACKET } as const;
    }

    /* istanbul ignore if -- @preserve
     * Clients pause polling before finishing an upgrade, so only a poll overlapping the upgrade reaches this. */
    if (!(session.transport instanceof SocketIOPollingTransport)) {
      return { status: 200, body: NOOP_PACKET } as const;
    }

    if (session.transport.hasPendingPoll) {
      return { status: 400, body: ENGINE_IO_ERRORS.BAD_REQUEST } as const;
    }

    return { status: 200, body: await session.transport.poll() } as const;
  }

  private openPollingSession(request: SocketIOPollingRequest): SocketIOPollingResponse<'GET'> {
    const unsupportedVersionMessage = reportUnsupportedEngineIOVersion(request.searchParams.get('EIO'));

    if (unsupportedVersionMessage !== undefined) {
      return {
        status: 400,
        body: { code: ENGINE_IO_ERRORS.UNSUPPORTED_PROTOCOL_VERSION.code, message: unsupportedVersionMessage },
      } as const;
    }

    // Sessions opened while the engine stops would outlive it.
    if (this.hasNoNamespaces) {
      return { status: 403, body: ENGINE_IO_ERRORS.FORBIDDEN } as const;
    }

    const session = this.createSession(request.url.replace(/^http/, 'ws'), new SocketIOPollingTransport());
    const upgrades = this.servesWebSocketTransport ? ['websocket'] : [];

    return { status: 200, body: this.createOpenPacket(session.id, upgrades) } as const;
  }

  private receivePollingPayload(request: SocketIOPollingRequest): SocketIOPollingResponse<'POST'> {
    const sessionId = request.searchParams.get('sid');
    const isHandshake = sessionId === null;

    if (isHandshake) {
      return { status: 400, body: ENGINE_IO_ERRORS.BAD_HANDSHAKE_METHOD } as const;
    }

    const session = this.sessions.get(sessionId);

    if (!session) {
      return { status: 400, body: ENGINE_IO_ERRORS.UNKNOWN_SESSION_ID } as const;
    }

    const packets = typeof request.body === 'string' ? decodePayload(request.body, 'arraybuffer') : [];

    for (const packet of packets) {
      if (packet.type === 'close') {
        this.closeSession(session);
      } else {
        this.receivePacket(session, packet);
      }

      if (!this.sessions.has(session.id)) {
        break;
      }
    }

    return { status: 200, body: 'ok' } as const;
  }

  // As a Socket.IO server, the engine closes sessions that send packets it cannot decode.
  private receivePacket(session: SocketIOEngineSession, packet: EngineIOPacket) {
    if (packet.type === 'error') {
      this.closeSession(session);
      return;
    }

    if (packet.type !== 'message') {
      return;
    }

    try {
      session.decoder.add(this.convertChunkForParser(packet.data));
    } catch (error) {
      console.error(error);
      this.closeSession(session);
    }
  }

  // Custom parsers such as socket.io-msgpack-parser expect Node.js buffers, as Socket.IO servers give them. The default
  // parser keeps array buffers for handlers.
  private convertChunkForParser(chunk: unknown) {
    const needsNodeBuffer = this.options.parser !== defaultParser && isServerSide() && chunk instanceof ArrayBuffer;
    return needsNodeBuffer ? Buffer.from(chunk) : chunk;
  }

  private receiveSocketPacket(session: SocketIOEngineSession, packet: Packet) {
    const protocol = this.protocols.get(packet.nsp);

    if (!protocol) {
      if (packet.type === PacketType.CONNECT) {
        this.sendSocketPacket(session, {
          type: PacketType.CONNECT_ERROR,
          nsp: packet.nsp,
          data: { message: 'Invalid namespace' },
        });
      }
      return;
    }

    if (packet.type === PacketType.CONNECT) {
      this.receiveNamespaceConnect(protocol, session);
      return;
    }

    const connection = session.connections.get(packet.nsp);

    if (connection?.state !== 'open') {
      return;
    }

    if (packet.type === PacketType.DISCONNECT) {
      this.releaseNamespace(protocol, session);
    } else if (packet.type === PacketType.EVENT) {
      // Parsers emit binary events as event packets once their attachments arrive.
      protocol.receiveEventPacket(connection.client, packet);
    }
  }

  private sendSocketPacket(session: SocketIOEngineSession, packet: Packet) {
    for (const frame of encodeSocketIOPacket(this.encoder, packet)) {
      session.transport.send(frame);
    }
  }

  private createOpenPacket(sessionId: string, upgrades: string[]) {
    const openData = {
      sid: sessionId,
      upgrades,
      pingInterval: PING_INTERVAL,
      pingTimeout: PING_TIMEOUT,
      maxPayload: MAX_PAYLOAD_BYTES,
    };

    return `${OPEN_PACKET_PREFIX}${JSON.stringify(openData)}`;
  }

  // Unresponsive clients are not detected, so their sessions stay open until their namespaces are cleared or stopped.
  private createSession(url: string, transport: SocketIOTransport) {
    const session: SocketIOEngineSession = {
      id: crypto.randomUUID(),
      url,
      transport,
      decoder: new this.options.parser.Decoder(),
      connections: new Map(),
      pingTimer: setInterval(() => session.transport.send(PING_PACKET), PING_INTERVAL),
    };

    session.decoder.on('decoded', (packet) => this.receiveSocketPacket(session, packet));

    this.sessions.set(session.id, session);
    return session;
  }

  private closeSession(session: SocketIOEngineSession) {
    if (!this.sessions.delete(session.id)) {
      return;
    }

    clearInterval(session.pingTimer);
    session.transport.close();
    session.upgradingConnection?.close();

    const connections = Array.from(session.connections.values());
    session.connections.clear();

    for (const connection of connections) {
      connection.releaseController.abort();
    }
  }

  private get hasNoNamespaces() {
    return this.protocols.size === 0;
  }

  // `socket.io-client` keeps the `WebSocket` constructor found when it loads, which may be before interceptors replace
  // it, so local interceptors serve polling only.
  private get servesWebSocketTransport() {
    return this.interceptor.type === 'remote';
  }

  start(protocol: AnySocketIOProtocol) {
    if (this.protocols.has(protocol.namespace)) {
      throw new DuplicateSocketIONamespaceError(protocol.namespace, this.interceptor.baseURL);
    }

    if (protocol.parser !== this.options.parser) {
      throw new MismatchedSocketIOProtocolOptionsError('parser', this.interceptor.baseURL);
    }

    if (protocol.polling !== this.options.polling) {
      throw new MismatchedSocketIOProtocolOptionsError('polling', this.interceptor.baseURL);
    }

    this.protocols.set(protocol.namespace, protocol);
    return this.pollingStart;
  }

  async stop(protocol: AnySocketIOProtocol) {
    this.clear(protocol);
    this.protocols.delete(protocol.namespace);

    if (!this.hasNoNamespaces) {
      return;
    }

    // No protocol owns sessions that joined no namespace, so the last one to stop closes them.
    for (const session of Array.from(this.sessions.values())) {
      this.closeSession(session);
    }

    this.pendingStop = this.stopPollingAndRemove();
    await this.pendingStop;
  }

  private async stopPollingAndRemove() {
    try {
      await Promise.allSettled([this.pollingStart]);
      await this.options.polling?.stop();
    } finally {
      engines.delete(getSocketIOEngineKey(this.interceptor));
    }
  }

  clear(protocol: AnySocketIOProtocol) {
    for (const session of Array.from(this.sessions.values())) {
      if (!session.connections.has(protocol.namespace)) {
        continue;
      }

      // Custom encoders may throw, which must not keep the clients of other sessions open.
      try {
        this.disconnectNamespace(protocol, session);
      } catch (error) {
        console.error(error);
      }

      if (session.connections.size === 0) {
        this.closeSession(session);
      }
    }
  }

  // As `socket.disconnect()` in a Socket.IO server, which leaves the connection open for other namespaces.
  private disconnectNamespace(protocol: AnySocketIOProtocol, session: SocketIOEngineSession) {
    const isOpen = session.connections.get(protocol.namespace)?.state === 'open';

    // Released first, so an encoder error does not keep the client listed.
    this.releaseNamespace(protocol, session);

    if (isOpen) {
      this.sendSocketPacket(session, { type: PacketType.DISCONNECT, nsp: protocol.namespace });
    }
  }

  private releaseNamespace(protocol: AnySocketIOProtocol, session: SocketIOEngineSession) {
    const connection = session.connections.get(protocol.namespace);
    session.connections.delete(protocol.namespace);

    connection?.releaseController.abort();
  }

  private receiveNamespaceConnect(protocol: AnySocketIOProtocol, session: SocketIOEngineSession) {
    if (session.connections.has(protocol.namespace)) {
      return;
    }

    const releaseController = new AbortController();
    const pendingConnection: SocketIONamespaceConnection = { state: 'pending', releaseController };
    session.connections.set(protocol.namespace, pendingConnection);

    void this.openNamespaceClient(protocol, session, releaseController)
      .catch((error: unknown) => {
        console.error(error);
      })
      .finally(() => {
        if (session.connections.get(protocol.namespace) === pendingConnection) {
          session.connections.delete(protocol.namespace);
        }
      });
  }

  private async openNamespaceClient(
    protocol: AnySocketIOProtocol,
    session: SocketIOEngineSession,
    releaseController: AbortController,
  ) {
    const openClientResult = await protocol.openClient({
      url: session.url,
      signal: releaseController.signal,
      send: (message: SocketIOMessage) => this.sendSocketPacket(session, protocol.createMessagePacket(message)),
      close: () => this.disconnectNamespace(protocol, session),
      onOpen: (client: WebSocketInterceptorProtocolOpenedClient<SocketIOMessage>) => {
        this.acceptNamespaceConnection(protocol, session, { state: 'open', releaseController, client });
      },
    });

    if (openClientResult === 'rejected') {
      this.sendSocketPacket(session, {
        type: PacketType.CONNECT_ERROR,
        nsp: protocol.namespace,
        data: { message: 'Connection rejected' },
      });
    }
  }

  // An accepted client joins the session when its interceptor lists it, before connection effects run.
  private acceptNamespaceConnection(
    protocol: AnySocketIOProtocol,
    session: SocketIOEngineSession,
    connection: Extract<SocketIONamespaceConnection, { state: 'open' }>,
  ) {
    session.connections.set(protocol.namespace, connection);
    this.sendSocketPacket(session, {
      type: PacketType.CONNECT,
      nsp: protocol.namespace,
      data: { sid: crypto.randomUUID() },
    });
  }

  claimConnection(
    connection: WebSocketInterceptorProtocolConnection,
  ): WebSocketInterceptorProtocolConnectionClaim | undefined {
    const { url } = connection;
    const isSocketIOPath =
      removeTrailingSlash(createPathMatchingURL(url)) === removeTrailingSlash(this.interceptor.baseURL);

    if (!isSocketIOPath) {
      return undefined;
    }

    if (!this.servesWebSocketTransport) {
      connection.close(SOCKET_IO_REJECTION_CLOSE_CODE, UNSUPPORTED_LOCAL_TRANSPORT_CLOSE_REASON);
      return CLOSED_CONNECTION_CLAIM;
    }

    const searchParams = new URL(url).searchParams;
    const unsupportedVersionMessage = reportUnsupportedEngineIOVersion(searchParams.get('EIO'));

    if (unsupportedVersionMessage !== undefined) {
      connection.close(SOCKET_IO_REJECTION_CLOSE_CODE, unsupportedVersionMessage);
      return CLOSED_CONNECTION_CLAIM;
    }

    const sessionId = searchParams.get('sid');

    if (sessionId === null) {
      return this.openWebSocketSession(url, connection);
    }

    const session = this.sessions.get(sessionId);
    const pollingTransport = session?.transport;

    if (!session || !(pollingTransport instanceof SocketIOPollingTransport)) {
      connection.close(SOCKET_IO_REJECTION_CLOSE_CODE, ENGINE_IO_ERRORS.UNKNOWN_SESSION_ID.message);
      return CLOSED_CONNECTION_CLAIM;
    }

    return this.upgradePollingSession(session, pollingTransport, connection);
  }

  private upgradePollingSession(
    session: SocketIOEngineSession,
    pollingTransport: SocketIOPollingTransport,
    connection: WebSocketInterceptorProtocolConnection,
  ): WebSocketInterceptorProtocolConnectionClaim {
    session.upgradingConnection = connection;

    return {
      onFrame: (frame) => {
        const isSessionClosed = !this.sessions.has(session.id);

        // A client that paused polling to upgrade receives no close packet, so the upgrading connection closes instead.
        if (isSessionClosed) {
          connection.close();
          return;
        }

        if (frame === UPGRADE_PROBE_PACKET) {
          connection.send(UPGRADE_PROBE_REPLY_PACKET);
          // Completes the pending poll so the client can pause polling and finish the upgrade.
          pollingTransport.send(NOOP_PACKET);
        } else if (frame === UPGRADE_PACKET) {
          if (pollingTransport.hasPendingPoll) {
            pollingTransport.send(NOOP_PACKET);
          }

          session.transport = connection;
          session.upgradingConnection = undefined;
          pollingTransport.drainFrames().forEach((queuedFrame) => connection.send(queuedFrame));
        } else {
          this.receivePacket(session, decodePacket(frame, 'arraybuffer'));
        }
      },

      // A connection closing during its probe is a failed upgrade, after which the client continues polling.
      onClose: () => {
        if (session.transport === connection) {
          this.closeSession(session);
        }
      },
    };
  }

  private openWebSocketSession(url: string, connection: WebSocketInterceptorProtocolConnection) {
    if (this.hasNoNamespaces) {
      connection.close();
      return CLOSED_CONNECTION_CLAIM;
    }

    const session = this.createSession(url, connection);
    connection.send(this.createOpenPacket(session.id, []));

    return {
      onFrame: (frame) => this.receivePacket(session, decodePacket(frame, 'arraybuffer')),
      onClose: () => this.closeSession(session),
    } satisfies WebSocketInterceptorProtocolConnectionClaim;
  }
}

function validatePollingInterceptor(
  interceptor: SocketIOEngineInterceptor,
  polling: SocketIOPollingInterceptor | undefined,
) {
  if (!polling) {
    if (interceptor.type === 'local') {
      throw new InvalidSocketIOPollingInterceptorError(
        'local interceptors require one, because they serve Socket.IO over polling only.',
      );
    }
    return;
  }

  if (polling.type !== interceptor.type) {
    throw new InvalidSocketIOPollingInterceptorError(
      `its type must be '${interceptor.type}', the same as the WebSocket interceptor.`,
    );
  }

  const expectedBaseURL = interceptor.baseURL.replace(/^ws/, 'http');

  if (polling.baseURL !== expectedBaseURL) {
    throw new InvalidSocketIOPollingInterceptorError(
      `its base URL must be ${expectedBaseURL}, the WebSocket base URL with \`http\` instead of \`ws\`.`,
    );
  }

  if (polling.isRunning) {
    throw new InvalidSocketIOPollingInterceptorError(
      'it must not be running, because the protocol starts and stops it.',
    );
  }
}

function getOrCreateSocketIOEngine(interceptor: SocketIOEngineInterceptor, options: SocketIOEngineOptions) {
  const key = getSocketIOEngineKey(interceptor);

  let engine = engines.get(key);

  if (!engine) {
    validatePollingInterceptor(interceptor, options.polling);
    engine = new SocketIOEngine(interceptor, options);
    engines.set(key, engine);
  }

  return engine;
}

export async function startSocketIOEngine(interceptor: SocketIOEngineInterceptor, protocol: AnySocketIOProtocol) {
  const key = getSocketIOEngineKey(interceptor);

  // A stopping engine still owns its polling interceptor, so a new engine is created only after it stops.
  let existingEngine = engines.get(key);

  while (existingEngine?.pendingStop) {
    await Promise.allSettled([existingEngine.pendingStop]);
    existingEngine = engines.get(key);
  }

  // The engine registers the namespace in the same step it is found, so no other namespace can stop it in between.
  const engine = getOrCreateSocketIOEngine(interceptor, { polling: protocol.polling, parser: protocol.parser });
  return { engine, engineStart: engine.start(protocol) };
}

export type { SocketIOEngine };
