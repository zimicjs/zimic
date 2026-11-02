import type { HttpSchema } from '@zimic/http';
import type {
  LocalWebSocketInterceptor,
  RemoteWebSocketInterceptor,
  WebSocketInterceptorClient,
} from '@zimic/interceptor/experimental/ws';
import type { LocalHttpInterceptor, RemoteHttpInterceptor } from '@zimic/interceptor/http';
import type { JSONStringified, WebSocketMessageData, WebSocketSchema } from '@zimic/ws';
import { WebSocket } from 'socket.io-client';

// Engine.IO v4 packet types prefix every frame: `0` open, `1` close, `2` ping, `3` pong, `4` message, `5` upgrade, and
// `6` noop. Socket.IO packets are Engine.IO messages prefixed by `0` connect, `1` disconnect, or `2` event.
type SocketIOEngineFrame = '1' | '2' | '3' | '2probe' | '3probe' | '5' | '6' | `0${string}`;
type SocketIOConnectFrame = '40' | `40${JSONStringified<{ sid: string }>}` | '41';

export type SocketIOEventFrame<Events, Event extends keyof Events & string = keyof Events & string> = {
  [Name in Event]: `42["${Name}",${JSONStringified<Events[Name]>}]`;
}[Event];

type SocketIOFrame<Events> = SocketIOEngineFrame | SocketIOConnectFrame | SocketIOEventFrame<Events>;

export type SocketIOWebSocketSchema<Events> = WebSocketSchema<SocketIOFrame<Events>>;

export type SocketIOHttpSchema = HttpSchema<{
  '/socket.io/': {
    GET: {
      request: { searchParams: { sid?: string } };
      response: { 200: { body: string } };
    };
    POST: {
      request: { searchParams: { sid: string }; body: string };
      response: { 200: { body: 'ok' } };
    };
  };
}>;

// Polling bodies batch packets separated by the ASCII record separator.
const POLLING_PACKET_SEPARATOR = '\x1e';

// The built-in transports keep the `WebSocket` constructor they find when the module loads, before local interceptors
// replace `globalThis.WebSocket`. Reading it on each connection lets local interceptors receive the socket.
export class GlobalWebSocketTransport extends WebSocket {
  createSocket(url: string, protocols: string | string[] | undefined) {
    return new globalThis.WebSocket(url, protocols);
  }
}

interface SocketIOPollingSession<Events> {
  pendingPackets: WebSocketMessageData<SocketIOWebSocketSchema<Events>>[];
  resolvePoll?: (body: string) => void;
}

interface SocketIOMockOptions<Events> {
  webSocketInterceptor:
    | LocalWebSocketInterceptor<SocketIOWebSocketSchema<Events>>
    | RemoteWebSocketInterceptor<SocketIOWebSocketSchema<Events>>;
  httpInterceptor?: LocalHttpInterceptor<SocketIOHttpSchema> | RemoteHttpInterceptor<SocketIOHttpSchema>;
  upgrades: 'websocket'[];
  pingInterval: number;
  pingTimeout: number;
}

