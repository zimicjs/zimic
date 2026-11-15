import type { HttpSchema } from '@zimic/http';
// Imported through the package name so that bundling keeps the HTTP code in its own entry point. Sharing it in a chunk
// breaks prebundlers that cannot resolve the dependencies of the chunk, such as Vite with strict node_modules.
import { createHttpInterceptor, type LocalHttpInterceptor, type RemoteHttpInterceptor } from '@zimic/interceptor/http';
import { ValidationError } from '@zimic/utils/validation';
import { decodePacket, protocol as engineIOProtocol } from 'engine.io-parser';
import * as defaultParser from 'socket.io-parser';

import { convertArrayBufferToBase64 } from '@/utils/data';
import { isServerSide } from '@/utils/environment';
import { logger } from '@/utils/logging';
import { isWebSocketBinaryMessageData, normalizeBufferSource } from '@/ws/utils/messageData';

import type {
  WebSocketInterceptorProtocolConnectionClaim,
  WebSocketInterceptorProtocolFrame,
  WebSocketInterceptorProtocolRawConnection,
} from '../interceptor/types/protocol';
import type { InternalWebSocketInterceptorClient } from '../interceptor/WebSocketInterceptorHandle';
import type { AnyWebSocketInterceptorImplementation } from '../interceptor/WebSocketInterceptorImplementation';
import { UNKNOWN_SESSION_CLOSE_CODE, UNSUPPORTED_VERSION_CLOSE_CODE } from './constants';
import type { SocketIOProtocol } from './createSocketIOProtocol';
import DuplicateSocketIONamespaceError from './errors/DuplicateSocketIONamespaceError';
import MismatchedSocketIOProtocolOptionsError from './errors/MismatchedSocketIOProtocolOptionsError';
import type { SocketIOMessage, SocketIOPacket, SocketIOParser } from './types';

const { PacketType } = defaultParser;

const SUPPORTED_ENGINE_IO_VERSION = String(engineIOProtocol);

// The errors of Engine.IO servers, which clients receive in polling responses and close reasons.
const ENGINE_IO_ERRORS = {
  UNKNOWN_SESSION_ID: { code: 1, message: 'Session ID unknown' },
  BAD_REQUEST: { code: 3, message: 'Bad request' },
  FORBIDDEN: { code: 4, message: 'Forbidden' },
  UNSUPPORTED_PROTOCOL_VERSION: { code: 5 },
} as const;

const INVALID_NAMESPACE_MESSAGE = 'Invalid namespace';

// Connection handlers reject without an error, so this message names the rejection in the client's `connect_error`.
const REJECTED_NAMESPACE_CONNECTION_MESSAGE = 'Connection rejected';

// Clients use this value only to split the polling batches they send. It matches the limit of Socket.IO servers.
const MAX_PAYLOAD_BYTES = 1000000;

// The defaults of Socket.IO servers. Clients adopt them from the open packet.
const PING_INTERVAL = 25000;
const PING_TIMEOUT = 20000;

const POLLING_PACKET_SEPARATOR = '\x1e';

const OPEN_PACKET_PREFIX = '0';
const CLOSE_PACKET = '1';
const PING_PACKET = '2';
const ENGINE_IO_MESSAGE_PACKET_PREFIX = '4';
const NOOP_PACKET = '6';
const UPGRADE_PROBE_PACKET = '2probe';
const UPGRADE_PROBE_REPLY_PACKET = '3probe';
const UPGRADE_PACKET = '5';

function ignoreConnectionEvent() {
  return undefined;
}

const IGNORED_CONNECTION_CLAIM: WebSocketInterceptorProtocolConnectionClaim = {
  onFrame: ignoreConnectionEvent,
  onClose: ignoreConnectionEvent,
};

interface SocketIOPollingErrorBody {
  code: number;
  message: string;
}

type SocketIOPollingHttpSchema = HttpSchema<{
  '/': {
    GET: {
      request: { searchParams: { EIO?: string; transport?: string; sid?: string } };
      response: {
        200: { body: string };
        400: { body: SocketIOPollingErrorBody };
        403: { body: SocketIOPollingErrorBody };
      };
    };
    POST: {
      request: { searchParams: { EIO?: string; transport?: string; sid?: string }; body?: string };
      response: { 200: { body: string }; 400: { body: SocketIOPollingErrorBody } };
    };
  };
}>;

