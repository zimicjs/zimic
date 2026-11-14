import type { HttpSchema } from '@zimic/http';
// Imported through the package name so that bundling keeps the HTTP code in its own entry point. Sharing it in a chunk
// breaks prebundlers that cannot resolve the dependencies of the chunk, such as Vite with strict node_modules.
import { createHttpInterceptor, type LocalHttpInterceptor, type RemoteHttpInterceptor } from '@zimic/interceptor/http';
import * as socketIOParser from 'socket.io-parser';

import { convertArrayBufferToBase64 } from '@/utils/data';
import { logger } from '@/utils/logging';
import { normalizeBufferSource } from '@/ws/utils/messageData';

import type {
  WebSocketInterceptorProtocolClient,
  WebSocketInterceptorProtocolConnectionClaim,
  WebSocketInterceptorProtocolFrame,
  WebSocketInterceptorProtocolHost,
  WebSocketInterceptorProtocolRawConnection,
  WebSocketInterceptorUnnormalizedFrame,
} from '../interceptor/types/protocol';
import type { SocketIOPacket } from './types';

const { PacketType } = socketIOParser;

const SUPPORTED_ENGINE_IO_VERSION = '4';

// A code in the application range, because Socket.IO has no close code for a refused protocol version.
const UNSUPPORTED_VERSION_CLOSE_CODE = 4000;

// The message of the error Socket.IO servers send when a client joins a namespace they do not serve.
const INVALID_NAMESPACE_MESSAGE = 'Invalid namespace';

// Socket.IO servers send the message of the error a middleware rejects a namespace connection with, so the client
// receives it in `connect_error`. Connection handlers reject without an error, so this message names the rejection.
const REJECTED_NAMESPACE_CONNECTION_MESSAGE = 'Connection rejected';

// Clients use this value only to split the polling batches they send. It matches the limit of Socket.IO servers.
const MAX_PAYLOAD_BYTES = 1000000;

// Polling bodies batch packets separated by the ASCII record separator.
const POLLING_PACKET_SEPARATOR = '\x1e';

const CLOSE_PACKET = '1';
const PING_PACKET = '2';
const NOOP_PACKET = '6';
const UPGRADE_PROBE_PACKET = '2probe';
const UPGRADE_PROBE_REPLY_PACKET = '3probe';
const UPGRADE_PACKET = '5';

// A code in the application range, because Socket.IO has no close code for an unknown session.
const UNKNOWN_SESSION_CLOSE_CODE = 4001;

function ignoreConnectionEvent() {
  return undefined;
}

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
      request: { searchParams: { EIO?: string; transport?: string; sid?: string }; body: string };
      response: { 200: { body: string }; 400: { body: SocketIOPollingErrorBody } };
    };
  };
}>;

type SocketIOTransport = WebSocketInterceptorProtocolRawConnection;

class SocketIOPollingTransport implements SocketIOTransport {
  private queuedFrames: WebSocketInterceptorProtocolFrame[] = [];
  private resolvePendingPoll?: (body: string) => void;

