import { createPromiseWithResolvers } from '@zimic/utils/data';
import { waitFor } from '@zimic/utils/time';
import color from 'picocolors';
import type { ManagerOptions } from 'socket.io-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createHttpInterceptor } from '@/http';
import type { InterceptorServerWebSocketSchema } from '@/server/types/schema';
import UnauthorizedWebSocketConnectionError from '@/utils/webSocket/errors/UnauthorizedWebSocketConnectionError';
import InterceptorWebSocketClient from '@/utils/webSocket/WebSocketClient';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingHttpInterceptor, usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { usingSocket, waitForSocketConnection } from '@tests/utils/socketIO';

import InvalidSocketIOPollingInterceptorError from '../../errors/InvalidSocketIOPollingInterceptorError';
import { createSocketIOProtocol } from '../../factory';
import type { SocketIOProtocolOptions } from '../../types/options';
import type { SocketIOPollingSchema } from '../../types/polling';
import {
  AnySchema,
  AnySocketIOInterceptor,
  createSocketIOInterceptorOptions,
  createSocketIOPollingInterceptor,
  getSocketIOBaseURL,
  MESSAGE_SAVING,
  SharedSocketIOProtocolTestsOptions,
  SocketIOPollingInterceptor,
  SocketIOTestSavingOptions,
  usingSocketIONamespaceInterceptors,
} from './utils';

interface PollingSocketIOProtocolTestsOptions extends SharedSocketIOProtocolTestsOptions {
  getAuthenticatedBaseURL: () => string;
  getValidToken: () => string;
}