class SocketIOPollingTransport implements WebSocketInterceptorProtocolRawConnection {
  private queuedFrames: WebSocketInterceptorProtocolFrame[] = [];
  private resolvePendingPoll?: (body: string) => void;

  get hasPendingPoll() {
    return this.resolvePendingPoll !== undefined;
  }

  private drainBody() {
    return this.drainFrames()
      .map((frame) => (typeof frame === 'string' ? frame : `b${convertArrayBufferToBase64(frame)}`))
      .join(POLLING_PACKET_SEPARATOR);
  }

  send(frame: WebSocketInterceptorProtocolFrame) {
    this.queuedFrames.push(frame);

    if (this.resolvePendingPoll) {
      this.resolvePendingPoll(this.drainBody());
      this.resolvePendingPoll = undefined;
    }
  }

  // The close packet completes the pending poll and stops the client from polling again.
  close() {
    this.send(CLOSE_PACKET);
  }

  // Long-poll requests stay open until a packet is sent to the session, as a Socket.IO server does.
  poll() {
    if (this.queuedFrames.length > 0) {
      return Promise.resolve(this.drainBody());
    }

    return new Promise<string>((resolve) => {
      this.resolvePendingPoll = resolve;
    });
  }

  drainFrames() {
    const frames = this.queuedFrames;
    this.queuedFrames = [];
    return frames;
  }
}

type SocketIONamespaceConnection =
  { state: 'pending'; abort: () => void } | { state: 'open'; client: InternalWebSocketInterceptorClient };

/** An Engine.IO connection, which carries the namespaces its client joined. */
interface SocketIOEngineSession {
  id: string;
  url: string;
  transport: WebSocketInterceptorProtocolRawConnection;
  decoder: InstanceType<SocketIOParser['Decoder']>;
  connections: Map<string, SocketIONamespaceConnection>;
  pingTimer: ReturnType<typeof setInterval>;
}

export interface SocketIOEngineOptions {
  polling: boolean;
  parser: SocketIOParser;
}

type AnySocketIOProtocol = SocketIOProtocol<SocketIOMessage>;

export function encodeSocketIOPacket(
  encoder: InstanceType<SocketIOParser['Encoder']>,
  packet: SocketIOPacket,
): WebSocketInterceptorProtocolFrame[] {
  return encoder.encode(packet).map((encodedChunk) => {
    if (typeof encodedChunk === 'string') {
      return `${ENGINE_IO_MESSAGE_PACKET_PREFIX}${encodedChunk}`;
    }

    if (!isWebSocketBinaryMessageData(encodedChunk) || encodedChunk instanceof Blob) {
      throw new ValidationError('Socket.IO binary attachments sent by interceptors must be ArrayBuffers or views.');
    }

    return normalizeBufferSource(encodedChunk);
  });
}

function warnOfUnsupportedEngineIOVersion(version: string | null) {
  if (version === SUPPORTED_ENGINE_IO_VERSION) {
    return undefined;
  }

  const message = `Engine.IO protocol version ${version ?? 'unknown'} is not supported. Use version ${SUPPORTED_ENGINE_IO_VERSION}.`;
  logger.warn(message);
  return message;
}

/**
 * The Engine.IO server of a base URL, shared by the interceptors of its namespaces because Socket.IO multiplexes them
 * over one connection.
 */
class SocketIOEngine {
  private protocols = new Map<string, AnySocketIOProtocol>();
  private sessions = new Map<string, SocketIOEngineSession>();
  private encoder: InstanceType<SocketIOParser['Encoder']>;
  private httpInterceptor:
    LocalHttpInterceptor<SocketIOPollingHttpSchema> | RemoteHttpInterceptor<SocketIOPollingHttpSchema>;
  private httpInterceptorStart: Promise<void>;
  private baseURL: string;