  private drainBody() {
    const body = this.queuedFrames
      .map((frame) => (typeof frame === 'string' ? frame : `b${convertArrayBufferToBase64(frame)}`))
      .join(POLLING_PACKET_SEPARATOR);

    this.queuedFrames = [];
    return body;
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

/** The protocol of one namespace, which decodes the frames of every session and encodes the packets of its namespace. */
export interface SocketIOEngineMember {
  readonly host: WebSocketInterceptorProtocolHost;
  readonly namespace: string;
  receiveFrame: (session: SocketIOEngineSession, frame: WebSocketInterceptorProtocolFrame) => void;
  sendSocketPacket: (session: SocketIOEngineSession, packet: SocketIOPacket) => void;
}

/** An Engine.IO connection, which carries the namespaces its client joined. */
export interface SocketIOEngineSession {
  id: string;
  url: string;
  transport: SocketIOTransport;
  // The client of each namespace the session joined.
  clients: Map<SocketIOEngineMember, WebSocketInterceptorProtocolClient>;
  // The namespace connections still decided by the connection handlers of their interceptors.
  pendingConnections: Map<SocketIOEngineMember, AbortController>;
  // Reading a `Blob` frame takes longer than reading a later text frame, and decoders keep state between frames, as
  // with binary attachments, so frames are read in order.
  frameReadings: Promise<void>;
  pingTimer: ReturnType<typeof setInterval>;
}

export interface SocketIOEngineOptions {
  polling: boolean;
  pingInterval: number;
  pingTimeout: number;
}

function createUnsupportedEngineIOVersionMessage(version: string | null) {
  return `Engine.IO protocol version ${version ?? 'unknown'} is not supported. Use version ${SUPPORTED_ENGINE_IO_VERSION}.`;
}

/**
 * The Engine.IO server of a base URL. Socket.IO multiplexes namespaces over one connection and one polling session, so
 * the interceptors of each namespace share one engine, which sends each open packet and ping once per connection. As a
 * Socket.IO server, it opens a client in the interceptor of a namespace only when the session joins that namespace.
 */
class SocketIOEngine {
  private members = new Set<SocketIOEngineMember>();
  private sessions = new Map<string, SocketIOEngineSession>();
  private httpInterceptor:
    LocalHttpInterceptor<SocketIOPollingHttpSchema> | RemoteHttpInterceptor<SocketIOPollingHttpSchema>;
  private httpInterceptorStart: Promise<void>;
  private options: SocketIOEngineOptions;

  constructor(
    private key: string,
    host: WebSocketInterceptorProtocolHost,
    options: SocketIOEngineOptions,
  ) {
    this.options = options;

    // Scoped to the Socket.IO path, because HTTP interceptors decide the unhandled requests under their base URL.
    const baseURL = `${host.baseURL.replace(/^ws/, 'http').replace(/\/$/, '')}/socket.io`;

    this.httpInterceptor =
      host.type === 'local'
        ? createHttpInterceptor<SocketIOPollingHttpSchema>({
            type: 'local',
            baseURL,
            requestSaving: { enabled: false },
          })
        : createHttpInterceptor<SocketIOPollingHttpSchema>({
            type: 'remote',
            baseURL,
            auth: host.auth,
            requestSaving: { enabled: false },
          });

    this.httpInterceptorStart = this.startHttpInterceptor();
  }

  private async startHttpInterceptor() {
    await this.httpInterceptor.start();

    if (this.options.polling) {
      await this.httpInterceptor.get('/').respond((request) => this.handlePoll(request));
      await this.httpInterceptor.post('/').respond((request) => this.handlePollingPacket(request));
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

  private async handlePoll(request: { url: string; searchParams: { get: (name: 'sid' | 'EIO') => string | null } }) {
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
     * Clients pause polling before finishing an upgrade, so only a poll overlapping the upgrade reaches this. It has
     * nothing left to deliver, because the session moved to the WebSocket. */
    if (!(session.transport instanceof SocketIOPollingTransport)) {
      return { status: 200, body: NOOP_PACKET } as const;
    }

    return { status: 200, body: await session.transport.poll() } as const;
  }

  private openPollingSession(request: { url: string; searchParams: { get: (name: 'sid' | 'EIO') => string | null } }) {
    const version = request.searchParams.get('EIO');

    if (version !== SUPPORTED_ENGINE_IO_VERSION) {
      const message = createUnsupportedEngineIOVersionMessage(version);
      logger.warn(message);
      return { status: 400, body: { code: 5, message } } as const;
    }

    // Refused as an Engine.IO server refuses a request it does not allow.
    if (this.isStopping) {
      return { status: 403, body: { code: 4, message: 'Forbidden' } } as const;
    }

    const session = this.createSession(request.url.replace(/^http/, 'ws'), new SocketIOPollingTransport());
    return { status: 200, body: this.createOpenPacket(session.id, ['websocket']) } as const;
  }

  private handlePollingPacket(request: { body: string; searchParams: { get: (name: 'sid') => string | null } }) {
    const sessionId = request.searchParams.get('sid');
    const session = sessionId === null ? undefined : this.sessions.get(sessionId);

    if (session) {
      for (const packet of request.body.split(POLLING_PACKET_SEPARATOR)) {
        if (packet === CLOSE_PACKET) {
          this.closeSession(session);
        } else {
          this.dispatchFrame(session, packet);
        }
      }
    }

    return { status: 200, body: 'ok' } as const;
  }

  private dispatchFrame(session: SocketIOEngineSession, frame: WebSocketInterceptorUnnormalizedFrame) {
    session.frameReadings = session.frameReadings.then(async () => {
      const normalizedFrame =
        typeof frame === 'string' || frame instanceof ArrayBuffer
          ? frame
          : frame instanceof Blob
            ? await frame.arrayBuffer()
            : normalizeBufferSource(frame);

      // A session closed while the frame was read no longer opens clients.
      if (this.sessions.get(session.id) !== session) {
        return;
      }

      for (const member of this.members) {
        try {
          member.receiveFrame(session, normalizedFrame);
        } catch (error) {
          console.error(error);
        }
      }
    });
  }

  private createOpenPacket(sessionId: string, upgrades: string[]) {
    const { pingInterval, pingTimeout } = this.options;
    return `0${JSON.stringify({ sid: sessionId, upgrades, pingInterval, pingTimeout, maxPayload: MAX_PAYLOAD_BYTES })}`;
  }

  // Clients close the connection if the server does not ping them within `pingInterval + pingTimeout`. Unresponsive
  // clients are not detected: their sessions stay open until their namespaces are cleared or stopped.
  private createSession(url: string, transport: SocketIOTransport) {
    const session: SocketIOEngineSession = {
      id: crypto.randomUUID(),
      url,
      transport,
      clients: new Map(),
      pendingConnections: new Map(),
      frameReadings: Promise.resolve(),
      pingTimer: setInterval(() => session.transport.send(PING_PACKET), this.options.pingInterval),
    };

    this.sessions.set(session.id, session);
    return session;
  }

  private closeSession(session: SocketIOEngineSession) {
    if (!this.sessions.delete(session.id)) {
      return;
    }

    clearInterval(session.pingTimer);
    session.transport.close();

    for (const pendingConnection of session.pendingConnections.values()) {
      pendingConnection.abort();
    }
    session.pendingConnections.clear();

    for (const [member, client] of session.clients) {
      member.host.removeClient(client);
    }
  }

  // The engine stops once its last member detaches. Sessions opened while it stops would outlive it, because nothing
  // closes them.
  private get isStopping() {
    return this.members.size === 0;
  }

  attach(member: SocketIOEngineMember) {
    this.members.add(member);
    return this.httpInterceptorStart;
  }

  async detach(member: SocketIOEngineMember) {
    this.closeMemberClients(member);
    this.members.delete(member);

    if (this.members.size === 0) {
      engines.delete(this.key); // eslint-disable-line @typescript-eslint/no-use-before-define

      // Sessions that joined no namespace are left only to the last member.
      for (const session of Array.from(this.sessions.values())) {
        this.closeSession(session);
      }

      await Promise.allSettled([this.httpInterceptorStart]);
      await this.httpInterceptor.stop();
    }
  }

  // Clearing or stopping an interceptor disconnects its namespace and lets go of the namespace connections it is still
  // deciding. A session stays open until the last namespace using it lets it go.
  closeMemberClients(member: SocketIOEngineMember) {
    for (const session of Array.from(this.sessions.values())) {
      const pendingConnection = session.pendingConnections.get(member);
      const wasUsedByMember = pendingConnection !== undefined || session.clients.has(member);

      pendingConnection?.abort();
      session.pendingConnections.delete(member);

      this.disconnectNamespace(member, session);

      const isUnused = session.clients.size === 0 && session.pendingConnections.size === 0;

      if (wasUsedByMember && isUnused) {
        this.closeSession(session);
      }
    }
  }

  // As `socket.disconnect()` in a Socket.IO server, which leaves the connection open for other namespaces.
  private disconnectNamespace(member: SocketIOEngineMember, session: SocketIOEngineSession) {
    const client = session.clients.get(member);

    if (client) {
      member.sendSocketPacket(session, { type: PacketType.DISCONNECT, nsp: member.namespace });
      member.host.removeClient(client);
    }
  }

  // Every member decodes the CONNECT packets of all namespaces, so only the oldest one refuses unknown namespaces.
  handleConnectPacket(member: SocketIOEngineMember, session: SocketIOEngineSession, namespace: string) {
    if (namespace === member.namespace) {
      this.connectNamespace(member, session).catch((error: unknown) => {
        console.error(error);
      });
      return;
    }

    const oldestMember = this.members.values().next().value;
    const isKnownNamespace = Array.from(this.members).some((candidate) => candidate.namespace === namespace);

    if (member === oldestMember && !isKnownNamespace) {
      member.sendSocketPacket(session, {
        type: PacketType.CONNECT_ERROR,
        nsp: namespace,
        data: { message: INVALID_NAMESPACE_MESSAGE },
      });
    }
  }

  private async connectNamespace(member: SocketIOEngineMember, session: SocketIOEngineSession) {
    const pendingConnection = new AbortController();
    session.pendingConnections.set(member, pendingConnection);

    try {
      // An accepted client joins the session when its interceptor lists it, before connection effects run.
      const opening = await member.host.openClient({
        url: session.url,
        connectionId: session.id,
        signal: pendingConnection.signal,
        sendFrame: (frame) => session.transport.send(frame),
        close: () => this.disconnectNamespace(member, session),
      });

      if (opening?.action === 'reject') {
        member.sendSocketPacket(session, {
          type: PacketType.CONNECT_ERROR,
          nsp: member.namespace,
          data: { message: REJECTED_NAMESPACE_CONNECTION_MESSAGE },
        });
      }
    } finally {
      if (session.pendingConnections.get(member) === pendingConnection) {
        session.pendingConnections.delete(member);
      }
    }
  }

  connectClient(member: SocketIOEngineMember, client: WebSocketInterceptorProtocolClient) {
    const session = this.sessions.get(client.connectionId);

    // Only clients opened by the engine join a session.
    if (!session) {
      return undefined;
    }

    session.clients.set(member, client);
    member.sendSocketPacket(session, {
      type: PacketType.CONNECT,
      nsp: member.namespace,
      data: { sid: crypto.randomUUID() },
    });

    return () => {
      if (session.clients.get(member) === client) {
        session.clients.delete(member);
      }
    };
  }

  // Every connection carries an Engine.IO session. A polling client upgrades by opening a WebSocket connection with its
  // session ID, which only carries the existing session.
  claimConnection(
    url: string,
    connection: WebSocketInterceptorProtocolRawConnection,
  ): WebSocketInterceptorProtocolConnectionClaim {
    const searchParams = new URL(url).searchParams;
    const version = searchParams.get('EIO');

    if (version !== SUPPORTED_ENGINE_IO_VERSION) {
      const message = createUnsupportedEngineIOVersionMessage(version);
      logger.warn(message);
      connection.close(UNSUPPORTED_VERSION_CLOSE_CODE, message);
      return { onFrame: ignoreConnectionEvent, onClose: ignoreConnectionEvent };
    }

    const sessionId = searchParams.get('sid');

    if (sessionId === null) {
      return this.openWebSocketSession(url, connection);
    }

    const session = this.sessions.get(sessionId);

    // As a Socket.IO server refuses unknown session IDs, an upgrade of a session closed in the meantime does not connect.
    if (!session || !(session.transport instanceof SocketIOPollingTransport)) {
      connection.close(UNKNOWN_SESSION_CLOSE_CODE, 'Session ID unknown');
      return { onFrame: ignoreConnectionEvent, onClose: ignoreConnectionEvent };
    }

    const pollingTransport = session.transport;

    return {
      onFrame: (frame) => {
        // A client that paused polling to upgrade receives no close packet, so a session closed during the upgrade
        // closes the connection the client upgrades with.
        if (this.sessions.get(session.id) !== session) {
          connection.close();
        } else if (frame === UPGRADE_PROBE_PACKET) {
          connection.send(UPGRADE_PROBE_REPLY_PACKET);
          // The noop completes the pending poll so the client can pause polling before finishing the upgrade.
          pollingTransport.send(NOOP_PACKET);
        } else if (frame === UPGRADE_PACKET) {
          // Packets queued while the client upgraded are delivered through the WebSocket.
          session.transport = connection;
          pollingTransport.drainFrames().forEach((queuedFrame) => connection.send(queuedFrame));
        } else {
          this.dispatchFrame(session, frame);
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
      return { onFrame: ignoreConnectionEvent, onClose: ignoreConnectionEvent };
    }

    const session = this.createSession(url, connection);
    connection.send(this.createOpenPacket(session.id, []));

    return {
      onFrame: (frame) => this.dispatchFrame(session, frame),
      onClose: () => this.closeSession(session),
    } satisfies WebSocketInterceptorProtocolConnectionClaim;
  }
}

const engines = new Map<string, SocketIOEngine>();

export function getOrCreateSocketIOEngine(host: WebSocketInterceptorProtocolHost, options: SocketIOEngineOptions) {
  const key = `${host.type}:${host.baseURL}`;

  let engine = engines.get(key);

  if (!engine) {
    engine = new SocketIOEngine(key, host, options);
    engines.set(key, engine);
  }

  return engine;
}

export type { SocketIOEngine };