export function createSocketIOMock<Events>({
  webSocketInterceptor,
  httpInterceptor,
  upgrades,
  pingInterval,
  pingTimeout,
}: SocketIOMockOptions<Events>) {
  type Client = WebSocketInterceptorClient<SocketIOWebSocketSchema<Events>>;
  type EventName = keyof Events & string;

  const pollingSessions = new Map<string, SocketIOPollingSession<Events>>();
  let pingIntervalId: ReturnType<typeof setInterval> | undefined;

  function createOpenPacket(sid: string, sessionUpgrades: 'websocket'[]) {
    const openPacketData = { sid, upgrades: sessionUpgrades, pingInterval, pingTimeout, maxPayload: 1000000 };
    return `0${JSON.stringify(openPacketData)}` as const;
  }

  function createConnectPacket() {
    return `40${JSON.stringify({ sid: crypto.randomUUID() })}` as const;
  }

  function encodeEvent<Event extends EventName>(event: Event, data: Events[Event]) {
    return `42["${event}",${JSON.stringify(data)}]` as const;
  }

  function decodeEvents(frames: string) {
    return frames
      .split(POLLING_PACKET_SEPARATOR)
      .filter((packet) => packet.startsWith('42'))
      .map((packet) => {
        const [event, data] = JSON.parse(packet.slice('42'.length)) as [string, unknown];
        return { event, data };
      });
  }

  function hasEvent(frames: string, event: EventName) {
    return decodeEvents(frames).some((decodedEvent) => decodedEvent.event === event);
  }

  // Clients upgrading from polling connect with the session ID they received in the open packet. Other clients have
  // none, which matches no polling session.
  function getPollingSessionId(client: Client) {
    return new URL(client.url).searchParams.get('sid') ?? '';
  }

  function sendOpenPacketToNewWebSocketClients(client: Client) {
    if (!pollingSessions.has(getPollingSessionId(client))) {
      client.send(createOpenPacket(crypto.randomUUID(), []));
    }
  }

  function send(sid: string, packet: WebSocketMessageData<SocketIOWebSocketSchema<Events>>) {
    const session = pollingSessions.get(sid);

    if (session?.resolvePoll) {
      session.resolvePoll(packet);
      session.resolvePoll = undefined;
    } else {
      session?.pendingPackets.push(packet);
    }
  }

  // Long-poll requests stay open until a packet is sent to the session, as a Socket.IO server does.
  function poll(session: SocketIOPollingSession<Events>) {
    /* istanbul ignore if -- @preserve
     * Packets are queued only when they are sent between a poll response and the next poll. */
    if (session.pendingPackets.length > 0) {
      const body = session.pendingPackets.join(POLLING_PACKET_SEPARATOR);
      session.pendingPackets = [];
      return body;
    }

    return new Promise<string>((resolve) => {
      session.resolvePoll = resolve;
    });
  }

  // Clients close the connection if the server does not ping them within `pingInterval + pingTimeout`. Clients still
  // upgrading expect `3probe` before any other packet, so they receive pings only after the upgrade.
  function sendPings() {
    const webSocketClients = webSocketInterceptor.clients.filter(
      (client) => !pollingSessions.has(getPollingSessionId(client)),
    );

    webSocketInterceptor.server.send('2', { to: webSocketClients });

    for (const sid of pollingSessions.keys()) {
      send(sid, '2');
    }
  }

  async function declareWebSocketHandlers() {
    await webSocketInterceptor.message().with('40').respond(createConnectPacket);
    await webSocketInterceptor.message().with('3');
    await webSocketInterceptor.message().with('41');

    // The noop completes the pending poll so the client can pause polling before finishing the upgrade.
    await webSocketInterceptor
      .message()
      .with('2probe')
      .respond((_message, { sender }) => {
        send(getPollingSessionId(sender), '6');
        return '3probe';
      });

    // Packets queued for the polling session while the client upgraded are delivered through the WebSocket.
    await webSocketInterceptor
      .message()
      .with('5')
      .effect((_message, { sender }) => {
        const sid = getPollingSessionId(sender);
        pollingSessions.get(sid)?.pendingPackets.forEach(
          /* istanbul ignore next -- @preserve
           * Packets are queued only when they are sent after the probe completed the last poll. */
          (packet) => sender.send(packet),
        );
        pollingSessions.delete(sid);
      });
  }

  async function declareHttpHandlers(interceptor: NonNullable<typeof httpInterceptor>) {
    await interceptor.get('/socket.io/').respond(async (request) => {
      const sid = request.searchParams.get('sid');

      if (sid === null) {
        const newSid = crypto.randomUUID();
        pollingSessions.set(newSid, { pendingPackets: [] });
        return { status: 200, body: createOpenPacket(newSid, upgrades) };
      }

      const session = pollingSessions.get(sid);

      /* istanbul ignore if -- @preserve
       * A client may send a poll before the server receives the close packet it sent earlier. */
      if (!session) {
        return { status: 200, body: '1' };
      }

      return { status: 200, body: await poll(session) };
    });

    await interceptor.post('/socket.io/').respond((request) => {
      const sid = request.searchParams.get('sid');
      const packets = request.body.split(POLLING_PACKET_SEPARATOR);

      if (packets.includes('40')) {
        send(sid, createConnectPacket());
      }

      // The close packet completes the pending poll and stops the client from polling again.
      if (packets.includes('1')) {
        send(sid, '1');
        pollingSessions.delete(sid);
      }

      return { status: 200, body: 'ok' };
    });
  }

  return {
    encodeEvent,
    decodeEvents,
    hasEvent,
    send,

    start() {
      webSocketInterceptor.on('connection', sendOpenPacketToNewWebSocketClients);
      pingIntervalId = setInterval(sendPings, pingInterval);
    },

    async declareHandlers() {
      await declareWebSocketHandlers();

      if (httpInterceptor) {
        await declareHttpHandlers(httpInterceptor);
      }
    },

    stop() {
      clearInterval(pingIntervalId);
      webSocketInterceptor.off('connection', sendOpenPacketToNewWebSocketClients);

      for (const sid of pollingSessions.keys()) {
        /* istanbul ignore next -- @preserve
         * Sessions remain only when a client close packet has not arrived yet. */
        send(sid, '1');
      }
      pollingSessions.clear();
    },
  };
}