  constructor(
    interceptor: AnyWebSocketInterceptorImplementation,
    private options: SocketIOEngineOptions,
  ) {
    this.baseURL = interceptor.baseURLAsString;
    this.encoder = new options.parser.Encoder();

    // Scoped to the Socket.IO path, because HTTP interceptors decide the unhandled requests under their base URL.
    const pollingBaseURL = `${this.baseURL.replace(/^ws/, 'http').replace(/\/$/, '')}/socket.io`;

    this.httpInterceptor =
      interceptor.type === 'local'
        ? createHttpInterceptor<SocketIOPollingHttpSchema>({
            type: 'local',
            baseURL: pollingBaseURL,
            requestSaving: { enabled: false },
          })
        : createHttpInterceptor<SocketIOPollingHttpSchema>({
            type: 'remote',
            baseURL: pollingBaseURL,
            auth: interceptor.auth,
            requestSaving: { enabled: false },
          });

    this.httpInterceptorStart = this.startHttpInterceptor();
  }

  private async startHttpInterceptor() {
    await this.httpInterceptor.start();

    if (this.options.polling) {
      await this.httpInterceptor.get('/').respond((request) => this.respondToPoll(request));
      await this.httpInterceptor.post('/').respond((request) => this.receivePollingPayload(request));
    } else {
      await this.httpInterceptor
        .get('/')
        .with({ searchParams: { transport: 'polling' } })
        .respond(() => this.rejectDisabledPolling());
      await this.httpInterceptor
        .post('/')
        .with({ searchParams: { transport: 'polling' } })
        .respond(() => this.rejectDisabledPolling());
    }
  }

  private rejectDisabledPolling() {
    logger.warn(
      'Socket.IO polling is disabled for this interceptor. Enable `polling` in `createSocketIOProtocol` or set',
      "`transports: ['websocket']` in the client.",
    );

    return { status: 400, body: { code: 0, message: 'Transport unknown' } } as const;
  }

