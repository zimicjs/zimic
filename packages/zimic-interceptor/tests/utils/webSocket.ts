import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';

export async function usingWebSocketClient<Schema extends WebSocketSchema>(
  url: string,
  callback: (client: WebSocketClient<Schema>) => PossiblePromise<void>,
) {
  const client = new WebSocketClient<Schema>(url);

  try {
    await client.open();
    await callback(client);
  } finally {
    await client.close();
  }
}

export function waitForWebSocketClientMessage<Schema extends WebSocketSchema>(client: WebSocketClient<Schema>) {
  return new Promise<WebSocketClient.MessageEvent<Schema>['data']>((resolve) => {
    client.addEventListener('message', (event) => resolve(event.data), { once: true });
  });
}

export function collectWebSocketClientMessages<Schema extends WebSocketSchema>(client: WebSocketClient<Schema>) {
  const messages: WebSocketClient.MessageEvent<Schema>['data'][] = [];

  client.addEventListener('message', (event) => {
    messages.push(event.data);
  });

  return messages;
}

export function waitForWebSocketClientClose<Schema extends WebSocketSchema>(client: WebSocketClient<Schema>) {
  return new Promise<WebSocketClient.CloseEvent<Schema>>((resolve) => {
    client.addEventListener('close', resolve, { once: true });
  });
}