export function declarePollingSocketIOProtocolTests(options: PollingSocketIOProtocolTestsOptions) {
  const {
    type,
    getBaseURL: getServerBaseURL,
    getAuthenticatedBaseURL,
    getValidToken,
    PollingTransport,
    WebSocketTransport,
  } = options;

  let baseURL: string;
  let polling: SocketIOPollingInterceptor;

  beforeEach(() => {
    baseURL = getSocketIOBaseURL(getServerBaseURL());
    polling = createSocketIOPollingInterceptor(type, baseURL);
  });

  function getSocketIOInterceptorOptions(
    protocolOptions?: SocketIOProtocolOptions,
    savingOptions?: SocketIOTestSavingOptions,
  ) {
    return createSocketIOInterceptorOptions({ type, baseURL, polling }, protocolOptions, savingOptions);
  }

  async function usingNamespaceInterceptors(
    savingOptions: SocketIOTestSavingOptions,
    callback: (rootInterceptor: AnySocketIOInterceptor, adminInterceptor: AnySocketIOInterceptor) => Promise<void>,
  ) {
    await usingSocketIONamespaceInterceptors({ type, baseURL, polling }, savingOptions, callback);
  }

  describe('Polling sessions', () => {
    const pollingTransports: ManagerOptions['transports'] = [PollingTransport];

    // Local interceptors serve Socket.IO over polling only, so only remote clients upgrade to WebSocket.
    if (type === 'remote') {
      // Holds the upgrade of polling clients until released, so tests decide when it happens.
      function createDeferredUpgradeTransports() {
        const upgradeReleasePromise = createPromiseWithResolvers<void>();

        class DeferredWebSocketTransport extends WebSocketTransport {
          doOpen() {
            void upgradeReleasePromise.then(() => super.doOpen());
            return this;
          }
        }

        return {
          transports: [PollingTransport, DeferredWebSocketTransport],
          releaseUpgrade: () => upgradeReleasePromise.resolve(),
        };
      }

      it('should keep one client across the upgrade to WebSocket', async () => {
        const { transports, releaseUpgrade } = createDeferredUpgradeTransports();

        await usingWebSocketInterceptor<AnySchema>(
          getSocketIOInterceptorOptions({}, MESSAGE_SAVING),
          async (interceptor) => {
            const handler = await interceptor.message().with({ type: 'event' }).times(2);

            await usingSocket(baseURL, { transports }, async (socket) => {
              await waitForSocketConnection(socket);
              expect(socket.io.engine.transport.name).toBe('polling');

              socket.emit('event', 'before');
              await waitFor(() => expect(handler.messages).toHaveLength(1));

              releaseUpgrade();
              await waitFor(() => expect(socket.io.engine.transport.name).toBe('websocket'));

              socket.emit('event', 'after');
              await waitFor(() => expect(handler.messages).toHaveLength(2));

              expect(interceptor.clients).toHaveLength(1);
              expect(handler.messages[1].sender).toBe(handler.messages[0].sender);
            });
          },
        );
      });

      it('should deliver messages sent while a client upgrades', async () => {
        const { transports, releaseUpgrade } = createDeferredUpgradeTransports();

        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
          await usingSocket(baseURL, { transports }, async (socket) => {
            const receivedEvents: unknown[] = [];
            socket.on('event', (data: unknown) => receivedEvents.push(data));

            await waitForSocketConnection(socket);

            socket.io.engine.once('upgrading', () => {
              interceptor.server.send({ type: 'event', data: 'during upgrade' });
            });

            releaseUpgrade();

            await waitFor(() => expect(socket.io.engine.transport.name).toBe('websocket'));
            await waitFor(() => expect(receivedEvents).toEqual(['during upgrade']));
          });
        });
      });

      it('should not connect WebSocket connections with an unknown session ID', async () => {
        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
          const socket = new WebSocket(`${baseURL}/?EIO=4&transport=websocket&sid=unknown`);

          try {
            const closeEvent = await new Promise<CloseEvent>((resolve) => {
              socket.addEventListener('close', resolve, { once: true });
            });

            expect(closeEvent.reason).toBe('Session ID unknown');
            expect(interceptor.clients).toHaveLength(0);
          } finally {
            socket.close();
          }
        });
      });

      it('should not connect WebSocket connections with the session ID of an upgraded session', async () => {
        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
          await usingSocket(baseURL, { transports: [PollingTransport, WebSocketTransport] }, async (socket) => {
            await waitForSocketConnection(socket);
            await waitFor(() => expect(socket.io.engine.transport.name).toBe('websocket'));

            const upgradingSocket = new WebSocket(`${baseURL}/?EIO=4&transport=websocket&sid=${socket.io.engine.id}`);

            try {
              const closeEvent = await new Promise<CloseEvent>((resolve) => {
                upgradingSocket.addEventListener('close', resolve, { once: true });
              });

              expect(closeEvent.code).toBe(4000);
              expect(closeEvent.reason).toBe('Session ID unknown');
              expect(interceptor.clients).toHaveLength(1);
              expect(socket.connected).toBe(true);
            } finally {
              upgradingSocket.close();
            }
          });
        });
      });

      it('should close upgrading WebSocket connections whose session closed', async () => {
        const pollingURL = `${baseURL.replace(/^ws/, 'http')}/?EIO=4&transport=polling`;

        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async () => {
          const openPacket = await (await fetch(pollingURL)).text();
          const { sid } = JSON.parse(openPacket.slice(1)) as { sid: string };

          const upgradingSocket = new WebSocket(`${baseURL}/?EIO=4&transport=websocket&sid=${sid}`);

          try {
            const messageListener = vi.fn();
            upgradingSocket.addEventListener('message', messageListener);

            await new Promise<void>((resolve) => {
              upgradingSocket.addEventListener('open', () => resolve(), { once: true });
            });

            const closeEventPromise = new Promise<CloseEvent>((resolve) => {
              upgradingSocket.addEventListener('close', resolve, { once: true });
            });

            const closeResponse = await fetch(`${pollingURL}&sid=${sid}`, { method: 'POST', body: '1' });
            expect(closeResponse.status).toBe(200);

            const closeEvent = await closeEventPromise;
            expect(closeEvent.code).toBe(1005);
            expect(messageListener).not.toHaveBeenCalled();
          } finally {
            upgradingSocket.close();
          }
        });
      });

      it('should keep polling clients connected after their WebSocket upgrade closes', async () => {
        await usingWebSocketInterceptor<AnySchema>(
          getSocketIOInterceptorOptions({}, MESSAGE_SAVING),
          async (interceptor) => {
            const handler = await interceptor.message().with({ type: 'event' }).times(1);

            await usingSocket(baseURL, { transports: pollingTransports }, async (socket) => {
              await waitForSocketConnection(socket);

              const upgradingSocket = new WebSocket(`${baseURL}/?EIO=4&transport=websocket&sid=${socket.io.engine.id}`);

              try {
                const probeReplyPromise = new Promise<unknown>((resolve) => {
                  upgradingSocket.addEventListener('message', (event) => resolve(event.data), { once: true });
                });

                await new Promise<void>((resolve) => {
                  upgradingSocket.addEventListener('open', () => resolve(), { once: true });
                });

                // The probe reply shows that the connection is upgrading the session when it closes.
                upgradingSocket.send('2probe');
                expect(await probeReplyPromise).toBe('3probe');

                const closePromise = new Promise<void>((resolve) => {
                  upgradingSocket.addEventListener('close', () => resolve(), { once: true });
                });
                upgradingSocket.close();
                await closePromise;
              } finally {
                upgradingSocket.close();
              }

              socket.emit('event', 'after upgrade closed');
              await waitFor(() => expect(handler.messages).toHaveLength(1));

              expect(handler.messages[0].data).toStrictEqual({ type: 'event', data: 'after upgrade closed' });
              expect(interceptor.clients).toHaveLength(1);
              expect(socket.connected).toBe(true);
            });
          },
        );
      });

      it('should complete pending polls of clients finishing their upgrade', async () => {
        const pollingURL = `${baseURL.replace(/^ws/, 'http')}/?EIO=4&transport=polling`;

        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async () => {
          const openPacket = await (await fetch(pollingURL)).text();
          const { sid } = JSON.parse(openPacket.slice(1)) as { sid: string };
          const sessionURL = `${pollingURL}&sid=${sid}`;

          const upgradingSocket = new WebSocket(`${baseURL}/?EIO=4&transport=websocket&sid=${sid}`);

          try {
            const probeReplyPromise = new Promise<unknown>((resolve) => {
              upgradingSocket.addEventListener('message', (event) => resolve(event.data), { once: true });
            });

            await new Promise<void>((resolve) => {
              upgradingSocket.addEventListener('open', () => resolve(), { once: true });
            });

            upgradingSocket.send('2probe');
            expect(await probeReplyPromise).toBe('3probe');

            // No poll was pending during the probe, so its noop was queued.
            const probePoll = await fetch(sessionURL);
            expect(await probePoll.text()).toBe('6');

            // Either poll may reach the session first, and the other one overlaps it, which shows the first is pending.
            const polls = [fetch(sessionURL), fetch(sessionURL)];
            const overlappingPoll = await Promise.race(polls);
            expect(overlappingPoll.status).toBe(400);

            upgradingSocket.send('5');

            const pendingPoll = (await Promise.all(polls)).find((poll) => poll !== overlappingPoll);
            expect(pendingPoll?.status).toBe(200);
            expect(await pendingPoll?.text()).toBe('6');
          } finally {
            upgradingSocket.close();
          }
        });
      });

      it('should close upgrading WebSocket connections when the interceptor stops', async () => {
        const pollingURL = `${baseURL.replace(/^ws/, 'http')}/?EIO=4&transport=polling`;

        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
          const openPacket = await (await fetch(pollingURL)).text();
          const { sid } = JSON.parse(openPacket.slice(1)) as { sid: string };

          const upgradingSocket = new WebSocket(`${baseURL}/?EIO=4&transport=websocket&sid=${sid}`);

          try {
            const probeReplyPromise = new Promise<unknown>((resolve) => {
              upgradingSocket.addEventListener('message', (event) => resolve(event.data), { once: true });
            });

            await new Promise<void>((resolve) => {
              upgradingSocket.addEventListener('open', () => resolve(), { once: true });
            });

            upgradingSocket.send('2probe');
            expect(await probeReplyPromise).toBe('3probe');

            const closeEventPromise = new Promise<CloseEvent>((resolve) => {
              upgradingSocket.addEventListener('close', resolve, { once: true });
            });

            await interceptor.stop();

            const closeEvent = await closeEventPromise;
            expect(closeEvent.code).toBe(1005);
          } finally {
            upgradingSocket.close();
          }
        });
      });

      it('should close WebSocket connections opened while the last namespace stops', async () => {
        const pollingStopStartedPromise = createPromiseWithResolvers<void>();
        const pollingStopReleasedPromise = createPromiseWithResolvers<void>();
        const stopPolling = polling.stop.bind(polling);

        // No public call pauses a stop, so the polling interceptor holds it to open a connection while it runs.
        vi.spyOn(polling, 'stop').mockImplementation(async () => {
          pollingStopStartedPromise.resolve();
          await pollingStopReleasedPromise;
          await stopPolling();
        });

        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
          const stopPromise = interceptor.stop();

          try {
            await pollingStopStartedPromise;

            const socket = new WebSocket(`${baseURL}/?EIO=4&transport=websocket`);

            try {
              const messageListener = vi.fn();
              socket.addEventListener('message', messageListener);

              const closeEvent = await new Promise<CloseEvent>((resolve) => {
                socket.addEventListener('close', resolve, { once: true });
              });

              expect(closeEvent.code).toBe(1005);
              expect(messageListener).not.toHaveBeenCalled();
              expect(interceptor.clients).toHaveLength(0);
            } finally {
              socket.close();
            }
          } finally {
            pollingStopReleasedPromise.resolve();
            await stopPromise;
          }
        });
      });
    }

    // Local interceptors serve Socket.IO over polling only, so they close WebSocket connections.
    if (type === 'local') {
      it('should close WebSocket connections naming polling as the supported transport', async () => {
        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
          const socket = new WebSocket(`${baseURL}/?EIO=4&transport=websocket`);

          try {
            const socketEvents: string[] = [];
            socket.addEventListener('open', () => socketEvents.push('open'), { once: true });

            const closeEvent = await new Promise<CloseEvent>((resolve) => {
              socket.addEventListener(
                'close',
                (event) => {
                  socketEvents.push('close');
                  resolve(event);
                },
                { once: true },
              );
            });

            expect(socketEvents).toEqual(['open', 'close']);
            expect(closeEvent.code).toBe(4000);
            expect(closeEvent.reason).toBe(
              'Local Socket.IO interceptors support polling. Use a remote interceptor for WebSocket transports',
            );
            expect(interceptor.clients).toHaveLength(0);
          } finally {
            socket.close();
          }
        });
      });

      it('should not offer upgrades to polling clients', async () => {
        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async () => {
          const openPacket = await (await fetch(`${baseURL.replace(/^ws/, 'http')}/?EIO=4&transport=polling`)).text();

          expect(openPacket.charAt(0)).toBe('0');
          expect(JSON.parse(openPacket.slice(1))).toEqual({
            sid: expect.any(String) as string,
            upgrades: [],
            pingInterval: 25000,
            pingTimeout: 20000,
            maxPayload: 1000000,
          });
        });
      });
    }

    it('should answer polling packets without a session ID with a bad handshake method error', async () => {
      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        const response = await fetch(`${baseURL.replace(/^ws/, 'http')}/?EIO=4&transport=polling`, {
          method: 'POST',
          body: '40',
        });

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ code: 2, message: 'Bad handshake method' });
        expect(interceptor.clients).toHaveLength(0);
      });
    });

    it('should answer polling packets of unknown sessions with an unknown session error', async () => {
      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        const response = await fetch(`${baseURL.replace(/^ws/, 'http')}/?EIO=4&transport=polling&sid=unknown`, {
          method: 'POST',
          body: '40',
        });

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ code: 1, message: 'Session ID unknown' });
        expect(interceptor.clients).toHaveLength(0);
      });
    });

    it('should ignore polling packets without a body', async () => {
      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        await usingSocket(baseURL, { transports: pollingTransports }, async (socket) => {
          await waitForSocketConnection(socket);

          const response = await fetch(
            `${baseURL.replace(/^ws/, 'http')}/?EIO=4&transport=polling&sid=${socket.io.engine.id}`,
            { method: 'POST' },
          );

          expect(response.status).toBe(200);
          expect(await response.text()).toBe('ok');
          expect(interceptor.clients).toHaveLength(1);
          expect(socket.connected).toBe(true);
        });
      });
    });

    it('should answer polls of unknown sessions with a close packet', async () => {
      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async () => {
        const response = await fetch(`${baseURL.replace(/^ws/, 'http')}/?EIO=4&transport=polling&sid=unknown`);

        expect(response.status).toBe(200);
        expect(await response.text()).toBe('1');
      });
    });

    it('should answer overlapping polls with a bad request error', async () => {
      const pollingURL = `${baseURL.replace(/^ws/, 'http')}/?EIO=4&transport=polling`;

      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async () => {
        const openPacket = await (await fetch(pollingURL)).text();
        const { sid } = JSON.parse(openPacket.slice(1)) as { sid: string };
        const sessionURL = `${pollingURL}&sid=${sid}`;

        // Either poll may reach the session first, and the other one overlaps it.
        const polls = [fetch(sessionURL), fetch(sessionURL)];

        const overlappingPoll = await Promise.race(polls);
        expect(overlappingPoll.status).toBe(400);
        expect(await overlappingPoll.json()).toEqual({ code: 3, message: 'Bad request' });

        await fetch(sessionURL, { method: 'POST', body: '1' });

        const pendingPoll = (await Promise.all(polls)).find((poll) => poll !== overlappingPoll);
        expect(pendingPoll?.status).toBe(200);
        expect(await pendingPoll?.text()).toBe('1');
      });
    });

    it('should not open polling sessions while the last namespace stops', async () => {
      const pollingStopStartedPromise = createPromiseWithResolvers<void>();
      const pollingStopReleasedPromise = createPromiseWithResolvers<void>();
      const stopPolling = polling.stop.bind(polling);

      // No public call pauses a stop, so the polling interceptor holds it to open a session while it runs.
      vi.spyOn(polling, 'stop').mockImplementation(async () => {
        pollingStopStartedPromise.resolve();
        await pollingStopReleasedPromise;
        await stopPolling();
      });

      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        const stopPromise = interceptor.stop();

        try {
          await pollingStopStartedPromise;

          const response = await fetch(`${baseURL.replace(/^ws/, 'http')}/?EIO=4&transport=polling`);

          expect(response.status).toBe(403);
          expect(await response.json()).toEqual({ code: 4, message: 'Forbidden' });
        } finally {
          pollingStopReleasedPromise.resolve();
          await stopPromise;
        }
      });
    });

    // Local interceptors serve Socket.IO over polling only, so only remote clients connect over WebSocket.
    if (type === 'remote') {
      it('should connect WebSocket clients without a polling interceptor', async () => {
        await usingWebSocketInterceptor<AnySchema>(
          { type, baseURL, protocol: createSocketIOProtocol() },
          async (interceptor) => {
            await usingSocket(baseURL, { transports: [WebSocketTransport] }, async (socket) => {
              await waitForSocketConnection(socket);
              expect(interceptor.clients).toHaveLength(1);
            });
          },
        );
      });
    }

    it('should connect polling clients on a custom Socket.IO path', async () => {
      const customBaseURL = `${getServerBaseURL()}/custom/realtime`;
      const customPolling = createSocketIOPollingInterceptor(type, customBaseURL);

      await usingWebSocketInterceptor<AnySchema>(
        {
          type,
          baseURL: customBaseURL,
          protocol: createSocketIOProtocol({ polling: customPolling }),
        },
        async (interceptor) => {
          await usingSocket(customBaseURL, { transports: pollingTransports }, async (socket) => {
            await waitForSocketConnection(socket);

            expect(socket.io.engine.transport.name).toBe('polling');
            expect(interceptor.clients).toHaveLength(1);
          });
        },
      );
    });

    it('should answer polling requests with the supported protocol error for EIO=3', async () => {
      await usingIgnoredConsole(['warn'], async () => {
        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
          const response = await fetch(`${baseURL.replace(/^ws/, 'http')}/?EIO=3&transport=polling`);

          expect(response.status).toBe(400);
          expect(await response.json()).toEqual({
            code: 5,
            message: 'Engine.IO protocol version 3 is not supported. Use version 4.',
          });
          expect(interceptor.clients).toHaveLength(0);
        });
      });
    });

    it('should log unsupported Engine.IO versions of polling requests', async () => {
      await usingIgnoredConsole(['warn'], async (console) => {
        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async () => {
          await fetch(`${baseURL.replace(/^ws/, 'http')}/?EIO=3&transport=polling`);

          expect(console.warn).toHaveBeenCalledWith(
            color.cyan('[@zimic/interceptor]'),
            'Engine.IO protocol version 3 is not supported. Use version 4.',
          );
          expect(console.warn).toHaveBeenCalledTimes(1);
        });
      });
    });
  });

  describe('Polling interceptors', () => {
    it('should not start with a polling interceptor of another type', async () => {
      const otherTypePolling = createHttpInterceptor<SocketIOPollingSchema>({
        type: type === 'local' ? 'remote' : 'local',
        baseURL: baseURL.replace(/^ws/, 'http'),
      });

      await usingIgnoredConsole(['error'], async () => {
        await expect(
          usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions({ polling: otherTypePolling }), vi.fn()),
        ).rejects.toThrow(
          new InvalidSocketIOPollingInterceptorError(
            `its type must be '${type}', the same as the WebSocket interceptor.`,
          ),
        );
      });

      expect(otherTypePolling.isRunning).toBe(false);
    });

    it('should not start with a polling interceptor on another base URL', async () => {
      const otherBaseURLPolling = createSocketIOPollingInterceptor(type, `${baseURL}/other`);

      await usingIgnoredConsole(['error'], async () => {
        await expect(
          usingWebSocketInterceptor<AnySchema>(
            getSocketIOInterceptorOptions({ polling: otherBaseURLPolling }),
            vi.fn(),
          ),
        ).rejects.toThrow(
          new InvalidSocketIOPollingInterceptorError(
            `its base URL must be ${baseURL.replace(/^ws/, 'http')}, the WebSocket base URL with \`http\` instead of \`ws\`.`,
          ),
        );
      });

      expect(otherBaseURLPolling.isRunning).toBe(false);
    });

    it('should not start with a running polling interceptor', async () => {
      await usingHttpInterceptor<SocketIOPollingSchema>(
        { type, baseURL: baseURL.replace(/^ws/, 'http') },
        async (runningPolling) => {
          await usingIgnoredConsole(['error'], async () => {
            await expect(
              usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions({ polling: runningPolling }), vi.fn()),
            ).rejects.toThrow(
              new InvalidSocketIOPollingInterceptorError(
                'it must not be running, because the protocol starts and stops it.',
              ),
            );
          });

          expect(runningPolling.isRunning).toBe(true);
        },
      );
    });

    // Remote interceptors serve Socket.IO over WebSocket, so they do not need a polling interceptor.
    if (type === 'local') {
      it('should not start a local interceptor without a polling interceptor', async () => {
        await usingIgnoredConsole(['error'], async () => {
          await expect(
            usingWebSocketInterceptor<AnySchema>({ type, baseURL, protocol: createSocketIOProtocol() }, vi.fn()),
          ).rejects.toThrow(
            new InvalidSocketIOPollingInterceptorError(
              'local interceptors require one, because they serve Socket.IO over polling only.',
            ),
          );
        });
      });
    }

    // Local interceptors do not connect to an interceptor server, so they do not authenticate.
    if (type === 'remote') {
      it('should be able to start after adding required authentication to the polling interceptor', async () => {
        const authenticatedBaseURL = `${getAuthenticatedBaseURL()}/socket.io`;

        const authenticatedServerPolling = createHttpInterceptor<SocketIOPollingSchema>({
          type,
          baseURL: authenticatedBaseURL.replace(/^ws/, 'http'),
          requestSaving: { enabled: false },
        });

        await usingWebSocketInterceptor<AnySchema>(
          {
            type,
            baseURL: authenticatedBaseURL,
            auth: { token: getValidToken() },
            protocol: createSocketIOProtocol({ polling: authenticatedServerPolling }),
          },
          { start: false },
          async (interceptor) => {
            await usingIgnoredConsole(['error'], async () => {
              await expect(interceptor.start()).rejects.toThrow(UnauthorizedWebSocketConnectionError);
            });

            expect(interceptor.isRunning).toBe(false);

            authenticatedServerPolling.auth = { token: getValidToken() };

            await interceptor.start();

            expect(interceptor.isRunning).toBe(true);
            expect(authenticatedServerPolling.isRunning).toBe(true);
          },
        );
      });
    }

    it('should stop the polling interceptor with the last namespace of a base URL', async () => {
      await usingNamespaceInterceptors({}, async (rootInterceptor, adminInterceptor) => {
        expect(polling.isRunning).toBe(true);

        await adminInterceptor.stop();
        expect(polling.isRunning).toBe(true);

        await rootInterceptor.stop();
        expect(polling.isRunning).toBe(false);
      });
    });

    // Only remote interceptors register with the interceptor server after their protocol starts, and that registration
    // can fail. Local registrations cannot fail once the worker is running.
    if (type === 'remote') {
      it('should stop the polling interceptor if the interceptor fails to register', async () => {
        await usingWebSocketInterceptor<AnySchema>(
          getSocketIOInterceptorOptions(),
          { start: false },
          async (interceptor) => {
            const registrationError = new Error('Registration failed');
            const request = InterceptorWebSocketClient.prototype.request;

            // No public path makes the server reject a registration, so only the registration of the WebSocket
            // interceptor fails. The polling interceptor registers through the same client class.
            const requestSpy = vi.spyOn(InterceptorWebSocketClient.prototype, 'request').mockImplementation(function (
              this: InterceptorWebSocketClient<InterceptorServerWebSocketSchema>,
              channel,
              ...rest
            ) {
              if (channel === 'interceptors/ws/workers/reset') {
                return Promise.reject(registrationError);
              }
              return request.call(this, channel, ...rest);
            });

            try {
              await expect(interceptor.start()).rejects.toBe(registrationError);
            } finally {
              requestSpy.mockRestore();
            }

            expect(polling.isRunning).toBe(false);
          },
        );
      });
    }

    it('should start after the polling interceptor of the last namespace of a base URL stops', async () => {
      const pollingStopStartedPromise = createPromiseWithResolvers<void>();
      const pollingStopReleasedPromise = createPromiseWithResolvers<void>();
      const stopPolling = polling.stop.bind(polling);

      // No public call pauses a stop, so the polling interceptor holds it to start another interceptor while it runs.
      vi.spyOn(polling, 'stop').mockImplementation(async () => {
        pollingStopStartedPromise.resolve();
        await pollingStopReleasedPromise;
        await stopPolling();
      });

      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (stoppingInterceptor) => {
        const stopPromise = stoppingInterceptor.stop();
        await pollingStopStartedPromise;

        const nextInterceptorPromise = usingWebSocketInterceptor<AnySchema>(
          getSocketIOInterceptorOptions(),
          async (nextInterceptor) => {
            expect(polling.isRunning).toBe(true);

            await usingSocket(baseURL, { transports: [PollingTransport] }, async (socket) => {
              await waitForSocketConnection(socket);
              expect(nextInterceptor.clients).toHaveLength(1);
            });
          },
        );

        pollingStopReleasedPromise.resolve();

        await Promise.all([stopPromise, nextInterceptorPromise]);
      });
    });
  });
}
