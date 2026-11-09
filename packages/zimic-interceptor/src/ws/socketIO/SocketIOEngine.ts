import type { HttpSchema } from '@zimic/http';
// Imported through the package name so that bundling keeps the HTTP code in its own entry point. Sharing it in a chunk
// breaks prebundlers that cannot resolve the dependencies of the chunk, such as Vite with strict node_modules.
import { createHttpInterceptor, type LocalHttpInterceptor, type RemoteHttpInterceptor } from '@zimic/interceptor/http';

import { convertArrayBufferToBase64 } from '@/utils/data';
import { logger } from '@/utils/logging';

import type {
  WebSocketInterceptorProtocolClient,
  WebSocketInterceptorProtocolConnectionClaim,
  WebSocketInterceptorProtocolFrame,
  WebSocketInterceptorProtocolHost,
  WebSocketInterceptorProtocolRawConnection,
  WebSocketInterceptorUnnormalizedFrame,
} from '../interceptor/types/protocol';

export const SUPPORTED_ENGINE_IO_VERSION = '4';

// Clients reject frames over this size, and no mocked frame needs to reach the limit of 1 MB used by Socket.IO servers.
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

export interface SocketIOEngineMember {
  host: WebSocketInterceptorProtocolHost;
}

interface SocketIOEngineSession {
  id: string;
  transport: SocketIOTransport;
  // The connection of an upgrade in progress, which has not taken over the session yet.
  upgradingConnection?: SocketIOTransport;
  // Sessions opened over WebSocket have their connections closed by the worker holding them.
  isHeldByWorker: boolean;
  clients: Map<SocketIOEngineMember, WebSocketInterceptorProtocolClient>;
  pingTimer: ReturnType<typeof setInterval>;
}

export interface SocketIOEngineOptions {
  polling: boolean;
  pingInterval: number;
  pingTimeout: number;
}

export function createUnsupportedEngineIOVersionMessage(version: string | null) {
  return `Engine.IO protocol version ${version ?? 'unknown'} is not supported. Use version ${SUPPORTED_ENGINE_IO_VERSION}.`;
}