  private async respondToPoll(request: { url: string; searchParams: { get: (name: 'sid' | 'EIO') => string | null } }) {
    const sessionId = request.searchParams.get('sid');

    if (sessionId === null) {
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

  private openPollingSession(request: { url: string; searchParams: { get: (name: 'sid' | 'EIO') => string | null } }) {
    const unsupportedVersionMessage = warnOfUnsupportedEngineIOVersion(request.searchParams.get('EIO'));

    if (unsupportedVersionMessage !== undefined) {
      const { code } = ENGINE_IO_ERRORS.UNSUPPORTED_PROTOCOL_VERSION;
      return { status: 400, body: { code, message: unsupportedVersionMessage } } as const;
    }

    if (this.isStopping) {
      return { status: 403, body: ENGINE_IO_ERRORS.FORBIDDEN } as const;
    }

    const session = this.createSession(request.url.replace(/^http/, 'ws'), new SocketIOPollingTransport());
    return { status: 200, body: this.createOpenPacket(session.id, ['websocket']) } as const;
  }

  private receivePollingPayload(request: {
    body: string | null;
    searchParams: { get: (name: 'sid') => string | null };
  }) {
    const sessionId = request.searchParams.get('sid');
    const session = sessionId === null ? undefined : this.sessions.get(sessionId);
    const packets = typeof request.body === 'string' ? request.body.split(POLLING_PACKET_SEPARATOR) : [];

    if (session) {
      for (const packet of packets) {
        if (packet === CLOSE_PACKET) {
          this.closeSession(session);
          break;
        }

        this.receiveFrame(session, packet);
      }
    }

    return { status: 200, body: 'ok' } as const;
  }

  private receiveFrame(session: SocketIOEngineSession, frame: WebSocketInterceptorProtocolFrame) {
    try {
      const packet = decodePacket(frame, 'arraybuffer');

      if (packet.type === 'message') {
        session.decoder.add(this.convertChunkForParser(packet.data));
      }
    } catch (error) {
      console.error(error);
    }
  }

  // On Node.js, custom parsers such as `socket.io-msgpack-parser` read binary chunks as buffers, as a Socket.IO server
  // gives them. The default parser keeps array buffers, which is how handlers receive binary attachments.
  private convertChunkForParser(chunk: unknown) {
    const needsNodeBuffer = this.options.parser !== defaultParser && isServerSide() && chunk instanceof ArrayBuffer;
    return needsNodeBuffer ? Buffer.from(chunk) : chunk;
  }

  private receiveSocketPacket(session: SocketIOEngineSession, packet: SocketIOPacket) {
    const protocol = this.protocols.get(packet.nsp);

    if (!protocol) {
      if (packet.type === PacketType.CONNECT) {
        this.sendSocketPacket(session, {
          type: PacketType.CONNECT_ERROR,
          nsp: packet.nsp,
          data: { message: INVALID_NAMESPACE_MESSAGE },
        });
      }
      return;
    }

    if (packet.type === PacketType.CONNECT) {
      this.connectNamespace(protocol, session);
      return;
    }

    const connection = session.connections.get(packet.nsp);

    if (connection?.state !== 'open') {
      return;
    }

    if (packet.type === PacketType.DISCONNECT) {
      this.releaseNamespace(protocol, session);
    } else if (packet.type === PacketType.EVENT || packet.type === PacketType.BINARY_EVENT) {
      protocol.receiveEventPacket(connection.client, packet);
    }
  }

  private sendSocketPacket(session: SocketIOEngineSession, packet: SocketIOPacket) {
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
  private createSession(url: string, transport: WebSocketInterceptorProtocolRawConnection) {
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

    for (const protocol of this.protocols.values()) {
      this.releaseNamespace(protocol, session);
    }
  }

  // Sessions opened while the engine stops would outlive it, because nothing closes them.
  get isStopping() {
    return this.protocols.size === 0;
  }

  start(protocol: AnySocketIOProtocol) {
    if (this.protocols.has(protocol.namespace)) {
      throw new DuplicateSocketIONamespaceError(protocol.namespace, this.baseURL);
    }

    if (protocol.parser !== this.options.parser) {
      throw new MismatchedSocketIOProtocolOptionsError('parser', this.baseURL);
    }

    this.protocols.set(protocol.namespace, protocol);
    return this.httpInterceptorStart;
  }

  async stop(protocol: AnySocketIOProtocol) {
    this.clear(protocol);
    this.protocols.delete(protocol.namespace);

    if (!this.isStopping) {
      return;
    }

    // Sessions that joined no namespace are left only to the last protocol.
    for (const session of Array.from(this.sessions.values())) {
      this.closeSession(session);
    }

    await Promise.allSettled([this.httpInterceptorStart]);
    await this.httpInterceptor.stop();
  }

  // A session stays open until the last namespace using it lets it go.
  clear(protocol: AnySocketIOProtocol) {
    for (const session of Array.from(this.sessions.values())) {
      if (!session.connections.has(protocol.namespace)) {
        continue;
      }

      this.disconnectNamespace(protocol, session);

      if (session.connections.size === 0) {
        this.closeSession(session);
      }
    }
  }

  // As `socket.disconnect()` in a Socket.IO server, which leaves the connection open for other namespaces.
  private disconnectNamespace(protocol: AnySocketIOProtocol, session: SocketIOEngineSession) {
    if (session.connections.get(protocol.namespace)?.state === 'open') {
      this.sendSocketPacket(session, { type: PacketType.DISCONNECT, nsp: protocol.namespace });
    }

    this.releaseNamespace(protocol, session);
  }

  private releaseNamespace(protocol: AnySocketIOProtocol, session: SocketIOEngineSession) {
    const connection = session.connections.get(protocol.namespace);
    session.connections.delete(protocol.namespace);

    if (connection?.state === 'pending') {
      connection.abort();
    } else if (connection?.state === 'open') {
      protocol.interceptor.removeClient(connection.client);
    }
  }

  private connectNamespace(protocol: AnySocketIOProtocol, session: SocketIOEngineSession) {
    if (session.connections.has(protocol.namespace)) {
      return;
    }

    const abortController = new AbortController();
    const pendingConnection: SocketIONamespaceConnection = { state: 'pending', abort: () => abortController.abort() };
    session.connections.set(protocol.namespace, pendingConnection);

    void this.openNamespaceClient(protocol, session, abortController.signal)
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
    signal: AbortSignal,
  ) {
    const opening = await protocol.interceptor.openProtocolClient({
      url: session.url,
      signal,
      sendFrame: (frame) => session.transport.send(frame),
      close: () => this.disconnectNamespace(protocol, session),
      onOpen: (client) => this.joinNamespace(protocol, session, client),
    });

    if (opening.action === 'reject') {
      this.sendSocketPacket(session, {
        type: PacketType.CONNECT_ERROR,
        nsp: protocol.namespace,
        data: { message: REJECTED_NAMESPACE_CONNECTION_MESSAGE },
      });
    }
  }

  // An accepted client joins the session when its interceptor lists it, before connection effects run.
  private joinNamespace(
    protocol: AnySocketIOProtocol,
    session: SocketIOEngineSession,
    client: InternalWebSocketInterceptorClient,
  ) {
    session.connections.set(protocol.namespace, { state: 'open', client });
    this.sendSocketPacket(session, {
      type: PacketType.CONNECT,
      nsp: protocol.namespace,
      data: { sid: crypto.randomUUID() },
    });
  }

  // A polling client upgrades by opening a WebSocket connection with its session ID, which carries the existing session.
  claimConnection(
    url: string,
    connection: WebSocketInterceptorProtocolRawConnection,
  ): WebSocketInterceptorProtocolConnectionClaim {
    const searchParams = new URL(url).searchParams;
    const unsupportedVersionMessage = warnOfUnsupportedEngineIOVersion(searchParams.get('EIO'));

    if (unsupportedVersionMessage !== undefined) {
      connection.close(UNSUPPORTED_VERSION_CLOSE_CODE, unsupportedVersionMessage);
      return IGNORED_CONNECTION_CLAIM;
    }

    const sessionId = searchParams.get('sid');

    if (sessionId === null) {
      return this.openWebSocketSession(url, connection);
    }

    const session = this.sessions.get(sessionId);

    if (!session || !(session.transport instanceof SocketIOPollingTransport)) {
      connection.close(UNKNOWN_SESSION_CLOSE_CODE, ENGINE_IO_ERRORS.UNKNOWN_SESSION_ID.message);
      return IGNORED_CONNECTION_CLAIM;
    }

    const pollingTransport = session.transport;

    return {
      onFrame: (frame) => {
        // A client that paused polling to upgrade receives no close packet, so the upgrading connection closes instead.
        if (this.sessions.get(session.id) !== session) {
          connection.close();
        } else if (frame === UPGRADE_PROBE_PACKET) {
          connection.send(UPGRADE_PROBE_REPLY_PACKET);
          // The noop completes the pending poll so the client can pause polling before finishing the upgrade.
          pollingTransport.send(NOOP_PACKET);
        } else if (frame === UPGRADE_PACKET) {
          session.transport = connection;
          pollingTransport.drainFrames().forEach((queuedFrame) => connection.send(queuedFrame));
        } else {
          this.receiveFrame(session, frame);
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

  private openWebSocketSession(url: string, connection: WebSocketInterceptorProtocolRawConnection) {
    if (this.isStopping) {
      connection.close();
      return IGNORED_CONNECTION_CLAIM;
    }

    const session = this.createSession(url, connection);
    connection.send(this.createOpenPacket(session.id, []));

    return {
      onFrame: (frame) => this.receiveFrame(session, frame),
      onClose: () => this.closeSession(session),
    } satisfies WebSocketInterceptorProtocolConnectionClaim;
  }
}

const engines = new Map<string, SocketIOEngine>();

function getSocketIOEngineKey(interceptor: AnyWebSocketInterceptorImplementation) {
  return `${interceptor.type}:${interceptor.baseURLAsString}`;
}

export function getOrCreateSocketIOEngine(
  interceptor: AnyWebSocketInterceptorImplementation,
  options: SocketIOEngineOptions,
) {
  const key = getSocketIOEngineKey(interceptor);

  let engine = engines.get(key);

  if (!engine) {
    engine = new SocketIOEngine(interceptor, options);
    engines.set(key, engine);
  }

  return engine;
}

export function deleteSocketIOEngine(interceptor: AnyWebSocketInterceptorImplementation) {
  engines.delete(getSocketIOEngineKey(interceptor));
}

export type { SocketIOEngine };