/**
 * The Engine.IO server of a base URL. Socket.IO multiplexes namespaces over one connection and one polling session, so
 * the interceptors of each namespace share one engine, which sends each open packet and ping once per connection.
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

    // A poll that overlapped the upgrade has nothing left to deliver, because the session moved to the WebSocket.
    if (!(session.transport instanceof SocketIOPollingTransport)) {
      return { status: 200, body: NOOP_PACKET } as const;
    }

    return { status: 200, body: await session.transport.poll() } as const;
  }

  private async openPollingSession(request: {
    url: string;
    searchParams: { get: (name: 'sid' | 'EIO') => string | null };
  }) {
    const version = request.searchParams.get('EIO');

    if (version !== SUPPORTED_ENGINE_IO_VERSION) {
      const message = createUnsupportedEngineIOVersionMessage(version);
      logger.warn(message);
      return { status: 400, body: { code: 5, message } } as const;
    }

    const transport = new SocketIOPollingTransport();
    const session = this.createSession(crypto.randomUUID(), transport, { isHeldByWorker: false });

    const members = Array.from(this.members);

    const openedClients = await Promise.all(
      members.map(async (member) => {
        return member.host.openClient({
          url: request.url.replace(/^http/, 'ws'),
          connectionId: session.id,
          sendFrame: (frame) => session.transport.send(frame),
          close: (code, reason) => this.closeSession(session, code, reason),
        });
      }),
    );

    // Like a WebSocket connection, a polling session is accepted or refused as a whole.
    if (openedClients.includes(null)) {
      this.closeSession(session);
      return { status: 403, body: { code: 4, message: 'Forbidden' } } as const;
    }

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
    for (const [member, client] of session.clients) {
      member.host.handleFrame(client, frame);
    }
  }

  private createOpenPacket(sessionId: string, upgrades: string[]) {
    const { pingInterval, pingTimeout } = this.options;
    return `0${JSON.stringify({ sid: sessionId, upgrades, pingInterval, pingTimeout, maxPayload: MAX_PAYLOAD_BYTES })}`;
  }

  // Clients close the connection if the server does not ping them within `pingInterval + pingTimeout`. Unresponsive
  // clients are not detected: their sessions stay listed until the interceptor is cleared or stopped.
  private createSession(id: string, transport: SocketIOTransport, options: { isHeldByWorker: boolean }) {
    const session: SocketIOEngineSession = {
      id,
      transport,
      isHeldByWorker: options.isHeldByWorker,
      clients: new Map(),
      pingTimer: setInterval(() => session.transport.send(PING_PACKET), this.options.pingInterval),
    };

    this.sessions.set(id, session);
    return session;
  }

  private closeSession(session: SocketIOEngineSession, code?: number, reason?: string) {
    if (!this.sessions.delete(session.id)) {
      return;
    }

    clearInterval(session.pingTimer);
    session.transport.close(code, reason);
    session.upgradingConnection?.close(code, reason);

    for (const [member, client] of session.clients) {
      member.host.removeClient(client);
    }
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
      await this.httpInterceptorStart.catch(() => undefined);
      await this.httpInterceptor.stop();
    }
  }

  // A session stays open until its last namespace lets it go, as a connection shared by interceptors.
  closeMemberClients(member: SocketIOEngineMember) {
    for (const session of Array.from(this.sessions.values())) {
      const client = session.clients.get(member);

      if (client && !session.isHeldByWorker) {
        member.host.removeClient(client);
      }
    }
  }

  connectClient(member: SocketIOEngineMember, client: WebSocketInterceptorProtocolClient) {
    const existingSession = this.sessions.get(client.connectionId);

    const session: SocketIOEngineSession =
      existingSession ??
      this.createSession(
        client.connectionId,
        {
          send: (frame) => session.clients.values().next().value?.sendFrame(frame),
          close: () => undefined,
        },
        { isHeldByWorker: true },
      );

    session.clients.set(member, client);

    if (!existingSession) {
      client.sendFrame(this.createOpenPacket(session.id, []));
    }

    return () => {
      session.clients.delete(member);

      if (session.clients.size === 0) {
        this.closeSession(session);
      }
    };
  }

  // A polling client upgrades by opening a WebSocket connection with its session ID, which only carries the session.
  claimConnection(
    url: string,
    connection: WebSocketInterceptorProtocolRawConnection,
  ): WebSocketInterceptorProtocolConnectionClaim | undefined {
    const sessionId = new URL(url).searchParams.get('sid');

    if (sessionId === null) {
      return undefined;
    }

    const session = this.sessions.get(sessionId);

    // As a Socket.IO server refuses unknown session IDs, an upgrade of a session closed in the meantime does not connect.
    if (!session || !(session.transport instanceof SocketIOPollingTransport)) {
      connection.close(UNKNOWN_SESSION_CLOSE_CODE, 'Session ID unknown');
      return { onFrame: () => undefined, onClose: () => undefined };
    }

    const pollingTransport = session.transport;
    session.upgradingConnection = connection;

    return {
      onFrame: (frame) => {
        if (frame === UPGRADE_PROBE_PACKET) {
          connection.send(UPGRADE_PROBE_REPLY_PACKET);
          // The noop completes the pending poll so the client can pause polling before finishing the upgrade.
          pollingTransport.send(NOOP_PACKET);
        } else if (frame === UPGRADE_PACKET) {
          // Packets queued while the client upgraded are delivered through the WebSocket.
          session.transport = connection;
          session.upgradingConnection = undefined;
          pollingTransport.drainFrames().forEach((queuedFrame) => connection.send(queuedFrame));
        } else {
          this.dispatchFrame(session, frame);
        }
      },

      // A connection closing during its probe is a failed upgrade, after which the client continues polling.
      onClose: () => {
        if (session.upgradingConnection === connection) {
          session.upgradingConnection = undefined;
        }

        if (session.transport === connection) {
          session.transport = { send: () => undefined, close: () => undefined };
          this.closeSession(session);
        }
      },
    };
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
